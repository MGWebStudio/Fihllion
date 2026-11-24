// The admin's dashboard: one page with how the game is doing, made to read on a phone.
//
//   GET  /admin        the page (dashboard.html); it asks for the password and remembers it
//   GET  /admin/data   everything on it, as JSON           (header X-Admin-Key: the password)
//   POST /admin/anon   {"name": "Sammy"} -> {"name": "anonymous482"}, like node admin.mjs anon
//   POST /admin/name   {"id": 12, "name": "Sam", "approve": true|false} -> a player's name request approved or
//                      turned down, like node admin.mjs approve-name / deny-name
//   POST /admin/referee {"mode": "practice"|"cloudflare"|"all"|"off"} -> which checks try the PC
//                      referee first, from the next check on (refereeMode in shared.js)
//   POST /admin/appeal {"id": 12, "at": 1764..., "lift": true|false, "reply"?: "..."} -> a ban appeal answered:
//                      the ban lifted, with a note the player sees once, or kept (decideAppeal in ranked.js)
//   POST /admin/ban    {"name": "Sam", "hours": 24|null} -> the player banned, for that many hours or until
//                      it's lifted, like node admin.mjs ban ({"id": 12} instead of the name, from the player panel)
//   POST /admin/unban  {"id": 12} -> a ban lifted, like node admin.mjs unban
//   GET  /admin/names  every player's name, for the Players box's suggestions as a name is typed
//   POST /admin/player {"id": 12} or {"name": "Sam"}, and "day"? -> the player panel: who they are, their runs
//                      with every answer, the prompts of one run's day (the latest, or "day"), messages, feedback
//   POST /admin/message {"id": 12, "text": "..."} -> a message their game shows once, next time it opens
//   POST /admin/pause  {"id": 12, "paused": true|false} -> off the boards without a ban, like node admin.mjs pause
//   POST /admin/score  {"id": 12, "day": 22, "score": 260} -> a run's score changed by hand (the first score is kept)
//
// The password is the secret ADMIN_KEY, which only the admin sets (README, "Dashboard"); with no
// ADMIN_KEY the data stays locked. After MAX_TRIES wrong passwords in an hour, every try is turned
// away until the next hour, right password included, so it can't be guessed.
import PAGE from './dashboard.html';
import { POLL, pollOpen } from '../../js/poll.js';
import { TIERS, PROMPTS_PER_DIVE } from '../../js/content.js';
import { EPOCH, utcToday, loadCalendar, findPrompt, parseJSON, REFEREE_MODES, refereeMode } from './shared.js';
import { anonName, decideName, decideAppeal, STILL_BANNED, ON_BOARD, MESSAGE_MAX } from './ranked.js';
import { sameKey } from './pc.js';

const MIN_PASSWORD = 12;
const BAN_HOURS_MAX = 24 * 365;
const MAX_TRIES = 20;
const DAYS = 14;
const RUNS_SHOWN = 60; // a player's runs in the panel, newest first
const SCORE_MAX = PROMPTS_PER_DIVE * Math.max(...TIERS.map((tier) => tier.pts));

const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };

export async function dashboard(request, env, url) {
  const path = url.pathname.replace(/\/$/, '');
  if (path === '/admin' && request.method === 'GET') return page();
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...PRIVATE, 'Content-Type': 'application/json' } });
  if (!['/admin/data', '/admin/anon', '/admin/name', '/admin/referee', '/admin/appeal', '/admin/ban', '/admin/unban',
    '/admin/names', '/admin/player', '/admin/message', '/admin/pause', '/admin/score'].includes(path)) return new Response('Not found', { status: 404, headers: PRIVATE });

  const access = await checkPassword(request, env);
  if (access === 'unset') return json(503, { error: 'unset' });
  if (access === 'locked') return json(429, { error: 'locked' });
  if (access === 'wrong') return json(401, { error: 'wrong' });

  if (path === '/admin/data' && request.method === 'GET') return json(200, await collect(env));
  if (path === '/admin/names' && request.method === 'GET') return json(200, await allNames(env));
  if (path === '/admin/anon' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    const result = await makeAnonymous(env, data);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/player' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!(Number.isInteger(data.id) || typeof data.name === 'string') || (data.day !== undefined && !Number.isInteger(data.day))) return json(400, { error: 'Wrong shape' });
    const result = await playerPanel(env, data);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/message' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id) || typeof data.text !== 'string') return json(400, { error: 'Wrong shape' });
    const result = await sendMessage(env, data.id, data.text);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/pause' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id) || typeof data.paused !== 'boolean') return json(400, { error: 'Wrong shape' });
    const result = await setPaused(env, data.id, data.paused);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/score' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id) || !Number.isInteger(data.day) || !Number.isInteger(data.score) || data.score < 0 || data.score > SCORE_MAX) {
      return json(400, { error: `A score is a whole number from 0 to ${SCORE_MAX}.` });
    }
    const result = await setScore(env, data.id, data.day, data.score);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/name' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id) || typeof data.name !== 'string' || typeof data.approve !== 'boolean') return json(400, { error: 'Wrong shape' });
    const result = await decideName(env, data.id, data.name, data.approve);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/appeal' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id) || !Number.isInteger(data.at) || typeof data.lift !== 'boolean'
      || (data.reply !== undefined && typeof data.reply !== 'string')) return json(400, { error: 'Wrong shape' });
    const result = await decideAppeal(env, data.id, data.at, data.lift, data.reply || '');
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/ban' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    const hours = data.hours ?? null;
    if (!(typeof data.name === 'string' || Number.isInteger(data.id)) || (hours !== null && !(Number.isInteger(hours) && hours >= 1 && hours <= BAN_HOURS_MAX))) return json(400, { error: 'Wrong shape' });
    const result = await banPlayer(env, data, hours);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/unban' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id)) return json(400, { error: 'Wrong shape' });
    const result = await unbanPlayer(env, data.id);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/referee' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!REFEREE_MODES.includes(data.mode)) return json(400, { error: 'Unknown mode' });
    await env.DB.prepare(`INSERT INTO settings (key, value, at) VALUES ('pc_referee', ?1, ?2)
      ON CONFLICT (key) DO UPDATE SET value = ?1, at = ?2`).bind(data.mode, Date.now()).run();
    return json(200, { mode: await refereeMode(env) });
  }
  return json(405, { error: 'method' });
}

// The page itself has nothing private in it; the data comes after the password. Its one script
// runs under a fresh nonce, and nothing else may load except the game's fonts and icon.
function page() {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    'img-src https://mgwebstudio.github.io data:',
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return new Response(PAGE.replaceAll('{{NONCE}}', nonce), {
    headers: { ...PRIVATE, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp },
  });
}

async function checkPassword(request, env) {
  if (typeof env.ADMIN_KEY !== 'string' || env.ADMIN_KEY.trim().length < MIN_PASSWORD) return 'unset';
  const hour = Math.floor(Date.now() / 3600000);
  const tries = await env.DB.prepare('SELECT n FROM admin_tries WHERE hour = ?1').bind(hour).first('n');
  if (tries >= MAX_TRIES) return 'locked';
  let given = '';
  try {
    // The page sends it URI-encoded, since a header can't carry every character a password might use.
    given = decodeURIComponent(request.headers.get('X-Admin-Key') || '');
  } catch {
    // Counts as wrong.
  }
  if (await sameKey(given, env.ADMIN_KEY, MIN_PASSWORD)) return 'ok';
  await env.DB.prepare('INSERT INTO admin_tries (hour, n) VALUES (?1, 1) ON CONFLICT (hour) DO UPDATE SET n = n + 1').bind(hour).run();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return 'wrong';
}

// Everything on the page. Game days (Dailies, ranked, visitors, new players) run midnight to
// midnight Mountain Time; the referee's AI days run 5 PM to 5 PM, when Cloudflare's allowance resets.
async function collect(env) {
  const calendar = await loadCalendar(env);
  const utcDay = utcToday();
  const today = calendar ? calendar.today : utcDay;
  const from = today - DAYS + 1;
  const weekAgo = Date.now() - 7 * 86400000;
  const db = env.DB;
  const [visits, dives, runs, joined, ai, board, names, recent, requests, banned, feedback, votes, failures] = await db.batch([
    db.prepare('SELECT day, n, phone, fresh FROM visit_days WHERE day >= ?1').bind(from),
    db.prepare('SELECT day, n FROM dives WHERE day >= ?1').bind(from),
    db.prepare('SELECT day, COUNT(*) AS n, SUM(finished IS NOT NULL) AS done FROM runs WHERE day >= ?1 GROUP BY day').bind(from),
    db.prepare('SELECT created AS day, COUNT(*) AS n FROM players WHERE created >= ?1 GROUP BY created').bind(from),
    db.prepare('SELECT day, n, units, failed, pc, pc_failed, practice_out_at, ranked_out_at FROM ai_calls WHERE day >= ?1').bind(utcDay - DAYS + 1),
    db.prepare(`SELECT p.id, p.name, r.score, json_array_length(r.rounds) AS answered, r.flags, r.finished IS NOT NULL AS done, p.banned, p.paused
      FROM runs r JOIN players p ON p.id = r.player WHERE r.day = ?1 ORDER BY r.score DESC LIMIT 20`).bind(today),
    db.prepare(`SELECT COUNT(*) AS total, SUM(name_kind = 'own' AND NOT banned) AS own, SUM(name_kind = 'anon' AND NOT banned) AS anon,
      SUM(name_kind IS NULL AND NOT banned) AS waiting FROM players`),
    db.prepare(`SELECT id, name, name_before, name_at FROM players WHERE name_kind = 'own' AND NOT banned AND name_at IS NOT NULL
      ORDER BY name_at DESC LIMIT 40`),
    db.prepare(`SELECT id, name, name_kind, name_before, name_request, name_request_at, paused FROM players
      WHERE name_request IS NOT NULL AND name_request_no = 0 AND NOT banned ORDER BY name_request_at LIMIT 40`),
    // Everyone banned, with their appeal if they sent one; waiting appeals first, oldest first.
    db.prepare(`SELECT id, name, appeal, appeal_at, appeal_state, banned_until FROM players WHERE ${STILL_BANNED}
      ORDER BY appeal_state = 'waiting' DESC, appeal_at, name LIMIT 60`),
    db.prepare(`SELECT f.at, f.text, f.device, f.place, p.id, p.name FROM feedback f LEFT JOIN players p ON p.id = f.player
      WHERE f.at > ?1 ORDER BY f.at DESC LIMIT 40`).bind(weekAgo),
    db.prepare('SELECT choice, COUNT(*) AS n FROM poll_votes WHERE poll = ?1 GROUP BY choice').bind(POLL?.id || ''),
    db.prepare('SELECT kind, COUNT(*) AS n FROM ai_failures WHERE at > ?1 GROUP BY kind ORDER BY n DESC').bind(Date.now() - 86400000),
  ]);
  const rows = (result) => result.results || [];

  let pc = null;
  if (env.PC) {
    try {
      pc = await env.PC.get(env.PC.idFromName('pc')).status();
    } catch {
      pc = { connected: false, ready: false, paused: false, unknown: true };
    }
  }
  return {
    now: Date.now(),
    epoch: EPOCH,
    today,
    utcDay,
    days: DAYS,
    visits: rows(visits),
    dives: rows(dives),
    runs: rows(runs),
    joined: rows(joined),
    ai: rows(ai),
    budget: { daily: Number(env.AI_DAILY_UNITS || 0), reserve: Number(env.AI_RANKED_RESERVE || 0) },
    pc: pc && { ...pc, mode: await refereeMode(env) },
    failures: rows(failures),
    board: rows(board),
    names: rows(names)[0] || {},
    recent: rows(recent),
    requests: rows(requests),
    banned: rows(banned),
    feedback: rows(feedback),
    poll: POLL && {
      title: POLL.title,
      question: POLL.question,
      open: pollOpen(),
      closesSaid: POLL.closesSaid,
      options: POLL.options.map((option) => ({ label: option.label, votes: rows(votes).find((row) => row.choice === option.id)?.n ?? 0 })),
    },
  };
}

// A player by id (the player panel's buttons) or by their name as typed (the ban box, the search box).
// A name that doesn't match gives near misses: part of a name, or a name they had before.
async function findPlayer(env, { id, name }, columns = 'id, name') {
  if (Number.isInteger(id)) {
    const found = await env.DB.prepare(`SELECT ${columns} FROM players WHERE id = ?1`).bind(id).first();
    return found ? { found } : { error: 'That player isn’t there any more. Refresh and look again.' };
  }
  const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!key) return { error: 'Type a player’s name.' };
  const found = await env.DB.prepare(`SELECT ${columns} FROM players WHERE name_key = ?1`).bind(key).first();
  if (found) return { found };
  const { results } = await env.DB.prepare(`SELECT name FROM players
    WHERE instr(name_key, ?1) > 0 OR instr(lower(name_before), ?1) > 0 OR (length(name_key) >= 3 AND instr(?1, name_key) > 0)
    ORDER BY length(name) LIMIT 3`).bind(key).all();
  const close = results.map((row) => row.name);
  return { error: `No player called ${name.trim()}.${close.length ? ` Did you mean ${close.join(', ')}?` : ''}`, close };
}

// Every player's name for the Players box, which suggests names as they're typed, with what helps
// tell them apart: a name they had before, whether they're banned or paused, and the last day they
// played ranked. The page does the matching, so it keeps up with every key.
async function allNames(env) {
  const { results } = await env.DB.prepare(`SELECT p.id, p.name, NULLIF(p.name_before, p.name) AS before, (${STILL_BANNED}) AS banned,
      p.paused, (SELECT MAX(r.day) FROM runs r WHERE r.player = p.id) AS last FROM players p`).all();
  return { players: results.map((row) => ({ ...row, banned: Boolean(row.banned), paused: Boolean(row.paused) })) };
}

// Everything the player panel shows about one player. Prompts come from the game's data, so only one
// day's are looked up per call (the latest run's, or the day asked for); the page asks for the others
// as they're opened.
async function playerPanel(env, data) {
  const { found: player, error, close } = await findPlayer(env, data, `id, name, name_kind, name_before, name_at, created, (${STILL_BANNED}) AS banned,
    banned_until, paused, rename_offer, name_request, name_request_no, appeal, appeal_at, appeal_state, appeal_reply`);
  if (error) return { error, close };
  const db = env.DB;
  const [runs, messages, feedback] = await db.batch([
    // Each run's place among the players on that day's board, counting this player as if they're on it.
    db.prepare(`SELECT r.day, r.score, r.score_was, r.flags, r.finished, r.rounds,
        (SELECT COUNT(*) FROM runs o JOIN players p ON p.id = o.player WHERE o.day = r.day AND o.player != r.player AND ${ON_BOARD} AND o.score > r.score) + 1 AS place,
        (SELECT COUNT(*) FROM runs o JOIN players p ON p.id = o.player WHERE o.day = r.day AND o.player != r.player AND ${ON_BOARD}) + 1 AS players
      FROM runs r WHERE r.player = ?1 ORDER BY r.day DESC LIMIT ?2`).bind(player.id, RUNS_SHOWN),
    db.prepare('SELECT id, text, at, seen_at FROM messages WHERE player = ?1 ORDER BY at DESC LIMIT 30').bind(player.id),
    db.prepare('SELECT at, text, device, place FROM feedback WHERE player = ?1 ORDER BY at DESC LIMIT 10').bind(player.id),
  ]);
  const rows = (result) => result.results || [];
  const list = rows(runs).map((run) => ({ ...run, rounds: parseJSON(run.rounds) || [] }));
  const loaded = await loadCalendar(env);
  const day = Number.isInteger(data.day) ? data.day : list[0]?.day;
  const prompts = {};
  if (loaded && day >= 1 && day <= loaded.today) {
    prompts[day] = await Promise.all(loaded.calendar.idsFor(day).map(async (id) => (await findPrompt(env, id))?.text || id));
  }
  return {
    player: { ...player, banned: Boolean(player.banned), paused: Boolean(player.paused) },
    today: loaded?.today ?? null,
    epoch: EPOCH,
    tiers: TIERS.map((tier) => ({ name: tier.name, color: tier.color })),
    scoreMax: SCORE_MAX,
    messageMax: MESSAGE_MAX,
    runs: list,
    prompts,
    messages: rows(messages),
    feedback: rows(feedback),
  };
}

// A message for one player, shown once in their game the next time it opens (ranked.js, "messages").
async function sendMessage(env, id, text) {
  const clean = text.trim().slice(0, MESSAGE_MAX);
  if (!clean) return { error: 'Write the message first.' };
  const { found, error } = await findPlayer(env, { id });
  if (error) return { error };
  await env.DB.prepare('INSERT INTO messages (player, text, at) VALUES (?1, ?2, ?3)').bind(found.id, clean, Date.now()).run();
  return { name: found.name };
}

// Off the boards without a ban, like node admin.mjs pause: ranked is locked and the game says it's
// paused, but they keep everything else. Unpausing puts them back with their scores.
async function setPaused(env, id, paused) {
  const { found, error } = await findPlayer(env, { id });
  if (error) return { error };
  await env.DB.prepare('UPDATE players SET paused = ?2 WHERE id = ?1').bind(found.id, paused ? 1 : 0).run();
  return { name: found.name, paused };
}

// A run's score changed by hand, like halving a run with looked-up answers. The score before the first
// change is kept (score_was) so it can be put back; putting it back clears it. Only a finished run,
// or one from an earlier day, so a run still in play can't add to a changed score.
async function setScore(env, id, day, score) {
  const run = await env.DB.prepare('SELECT r.score, r.score_was, r.finished, p.name FROM runs r JOIN players p ON p.id = r.player WHERE r.player = ?1 AND r.day = ?2')
    .bind(id, day).first();
  if (!run) return { error: 'That run isn’t there. Refresh and look again.' };
  const loaded = await loadCalendar(env);
  if (!run.finished && day >= (loaded?.today ?? Infinity)) return { error: 'That run isn’t finished yet. Change it once it is.' };
  const first = run.score_was ?? run.score;
  const was = score === first ? null : first;
  await env.DB.prepare('UPDATE runs SET score = ?3, score_was = ?4 WHERE player = ?1 AND day = ?2').bind(id, day, score, was).run();
  return { name: run.name, day, score, was };
}

// The same change as node admin.mjs anon: an anonymous name the player sees next time they open the game.
async function makeAnonymous(env, data) {
  const { found, error } = await findPlayer(env, data);
  if (error) return { error };
  for (let i = 0; i < 8; i += 1) {
    const anon = anonName(i);
    const taken = await env.DB.prepare('SELECT 1 FROM players WHERE name_key = ?1').bind(anon.toLowerCase()).first();
    if (taken) continue;
    await env.DB.prepare(`UPDATE players SET name = ?2, name_key = ?3, name_kind = 'anon', name_before = COALESCE(name_before, name),
      name_at = ?4, rename_offer = 0 WHERE id = ?1`).bind(found.id, anon, anon.toLowerCase(), Date.now()).run();
    return { was: found.name, name: anon };
  }
  return { error: 'Couldn’t find a free anonymous name. Try again.' };
}

// A ban from the dashboard, the same as node admin.mjs ban: Endless only, off every board, until it
// ends or is lifted. A new ban starts with no appeal. Banning someone who's already banned only
// changes how long it lasts, so an appeal they've sent still waits.
async function banPlayer(env, { id, name }, hours) {
  if (!Number.isInteger(id) && !name.trim()) return { error: 'Type the name of the player to ban.' };
  const { found, error } = await findPlayer(env, Number.isInteger(id) ? { id } : { name }, `id, name, (${STILL_BANNED}) AS still`);
  if (error) return { error };
  const until = hours ? Date.now() + hours * 3600000 : null;
  await env.DB.prepare(found.still
    ? 'UPDATE players SET banned_until = ?2 WHERE id = ?1'
    : 'UPDATE players SET banned = 1, banned_until = ?2, appeal = NULL, appeal_at = NULL, appeal_state = NULL, appeal_reply = NULL WHERE id = ?1')
    .bind(found.id, until).run();
  return { name: found.name, until, already: Boolean(found.still) };
}

// Lifting a ban from the dashboard's list, the same as node admin.mjs unban: back on the boards with
// their scores. An appeal that was waiting counts as answered, so the game says it went through.
async function unbanPlayer(env, id) {
  const found = await env.DB.prepare(`SELECT id, name FROM players WHERE id = ?1 AND ${STILL_BANNED}`).bind(id).first();
  if (!found) return { error: 'That player isn’t banned any more. Refresh and look again.' };
  await env.DB.prepare(`UPDATE players SET banned = 0, banned_until = NULL,
    appeal_state = CASE WHEN appeal_state = 'waiting' THEN 'yes' ELSE appeal_state END WHERE id = ?1`).bind(id).run();
  return { name: found.name };
}
