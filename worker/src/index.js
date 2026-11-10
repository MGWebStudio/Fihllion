// Counts Daily answers for Fihllion, anonymously.
//
// The game sends each finished Daily dive once: for every prompt the player was meeting for the
// first time, the answer it matched, or what they typed if nothing matched. Only running totals are
// stored. There are no IP addresses, player IDs or timestamps, so no answer can be traced to anyone.
//
//   POST /dive   {"day": 5, "rounds": [{"id": "lizard", "name": "Gecko"}, {"id": "bank", "typed": "..."}]}
//   GET  /health

const EPOCH = Date.UTC(2026, 10, 3); // Day 1, the same epoch as data/schedule.json
const DAY_MS = 86400000;
const MAX_BODY = 4096;
const MAX_ROUNDS = 7;
const MAX_NAME = 100;
const MAX_TYPED = 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = allowedOrigin(origin, env);
    const cors = allowed
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : { Vary: 'Origin' };
    const reply = (status, body = null) => new Response(body, { status, headers: cors });

    if (url.pathname === '/health') return reply(200, 'ok');
    if (url.pathname !== '/dive') return reply(404, 'Not found');
    if (request.method === 'OPTIONS') return reply(allowed ? 204 : 403);
    if (request.method !== 'POST') return reply(405, 'Use POST');
    if (!allowed) return reply(403, 'Unknown origin');

    let dive;
    try {
      dive = parse(await readBody(request));
    } catch (error) {
      return reply(400, error.message);
    }
    const schedule = await loadSchedule(env);
    if (!schedule) return reply(503, 'Schedule unavailable');
    const problem = check(dive, schedule, env);
    if (problem) return reply(400, problem);

    await env.DB.batch(statements(env.DB, dive));
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

// Turns the request into { day, rounds: [{ id, name }|{ id, typed }] }, trimming anything oversized.
function parse(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not JSON');
  }
  if (!data || !Number.isInteger(data.day) || !Array.isArray(data.rounds)) throw new Error('Wrong shape');
  if (data.rounds.length < 1 || data.rounds.length > MAX_ROUNDS) throw new Error('Wrong number of rounds');
  const rounds = data.rounds.map((round) => {
    if (!round || typeof round.id !== 'string') throw new Error('Round without a prompt');
    if (typeof round.name === 'string' && round.name.trim()) return { id: round.id, name: round.name.trim().slice(0, MAX_NAME) };
    return { id: round.id, typed: cleanTyped(round.typed) };
  });
  return { day: data.day, rounds };
}

// Lowercase, single spaces and a length cap, so "  GECKO " and "gecko" count together.
function cleanTyped(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_TYPED);
}

async function loadSchedule(env) {
  try {
    const res = await fetch(env.SCHEDULE_URL, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Accepts only a recent day, only that day's own prompts, and each prompt once. Days past the end of
// the schedule repeat earlier prompts, so they aren't counted.
function check(dive, schedule, env) {
  const today = Math.floor((Date.now() - EPOCH) / DAY_MS) + 1;
  if (env.ANY_DAY !== '1' && Math.abs(dive.day - today) > 1) return 'Not a current day';
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

function statements(db, dive) {
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
