// Fihllion's small server: an anonymous answer counter, an AI referee and ranked mode.
//
// Counter: the game sends each finished Daily dive once. For every prompt the player was meeting
// for the first time, it sends the answer it matched, or what they typed if nothing matched. Only
// running totals are stored. There are no IP addresses, player IDs or timestamps.
//
// Referee: when a typed answer isn't on a prompt's list, the game asks whether it's a real, correct
// answer anyway. A free Workers AI model decides, and every verdict is saved so the same guess gets
// the same ruling for everyone without asking the model again. A daily cap keeps it inside the
// free allowance. When the cap is hit or the model fails, the answer simply doesn't count.
//
// Ranked: see ranked.js.
//
//   POST /dive    {"day": 5, "rounds": [{"id": "lizard", "name": "Gecko"}, {"id": "bank", "typed": "..."}]}
//   POST /check   {"prompt": "lizard", "typed": "shingleback"}  ->  {"valid": true, "name": "Shingleback", "tier": 3}
//   POST /ranked/...  see ranked.js
//   GET  /health
import { MAX_NAME, utcToday, parseJSON, cleanTyped, fetchJSON, findPrompt, judge } from './shared.js';
import { ranked } from './ranked.js';

const MAX_BODY = 4096;
const MAX_ROUNDS = 7;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = allowedOrigin(origin, env);
    const cors = allowed
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : { Vary: 'Origin' };
    const reply = (status, body = null) => new Response(body, { status, headers: cors });
    const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (url.pathname === '/health') return reply(200, 'ok');
    const isRanked = url.pathname.startsWith('/ranked/');
    if (url.pathname !== '/dive' && url.pathname !== '/check' && !isRanked) return reply(404, 'Not found');
    if (request.method === 'OPTIONS') return reply(allowed ? 204 : 403);
    if (request.method !== 'POST') return reply(405, 'Use POST');
    if (!allowed) return reply(403, 'Unknown origin');

    let text;
    try {
      text = await readBody(request);
    } catch (error) {
      return reply(400, error.message);
    }
    if (url.pathname === '/check') return referee(text, env, reply, json);
    if (isRanked) return ranked(url.pathname.slice('/ranked/'.length), text, env, reply, json);

    let dive;
    try {
      dive = parseDive(text);
    } catch (error) {
      return reply(400, error.message);
    }
    const schedule = await fetchJSON(`${env.DATA_URL}schedule.json`);
    if (!schedule) return reply(503, 'Schedule unavailable');
    const problem = checkDive(dive, schedule, env);
    if (problem) return reply(400, problem);

    await env.DB.batch(diveStatements(env.DB, dive));
    return reply(204);
  },
};

function allowedOrigin(origin, env) {
  if (!origin) return false;
  return String(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).includes(origin);
}

async function readBody(request) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY) throw new Error('Too big');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('Too big');
  return text;
}

// Counter --------------------------------------------------------------------------------

// Turns the request into { day, rounds: [{ id, name }|{ id, typed }] }, trimming anything oversized.
function parseDive(text) {
  const data = parseJSON(text);
  if (!data || !Number.isInteger(data.day) || !Array.isArray(data.rounds)) throw new Error('Wrong shape');
  if (data.rounds.length < 1 || data.rounds.length > MAX_ROUNDS) throw new Error('Wrong number of rounds');
  const rounds = data.rounds.map((round) => {
    if (!round || typeof round.id !== 'string') throw new Error('Round without a prompt');
    if (typeof round.name === 'string' && round.name.trim()) return { id: round.id, name: round.name.trim().slice(0, MAX_NAME) };
    return { id: round.id, typed: cleanTyped(round.typed) };
  });
  return { day: data.day, rounds };
}

// Accepts only a recent day, only that day's own prompts, and each prompt once. Days past the end of
// the schedule repeat earlier prompts, so they aren't counted.
function checkDive(dive, schedule, env) {
  if (env.ANY_DAY !== '1' && Math.abs(dive.day - utcToday()) > 1) return 'Not a current day';
  if (dive.day < 1 || dive.day > schedule.days.length) return 'Not a scheduled day';
  const ids = new Set(schedule.days[dive.day - 1]);
  const seen = new Set();
  for (const round of dive.rounds) {
    if (!ids.has(round.id)) return 'Prompt not in that day';
    if (seen.has(round.id)) return 'Prompt sent twice';
    seen.add(round.id);
  }
  return null;
}

function diveStatements(db, dive) {
  const out = [db.prepare('INSERT INTO dives (day, n) VALUES (?1, 1) ON CONFLICT (day) DO UPDATE SET n = n + 1').bind(dive.day)];
  const play = db.prepare('INSERT INTO plays (prompt, n) VALUES (?1, 1) ON CONFLICT (prompt) DO UPDATE SET n = n + 1');
  const pick = db.prepare('INSERT INTO picks (prompt, answer, n) VALUES (?1, ?2, 1) ON CONFLICT (prompt, answer) DO UPDATE SET n = n + 1');
  const miss = db.prepare('INSERT INTO misses (prompt, typed, n) VALUES (?1, ?2, 1) ON CONFLICT (prompt, typed) DO UPDATE SET n = n + 1');
  for (const round of dive.rounds) {
    out.push(play.bind(round.id));
    if (round.name) out.push(pick.bind(round.id, round.name));
    else if (round.typed) out.push(miss.bind(round.id, round.typed));
  }
  return out;
}

// Referee --------------------------------------------------------------------------------

async function referee(text, env, reply, json) {
  let data;
  try {
    data = parseJSON(text);
  } catch (error) {
    return reply(400, error.message);
  }
  const typed = cleanTyped(data?.typed);
  if (typeof data?.prompt !== 'string' || typed.length < 2) return reply(400, 'Wrong shape');
  const prompt = await findPrompt(env, data.prompt);
  if (!prompt) return reply(400, 'Unknown prompt');
  const local = env.ANY_DAY === '1'; // test switches, only on this PC
  const ruling = await judge(env, prompt, typed, local ? { nobank: data.nobank, nocache: data.nocache, model: data.model } : {});
  if (ruling.busy) return json({ valid: false, busy: true });
  const extra = local ? ruling.debug || {} : {};
  return json(ruling.valid ? { valid: true, name: ruling.name, tier: ruling.tier, ...extra } : { valid: false, ...extra });
}
