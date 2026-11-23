// Ranked mode. A player picks a name for the board (their own, or anonymous), and from then on their
// Daily is a ranked run, one try a day.
// The server runs the dive: it sends one question at a time, keeps its own clock, and scores every
// answer itself with the answer lists and the referee, so editing the page can't change a score.
// Days are Mountain Time, the same as the Daily.
//
//   POST /ranked/join      {"name": "Sam"} or {"anonymous": true} -> {"name": "Sam" or "Anon4821", "key": "..."}
//   POST /ranked/status    {"key": "..."}                        -> {"name", "today", "run": {...}|null, "paused", "rename", "nameCheck", "request"}
//   POST /ranked/question  {"key": "..."}                        -> {"day", "round", "id", "text", "msLeft"} or {"finished": true}
//   POST /ranked/guess     {"key", "round", "typed", "final"}    -> {"result": "hit"|"miss"|"late"|"busy", ...}
//   POST /ranked/void      {"key", "round"}                      -> the question scores 0, flagged (they left the tab)
//   POST /ranked/rename    {"key", "name"}, {"key", "anonymous": true} or {"key", "keep": true} -> {"name"},
//                          for the name question, or when the admin offered or forced a new name
//   POST /ranked/request   {"key", "name"} or {"key", "cancel": true} -> {"request": {"name", "state"}|null}, a different
//                          name that changes once the admin approves it
//   POST /ranked/appeal    {"key", "text"}                       -> {"appeal": {"state": "waiting", "at"}}, a banned
//                          player asking for the ban to be lifted; the admin answers on the dashboard
//   A banned player's /ranked/status is {"banned": true, "name", "appeal"}, and everything else is {"error": "banned"}.
//   POST /ranked/board    {"key"?, "day"?}                      -> today's and this week's boards
import { COUNTDOWN, LIMIT, PROMPTS_PER_DIVE, TIERS, withHiddenAnswer } from '../../js/content.js';
import { buildIndex, findAnswer } from '../../js/match.js';
import { parseJSON, cleanTyped, loadCalendar, findPrompt, judge } from './shared.js';

const GRACE_MS = 2500; // network time on top of the clock the player sees
const APPEAL_MAX = 600; // characters, the same as the feedback box
// Answers passed along by the Google relay (relay/google-apps-script.js) take an extra hop each way,
// so they get more time before they count as late.
const RELAY_GRACE_MS = 4000;
const MAX_GUESSES = 40; // per question
const BOARD_SIZE = 100;

export async function ranked(action, text, env, reply, json, { relayed = false } = {}) {
  let data;
  try {
    data = parseJSON(text) || {};
  } catch (error) {
    return reply(400, error.message);
  }
  try {
    if (action === 'join') return json(await join(env, data));
    if (action === 'board') return json(await board(env, data));
    const player = await playerFor(env, data.key);
    if (!player) return json({ error: 'unknown' });
    // A banned player can see that they're banned and appeal it, and nothing else. The game keeps
    // their key, so the appeal is theirs and its answer reaches them.
    if (player.banned) {
      if (action === 'status') return json({ banned: true, name: player.name, appeal: appealFor(player) });
      if (action === 'appeal') return json(await appeal(env, player, data));
      return json({ error: 'banned' });
    }
    if (action === 'appeal') return json({ error: 'not-banned' });
    if (action === 'rename') return json(await rename(env, player, data));
    if (action === 'request') return json(await requestName(env, player, data));
    if (action === 'status') return json(await status(env, player));
    // Paused, or made to pick a new nickname: the game says why and they can play just for fun.
    if (player.paused) return json({ error: 'paused' });
    if (player.rename_offer === 2) return json({ error: 'rename' });
    if (action === 'question') return json(await question(env, player, data));
    if (action === 'guess') return json(await guess(env, player, data, relayed));
    if (action === 'void') return json(await voidRound(env, player, data));
    return reply(404, 'Not found');
  } catch (error) {
    console.log('RANKED', action, error.stack || error.message);
    return reply(503, 'Try again');
  }
}

// Nicknames ------------------------------------------------------------------------------

const NAME = /^[A-Za-z0-9]{3,16}$/;
const RESERVED = ['admin', 'administrator', 'fihllion', 'krillion', 'moderator', 'mod', 'official', 'staff', 'system', 'null', 'undefined', 'anonymous', 'teacher', 'principal'];
// Blocked anywhere in a name.
const ANYWHERE = ['akbar', 'allahu', 'mickbar', 'fuck', 'fuk', 'fck', 'shit', 'cunt', 'nigg', 'niga', 'fag', 'bitch', 'whore', 'slut', 'porn', 'penis', 'vagina', 'pussy', 'dildo', 'nazi', 'hitler', 'rapist', 'retard', 'molest', 'pedo', 'jizz', 'wank', 'twat', 'kkk', 'horny', 'boob', 'dick', 'cock', 'tits', 'butthole', 'asshole', 'dumbass', 'jackass', 'sexy', 'cum4', 'hooker'];
// Blocked as the whole name (numbers on the end don't help), since they hide inside real words.
const WHOLE = ['ass', 'anal', 'anus', 'sex', 'rape', 'crap', 'hoe', 'hoes', 'cum', 'tit', 'gay', 'damn', 'piss', 'butt', 'poop', 'pee', 'nut', 'nuts', 'balls'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };
const collapse = (word) => word.replace(/(.)\1+/g, '$1');

export function nameProblem(name) {
  if (typeof name !== 'string' || !NAME.test(name)) return 'invalid';
  const plain = name.toLowerCase().replace(/[0-9]/g, (digit) => LEET[digit] ?? digit);
  const letters = name.toLowerCase().replace(/[0-9]+$/, '').replace(/[0-9]/g, (digit) => LEET[digit] ?? digit);
  // Kept for anonymous players, so a name like anonymous482 always means someone chose to go anonymous.
  if (/^an+on/.test(plain)) return 'anon';
  if (RESERVED.includes(letters)) return 'blocked';
  for (const word of ANYWHERE) {
    if (plain.includes(word)) return 'blocked';
    if (collapse(word) === word && collapse(plain).includes(word)) return 'blocked';
  }
  for (const word of WHOLE) if (letters === word || collapse(letters) === collapse(word)) return 'blocked';
  return null;
}

// Anonymous players show on the boards as "anonymous" and three numbers, like anonymous482. From the
// fifth try at a free one, it's four numbers, so there's always room.
export const anonName = (attempt = 0) => {
  const [low, span] = attempt < 4 ? [100, 900] : [1000, 9000];
  return `anonymous${low + (crypto.getRandomValues(new Uint32Array(1))[0] % span)}`;
};

// Real names on the leaderboard: from NAMES_FROM on (wrangler.jsonc), every player answers once,
// their own name or anonymous, and can't start a ranked Daily until they do. Without the setting
// it's always on.
export function needsName(env, player) {
  if (player.name_kind) return false;
  const from = Date.parse(env.NAMES_FROM || '');
  return Number.isNaN(from) || Date.now() >= from;
}

async function sha256(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A new player puts in their name or goes anonymous, which answers the name question too.
async function join(env, data) {
  const anonymous = data.anonymous === true;
  const problem = anonymous ? null : nameProblem(data.name);
  if (problem) return { error: problem };
  const loaded = await loadCalendar(env);
  const key = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const keyHash = await sha256(key);
  // An anonymous name that's already taken gets another try with new numbers.
  for (let tries = anonymous ? 8 : 1; tries > 0; tries -= 1) {
    const name = anonymous ? anonName(8 - tries) : data.name;
    const result = await env.DB.prepare(`INSERT INTO players (name, name_key, key_hash, created, name_kind, name_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT (name_key) DO NOTHING`)
      .bind(name, name.toLowerCase(), keyHash, loaded?.today ?? 0, anonymous ? 'anon' : 'own', Date.now()).run();
    if (result.meta.changes) return { name, key };
  }
  return { error: 'taken' };
}

export async function playerFor(env, key) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 100) return null;
  return env.DB.prepare(`SELECT id, name, banned, paused, rename_offer, name_kind, name_request, name_request_no, appeal_at, appeal_state
      FROM players WHERE key_hash = ?1`)
    .bind(await sha256(key)).first();
}

// The name question, or a name change the admin offered (node admin.mjs offer-rename) or requires
// (force-rename). The player puts in their name, goes anonymous, or keeps the one they have (not
// when it was forced). They keep their scores; only the name on the boards changes.
async function rename(env, player, data) {
  const asked = needsName(env, player);
  if (!player.rename_offer && !asked) return { error: 'not-offered', name: player.name };
  const forced = player.rename_offer === 2;
  const now = Date.now();
  if (data.keep === true) {
    if (forced) return { error: 'forced' };
    // Keeping it when asked the name question means it's their name.
    if (asked) {
      await env.DB.prepare("UPDATE players SET rename_offer = 0, name_kind = 'own', name_before = COALESCE(name_before, name), name_at = ?2 WHERE id = ?1")
        .bind(player.id, now).run();
    } else {
      await env.DB.prepare('UPDATE players SET rename_offer = 0 WHERE id = ?1').bind(player.id).run();
    }
    return { name: player.name };
  }
  const anonymous = data.anonymous === true;
  if (!anonymous) {
    const problem = nameProblem(data.name);
    if (problem) return { error: problem };
    if (forced && data.name.toLowerCase() === player.name.toLowerCase()) return { error: 'blocked' };
  }
  for (let tries = anonymous ? 8 : 1; tries > 0; tries -= 1) {
    const name = anonymous ? anonName(8 - tries) : data.name;
    try {
      await env.DB.prepare(`UPDATE players SET name = ?1, name_key = ?2, rename_offer = 0, name_kind = ?3,
          name_before = COALESCE(name_before, name), name_at = ?4, name_request = NULL, name_request_no = 0 WHERE id = ?5`)
        .bind(name, name.toLowerCase(), anonymous ? 'anon' : 'own', now, player.id).run();
      return { name };
    } catch (error) {
      if (!/unique/i.test(error.message)) throw error;
    }
  }
  return { error: 'taken' };
}

// A player who already has a name asks for a different one, from the leaderboard. It changes once
// the admin approves it (the dashboard, or node admin.mjs approve-name); until then they keep playing
// as they are. A new request replaces the last one, and {"cancel": true} takes it back. Players who
// can change their name themselves right now (the name question, or an offered or forced change) do
// that instead.
async function requestName(env, player, data) {
  if (player.rename_offer || needsName(env, player)) return { error: 'can-rename' };
  if (data.cancel === true) {
    await env.DB.prepare('UPDATE players SET name_request = NULL, name_request_at = NULL, name_request_no = 0 WHERE id = ?1').bind(player.id).run();
    return { request: null };
  }
  const problem = nameProblem(data.name);
  if (problem) return { error: problem };
  if (data.name === player.name) return { error: 'same' };
  // Taken by someone else's name, or by someone else's request that's still waiting. A different
  // capitalization of their own name is fine.
  const key = data.name.toLowerCase();
  const taken = await env.DB.prepare(`SELECT 1 FROM players WHERE id != ?2 AND (name_key = ?1 OR (lower(name_request) = ?1 AND name_request_no = 0)) LIMIT 1`)
    .bind(key, player.id).first();
  if (taken) return { error: 'taken' };
  await env.DB.prepare('UPDATE players SET name_request = ?2, name_request_at = ?3, name_request_no = 0 WHERE id = ?1')
    .bind(player.id, data.name, Date.now()).run();
  return { request: { name: data.name, state: 'waiting' } };
}

const requestFor = (player) => (player.name_request ? { name: player.name_request, state: player.name_request_no ? 'no' : 'waiting' } : null);

// The admin's answer to a name request, from the dashboard. Only the request the admin saw is
// decided, so one the player changed meanwhile stays waiting. Approving moves the player to the new
// name and keeps their scores.
export async function decideName(env, id, requested, approve) {
  const player = await env.DB.prepare('SELECT id, name, name_request, name_request_no FROM players WHERE id = ?1').bind(id).first();
  if (!player || player.name_request !== requested || player.name_request_no) return { error: 'That request changed. Refresh and look again.' };
  if (!approve) {
    await env.DB.prepare('UPDATE players SET name_request_no = 1 WHERE id = ?1 AND name_request = ?2').bind(id, requested).run();
    return { was: player.name, name: player.name, denied: requested };
  }
  try {
    await env.DB.prepare(`UPDATE players SET name = name_request, name_key = lower(name_request), name_kind = 'own', name_before = COALESCE(name_before, name),
        name_at = ?3, rename_offer = 0, name_request = NULL, name_request_at = NULL, name_request_no = 0 WHERE id = ?1 AND name_request = ?2`)
      .bind(id, requested, Date.now()).run();
  } catch (error) {
    if (/unique/i.test(error.message)) return { error: `Someone else has ${requested} now. Turn it down instead.` };
    throw error;
  }
  return { was: player.name, name: requested };
}

// Ban appeals ----------------------------------------------------------------------------

// A banned player asks for the ban to be lifted. One appeal waits at a time; after a turned-down
// one they can send another.
async function appeal(env, player, data) {
  const text = typeof data.text === 'string' ? data.text.trim().slice(0, APPEAL_MAX) : '';
  if (text.length < 2) return { error: 'empty' };
  if (player.appeal_state === 'waiting') return { error: 'waiting', appeal: appealFor(player) };
  const at = Date.now();
  await env.DB.prepare("UPDATE players SET appeal = ?2, appeal_at = ?3, appeal_state = 'waiting' WHERE id = ?1")
    .bind(player.id, text, at).run();
  return { appeal: { state: 'waiting', at } };
}

const appealFor = (player) => (player.appeal_state ? { state: player.appeal_state, at: player.appeal_at } : null);

// The admin's answer to an appeal, from the dashboard. Only the appeal the admin read is decided.
// Lifting it puts the player back on the boards with their scores; turning it down keeps the ban.
export async function decideAppeal(env, id, at, lift) {
  const player = await env.DB.prepare('SELECT id, name, banned, appeal_at, appeal_state FROM players WHERE id = ?1').bind(id).first();
  if (!player || player.appeal_state !== 'waiting' || player.appeal_at !== at) return { error: 'That appeal changed. Refresh and look again.' };
  await env.DB.prepare(`UPDATE players SET appeal_state = ?3${lift ? ', banned = 0' : ''} WHERE id = ?1 AND appeal_at = ?2`)
    .bind(id, at, lift ? 'yes' : 'no').run();
  return { name: player.name, lifted: lift };
}

// Runs -----------------------------------------------------------------------------------

async function getRun(env, player, day) {
  const run = await env.DB.prepare('SELECT * FROM runs WHERE player = ?1 AND day = ?2').bind(player.id, day).first();
  if (run) run.rounds = JSON.parse(run.rounds);
  return run;
}

const publicRun = (run) => run && {
  round: run.rounds.length,
  score: run.score,
  rounds: run.rounds,
  finished: Boolean(run.finished),
};

// Writes a settled question. Only one write can win, so a double tap can't score twice.
async function settle(env, run, entry) {
  const rounds = [...run.rounds, entry];
  const finished = rounds.length >= PROMPTS_PER_DIVE ? Date.now() : null;
  const result = await env.DB.prepare(`UPDATE runs SET rounds = ?1, score = score + ?2, flags = flags + ?3, served = NULL, deadline = NULL, guesses = 0, finished = ?4
      WHERE player = ?5 AND day = ?6 AND rounds = ?7`)
    .bind(JSON.stringify(rounds), entry.pts, entry.flag ? 1 : 0, finished, run.player, run.day, JSON.stringify(run.rounds)).run();
  if (!result.meta.changes) return false;
  run.rounds = rounds;
  run.score += entry.pts;
  run.served = null;
  run.deadline = null;
  run.guesses = 0;
  run.finished = finished;
  return true;
}

// A question whose time ran out scores 0, even if the player never came back for it.
async function settleIfLate(env, run) {
  if (run.served && Date.now() > run.deadline) await settle(env, run, { tier: -1, pts: 0 });
}

async function status(env, player) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const run = await getRun(env, player, loaded.today);
  if (run) await settleIfLate(env, run);
  return {
    name: player.name,
    today: loaded.today,
    run: publicRun(run),
    paused: Boolean(player.paused),
    rename: player.rename_offer === 2 ? 'forced' : player.rename_offer === 1 ? 'offer' : null,
    nameCheck: needsName(env, player),
    request: requestFor(player),
    appeal: appealFor(player), // a lifted ban says so once
  };
}

async function question(env, player, data) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const day = loaded.today;
  if (data.day !== undefined && data.day !== day) return { error: 'day', today: day };
  // Until they answer the name question they can finish a run they started, but not start one.
  if (needsName(env, player) && !(await getRun(env, player, day))) return { error: 'name' };
  await env.DB.prepare('INSERT INTO runs (player, day) VALUES (?1, ?2) ON CONFLICT (player, day) DO NOTHING').bind(player.id, day).run();
  const run = await getRun(env, player, day);
  await settleIfLate(env, run);
  if (run.rounds.length >= PROMPTS_PER_DIVE) return { day, finished: true, run: publicRun(run) };

  const ids = loaded.calendar.idsFor(day);
  const id = ids[run.rounds.length];
  const prompt = await findPrompt(env, id);
  if (!prompt) throw new Error(`Missing prompt ${id}`);
  if (!run.served) {
    const now = Date.now();
    run.served = now;
    run.deadline = now + (COUNTDOWN + LIMIT) * 1000 + GRACE_MS;
    await env.DB.prepare('UPDATE runs SET served = ?1, deadline = ?2, guesses = 0 WHERE player = ?3 AND day = ?4 AND served IS NULL')
      .bind(run.served, run.deadline, player.id, day).run();
    const fresh = await getRun(env, player, day); // another tab may have served it first
    run.served = fresh.served;
    run.deadline = fresh.deadline;
  }
  return { day, round: run.rounds.length, id, text: prompt.text, msLeft: run.deadline - Date.now() - GRACE_MS, run: publicRun(run) };
}

async function guess(env, player, data, relayed) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const day = loaded.today;
  if (data.day !== day) return { result: 'late', settled: true };
  const run = await getRun(env, player, day);
  if (!run || !run.served || data.round !== run.rounds.length) return { result: 'stale', run: publicRun(run) };
  const now = Date.now();
  if (now > run.deadline + (relayed ? RELAY_GRACE_MS : 0)) {
    await settle(env, run, { tier: -1, pts: 0 });
    return { result: 'late', run: publicRun(run) };
  }
  const typed = cleanTyped(data.typed);
  const final = data.final === true;
  let reason = null; // why the referee's yes didn't count, so the game can say
  const miss = async (result = 'miss') => {
    if (final) {
      await settle(env, run, typed ? { tier: -1, pts: 0, typed } : { tier: -1, pts: 0 });
      return { result, settled: true, run: publicRun(run) };
    }
    return { result, msLeft: run.deadline - Date.now() - GRACE_MS, ...(reason ? { reason } : {}) };
  };
  if (!typed) return miss();
  if (run.guesses >= MAX_GUESSES) return miss();
  await env.DB.prepare('UPDATE runs SET guesses = guesses + 1 WHERE player = ?1 AND day = ?2').bind(player.id, day).run();

  const id = loaded.calendar.idsFor(day)[run.rounds.length];
  const raw = await findPrompt(env, id);
  if (!raw) throw new Error(`Missing prompt ${id}`);
  const prompt = withHiddenAnswer(raw, { mode: 'daily', day }, loaded.calendar.firstDay(id));
  let hit = findAnswer(typed, buildIndex(prompt));
  let checked = false;
  if (!hit && typed.length >= 2) {
    // The clock stops while the referee thinks, the same as in the normal game.
    const started = Date.now();
    const ruling = await judge(env, prompt, typed, { ranked: true });
    const waited = Date.now() - started;
    run.deadline += waited;
    await env.DB.prepare('UPDATE runs SET deadline = deadline + ?1 WHERE player = ?2 AND day = ?3 AND rounds = ?4')
      .bind(waited, player.id, day, JSON.stringify(run.rounds)).run();
    if (ruling.busy) return miss('busy');
    if (ruling.valid) {
      hit = { name: ruling.name, tier: ruling.tier };
      checked = true;
    } else {
      reason = ruling.reason || null;
    }
  }
  if (!hit) return miss();
  const pts = TIERS[hit.tier].pts;
  // The answer is kept with the round so the admin script can show what scored (node admin.mjs answers).
  const entry = { tier: hit.tier, pts, name: hit.name, typed };
  if (checked) entry.ref = 1;
  if (!(await settle(env, run, entry))) return { result: 'stale', run: publicRun(await getRun(env, player, day)) };
  return {
    result: 'hit',
    name: hit.name,
    tier: hit.tier,
    pts,
    checked,
    blurb: hit.tier === 5 ? prompt.gem?.blurb || '' : '',
    run: publicRun(run),
  };
}

// The player left the tab or app during a question, so it scores 0 and is flagged.
async function voidRound(env, player, data) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  if (data.day !== loaded.today) return { ok: false };
  const run = await getRun(env, player, loaded.today);
  if (!run || !run.served || data.round !== run.rounds.length) return { ok: false, run: publicRun(run) };
  await settle(env, run, { tier: -1, pts: 0, flag: 1 });
  return { ok: true, run: publicRun(run) };
}

// Boards ---------------------------------------------------------------------------------

// Ties share a rank. Finished runs count, and so does any run from an earlier day, so quitting a
// bad dive halfway doesn't keep it off the board.
function ranked_(rows, key) {
  let rank = 0;
  let last = null;
  return rows.map((row, i) => {
    if (row[key] !== last) {
      rank = i + 1;
      last = row[key];
    }
    return { rank, name: row.name, score: row[key] };
  });
}

// Banned and paused players stay off the boards, and so does a nickname that has to change.
const ON_BOARD = 'p.banned = 0 AND p.paused = 0 AND p.rename_offer < 2';

async function board(env, data) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const { today, calendar } = loaded;
  const day = Number.isInteger(data.day) && data.day >= 1 && data.day <= today ? data.day : today;
  const me = typeof data.key === 'string' ? await playerFor(env, data.key) : null;
  const counts = day < today ? '1' : 'r.finished IS NOT NULL';

  const dayRows = (await env.DB.prepare(`SELECT p.id, p.name, r.score FROM runs r JOIN players p ON p.id = r.player
      WHERE r.day = ?1 AND ${ON_BOARD} AND ${counts} ORDER BY r.score DESC, r.finished ASC`).bind(day).all()).results;

  // Weeks start on Monday.
  const weekday = (calendar.dateOf(day).getDay() + 6) % 7;
  const start = day - weekday;
  const end = Math.min(start + 6, today);
  const weekRows = (await env.DB.prepare(`SELECT p.id, p.name, SUM(r.score) AS total FROM runs r JOIN players p ON p.id = r.player
      WHERE r.day BETWEEN ?1 AND ?2 AND ${ON_BOARD} AND (r.day < ?3 OR r.finished IS NOT NULL)
      GROUP BY p.id ORDER BY total DESC, MIN(r.finished) ASC`).bind(start, end, today).all()).results;

  const day_ = ranked_(dayRows, 'score');
  const week = ranked_(weekRows, 'total');
  const mine = (rows, list) => {
    if (!me) return null;
    const i = rows.findIndex((row) => row.id === me.id);
    return i < 0 ? null : list[i];
  };
  return {
    day,
    today,
    week: { from: start, to: start + 6 },
    // Every score on the day's board, for the score curve. Scores only, no names.
    daily: { players: day_.length, top: day_.slice(0, BOARD_SIZE), me: mine(dayRows, day_), scores: dayRows.map((row) => row.score) },
    weekly: { players: week.length, top: week.slice(0, BOARD_SIZE), me: mine(weekRows, week) },
  };
}
