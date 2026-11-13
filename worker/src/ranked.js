// Ranked mode. A player picks a nickname, and from then on their Daily is a ranked run, one try a day.
// The server runs the dive: it sends one question at a time, keeps its own clock, and scores every
// answer itself with the answer lists and the referee, so editing the page can't change a score.
// Days are Mountain Time, the same as the Daily.
//
//   POST /ranked/join      {"name": "Goldie"}                    -> {"name": "Goldie", "key": "..."}
//   POST /ranked/status    {"key": "..."}                        -> {"name", "today", "run": {...}|null}
//   POST /ranked/question  {"key": "..."}                        -> {"day", "round", "id", "text", "msLeft"} or {"finished": true}
//   POST /ranked/guess     {"key", "round", "typed", "final"}    -> {"result": "hit"|"miss"|"late"|"busy", ...}
//   POST /ranked/void      {"key", "round"}                      -> the question scores 0, flagged (they left the tab)
//   POST /ranked/board     {"key"?, "day"?}                      -> today's and this week's boards
import { COUNTDOWN, LIMIT, PROMPTS_PER_DIVE, TIERS, withHiddenAnswer } from '../../js/content.js';
import { buildIndex, findAnswer } from '../../js/match.js';
import { parseJSON, cleanTyped, loadCalendar, findPrompt, judge } from './shared.js';

const GRACE_MS = 2500; // network time on top of the clock the player sees
const MAX_GUESSES = 40; // per question
const BOARD_SIZE = 100;

export async function ranked(action, text, env, reply, json) {
  let data;
  try {
    data = parseJSON(text) || {};
  } catch (error) {
    return reply(400, error.message);
  }
  try {
    if (action === 'join') return json(await join(env, data.name));
    if (action === 'board') return json(await board(env, data));
    const player = await playerFor(env, data.key);
    if (!player) return json({ error: 'unknown' });
    if (player.banned) return json({ error: 'banned' });
    if (action === 'status') return json(await status(env, player));
    if (action === 'question') return json(await question(env, player, data));
    if (action === 'guess') return json(await guess(env, player, data));
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
const ANYWHERE = ['fuck', 'fuk', 'fck', 'shit', 'cunt', 'nigg', 'niga', 'fag', 'bitch', 'whore', 'slut', 'porn', 'penis', 'vagina', 'pussy', 'dildo', 'nazi', 'hitler', 'rapist', 'retard', 'molest', 'pedo', 'jizz', 'wank', 'twat', 'kkk', 'horny', 'boob', 'dick', 'cock', 'tits', 'butthole', 'asshole', 'dumbass', 'jackass', 'sexy', 'cum4', 'hooker'];
// Blocked as the whole name (numbers on the end don't help), since they hide inside real words.
const WHOLE = ['ass', 'anal', 'anus', 'sex', 'rape', 'crap', 'hoe', 'hoes', 'cum', 'tit', 'gay', 'damn', 'piss', 'butt', 'poop', 'pee', 'nut', 'nuts', 'balls'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };
const collapse = (word) => word.replace(/(.)\1+/g, '$1');

export function nameProblem(name) {
  if (typeof name !== 'string' || !NAME.test(name)) return 'invalid';
  const plain = name.toLowerCase().replace(/[0-9]/g, (digit) => LEET[digit] ?? digit);
  const letters = name.toLowerCase().replace(/[0-9]+$/, '').replace(/[0-9]/g, (digit) => LEET[digit] ?? digit);
  if (RESERVED.includes(letters)) return 'blocked';
  for (const word of ANYWHERE) {
    if (plain.includes(word)) return 'blocked';
    if (collapse(word) === word && collapse(plain).includes(word)) return 'blocked';
  }
  for (const word of WHOLE) if (letters === word || collapse(letters) === collapse(word)) return 'blocked';
  return null;
}

async function sha256(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function join(env, name) {
  const problem = nameProblem(name);
  if (problem) return { error: problem };
  const loaded = await loadCalendar(env);
  const key = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const result = await env.DB.prepare('INSERT INTO players (name, name_key, key_hash, created) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (name_key) DO NOTHING')
    .bind(name, name.toLowerCase(), await sha256(key), loaded?.today ?? 0).run();
  if (!result.meta.changes) return { error: 'taken' };
  return { name, key };
}

async function playerFor(env, key) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 100) return null;
  return env.DB.prepare('SELECT id, name, banned FROM players WHERE key_hash = ?1').bind(await sha256(key)).first();
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
  return { name: player.name, today: loaded.today, run: publicRun(run) };
}

async function question(env, player, data) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const day = loaded.today;
  if (data.day !== undefined && data.day !== day) return { error: 'day', today: day };
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

async function guess(env, player, data) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const day = loaded.today;
  if (data.day !== day) return { result: 'late', settled: true };
  const run = await getRun(env, player, day);
  if (!run || !run.served || data.round !== run.rounds.length) return { result: 'stale', run: publicRun(run) };
  const now = Date.now();
  if (now > run.deadline) {
    await settle(env, run, { tier: -1, pts: 0 });
    return { result: 'late', run: publicRun(run) };
  }
  const typed = cleanTyped(data.typed);
  const final = data.final === true;
  const miss = async (result = 'miss') => {
    if (final) {
      await settle(env, run, { tier: -1, pts: 0 });
      return { result, settled: true, run: publicRun(run) };
    }
    return { result, msLeft: run.deadline - Date.now() - GRACE_MS };
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
    const ruling = await judge(env, prompt, typed);
    const waited = Date.now() - started;
    run.deadline += waited;
    await env.DB.prepare('UPDATE runs SET deadline = deadline + ?1 WHERE player = ?2 AND day = ?3 AND rounds = ?4')
      .bind(waited, player.id, day, JSON.stringify(run.rounds)).run();
    if (ruling.busy) return miss('busy');
    if (ruling.valid) {
      hit = { name: ruling.name, tier: ruling.tier };
      checked = true;
    }
  }
  if (!hit) return miss();
  const pts = TIERS[hit.tier].pts;
  if (!(await settle(env, run, { tier: hit.tier, pts }))) return { result: 'stale', run: publicRun(await getRun(env, player, day)) };
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

async function board(env, data) {
  const loaded = await loadCalendar(env);
  if (!loaded) throw new Error('Schedule unavailable');
  const { today, calendar } = loaded;
  const day = Number.isInteger(data.day) && data.day >= 1 && data.day <= today ? data.day : today;
  const me = typeof data.key === 'string' ? await playerFor(env, data.key) : null;
  const counts = day < today ? '1' : 'r.finished IS NOT NULL';

  const dayRows = (await env.DB.prepare(`SELECT p.id, p.name, r.score FROM runs r JOIN players p ON p.id = r.player
      WHERE r.day = ?1 AND p.banned = 0 AND ${counts} ORDER BY r.score DESC, r.finished ASC`).bind(day).all()).results;

  // Weeks start on Monday.
  const weekday = (calendar.dateOf(day).getDay() + 6) % 7;
  const start = day - weekday;
  const end = Math.min(start + 6, today);
  const weekRows = (await env.DB.prepare(`SELECT p.id, p.name, SUM(r.score) AS total FROM runs r JOIN players p ON p.id = r.player
      WHERE r.day BETWEEN ?1 AND ?2 AND p.banned = 0 AND (r.day < ?3 OR r.finished IS NOT NULL)
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
    daily: { players: day_.length, top: day_.slice(0, BOARD_SIZE), me: mine(dayRows, day_) },
    weekly: { players: week.length, top: week.slice(0, BOARD_SIZE), me: mine(weekRows, week) },
  };
}
