// The admin's dashboard: one page with how the game is doing, made to read on a phone.
//
//   GET  /admin        the page (dashboard.html); it asks for the password and remembers it
//   GET  /admin/data   everything on it, as JSON           (header X-Admin-Key: the password)
//   POST /admin/anon   {"name": "Sammy"} -> {"name": "anonymous482"}, like node admin.mjs anon
//   POST /admin/name   {"id": 12, "name": "Sam", "approve": true|false} -> a player's name request approved or
//                      turned down, like node admin.mjs approve-name / deny-name
//   POST /admin/referee {"mode": "practice"|"cloudflare"|"all"|"off"} -> which checks try the PC
//                      referee first, from the next check on (refereeMode in shared.js)
//
// The password is the secret ADMIN_KEY, which only the admin sets (README, "Dashboard"); with no
// ADMIN_KEY the data stays locked. After MAX_TRIES wrong passwords in an hour, every try is turned
// away until the next hour, right password included, so it can't be guessed.
import PAGE from './dashboard.html';
import { POLL, pollOpen } from '../../js/poll.js';
import { EPOCH, utcToday, loadCalendar, parseJSON, REFEREE_MODES, refereeMode } from './shared.js';
import { anonName, decideName } from './ranked.js';
import { sameKey } from './pc.js';

const MIN_PASSWORD = 12;
const MAX_TRIES = 20;
const DAYS = 14;

const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };

export async function dashboard(request, env, url) {
  const path = url.pathname.replace(/\/$/, '');
  if (path === '/admin' && request.method === 'GET') return page();
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...PRIVATE, 'Content-Type': 'application/json' } });
  if (!['/admin/data', '/admin/anon', '/admin/name', '/admin/referee'].includes(path)) return new Response('Not found', { status: 404, headers: PRIVATE });

  const access = await checkPassword(request, env);
  if (access === 'unset') return json(503, { error: 'unset' });
  if (access === 'locked') return json(429, { error: 'locked' });
  if (access === 'wrong') return json(401, { error: 'wrong' });

  if (path === '/admin/data' && request.method === 'GET') return json(200, await collect(env));
  if (path === '/admin/anon' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    const result = await makeAnonymous(env, data.name);
    return json(result.error ? 400 : 200, result);
  }
  if (path === '/admin/name' && request.method === 'POST') {
    const data = parseJSON(await request.text()) || {};
    if (!Number.isInteger(data.id) || typeof data.name !== 'string' || typeof data.approve !== 'boolean') return json(400, { error: 'Wrong shape' });
    const result = await decideName(env, data.id, data.name, data.approve);
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
  const [visits, dives, runs, joined, ai, board, names, recent, requests, feedback, votes, failures] = await db.batch([
    db.prepare('SELECT day, n, phone, fresh FROM visit_days WHERE day >= ?1').bind(from),
    db.prepare('SELECT day, n FROM dives WHERE day >= ?1').bind(from),
    db.prepare('SELECT day, COUNT(*) AS n, SUM(finished IS NOT NULL) AS done FROM runs WHERE day >= ?1 GROUP BY day').bind(from),
    db.prepare('SELECT created AS day, COUNT(*) AS n FROM players WHERE created >= ?1 GROUP BY created').bind(from),
    db.prepare('SELECT day, n, units, failed, pc, pc_failed, practice_out_at, ranked_out_at FROM ai_calls WHERE day >= ?1').bind(utcDay - DAYS + 1),
    db.prepare(`SELECT p.name, r.score, json_array_length(r.rounds) AS answered, r.flags, r.finished IS NOT NULL AS done, p.banned, p.paused
      FROM runs r JOIN players p ON p.id = r.player WHERE r.day = ?1 ORDER BY r.score DESC LIMIT 20`).bind(today),
    db.prepare(`SELECT COUNT(*) AS total, SUM(name_kind = 'own' AND NOT banned) AS own, SUM(name_kind = 'anon' AND NOT banned) AS anon,
      SUM(name_kind IS NULL AND NOT banned) AS waiting FROM players`),
    db.prepare(`SELECT name, name_before, name_at FROM players WHERE name_kind = 'own' AND NOT banned AND name_at IS NOT NULL
      ORDER BY name_at DESC LIMIT 40`),
    db.prepare(`SELECT id, name, name_kind, name_before, name_request, name_request_at, paused FROM players
      WHERE name_request IS NOT NULL AND name_request_no = 0 AND NOT banned ORDER BY name_request_at LIMIT 40`),
    db.prepare(`SELECT f.at, f.text, f.device, f.place, p.name FROM feedback f LEFT JOIN players p ON p.id = f.player
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

// The same change as node admin.mjs anon: an anonymous name the player sees next time they open the game.
async function makeAnonymous(env, name) {
  if (typeof name !== 'string' || !name.trim()) return { error: 'No name given' };
  const found = await env.DB.prepare('SELECT id, name FROM players WHERE name_key = ?1').bind(name.trim().toLowerCase()).first();
  if (!found) return { error: `No player called ${name}` };
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
