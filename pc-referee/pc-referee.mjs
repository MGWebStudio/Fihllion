// The PC referee: lets this computer answer Fihllion's referee checks with Ollama, for free.
// It connects out to the game's server and keeps that one connection open; the server sends checks
// down it. Nothing on this computer is opened to the internet, and Ollama stays private to it.
// The server falls back to Cloudflare's model whenever this isn't running, so closing it is fine.
//
//   node pc-referee.mjs            answer checks for the live game
//   node pc-referee.mjs --local    answer checks for the test server on this PC (wrangler dev)
//   node pc-referee.mjs new-key    make the key this computer and the server share (once)
//
// While it runs, type p and Enter to pause (frees the graphics card for games), r to resume,
// or q to quit.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const local = args.includes('--local');
const MODEL = 'qwen3:30b-a3b'; // the model Cloudflare's referee ran until Cloudflare retired it (Nov 20, 2026)
const OLLAMA = 'http://127.0.0.1:11434';
const SERVER = local ? 'ws://localhost:8787/pc/connect' : 'wss://fihllion-counts.mgstudiogame.workers.dev/pc/connect';
const KEY_FILE = join(here, 'key.txt');
const KEEP_LOADED = '6h'; // how long Ollama keeps the model on the graphics card after the last check
const MAX_WAITING = 6; // more checks than this waiting, and the rest go to Cloudflare's model
const PING_MS = 30000;

const log = (text) => console.log(`${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}  ${text}`);

if (args[0] === 'new-key') {
  if (existsSync(KEY_FILE)) {
    console.log('pc-referee/key.txt already exists. Delete it first to make a new one (then give the server the new one too).');
    process.exit(1);
  }
  writeFileSync(KEY_FILE, randomBytes(32).toString('hex'));
  console.log('Made pc-referee/key.txt. Now give the server the same key, from the worker folder:');
  console.log('  Get-Content ..\\pc-referee\\key.txt | node node_modules/wrangler/bin/wrangler.js secret put PC_REFEREE_KEY');
  process.exit(0);
}

function readKey() {
  if (local) {
    const vars = readFileSync(join(here, '..', 'worker', '.dev.vars'), 'utf8');
    return vars.match(/^PC_REFEREE_KEY=(.+)$/m)?.[1].trim();
  }
  if (!existsSync(KEY_FILE)) {
    console.log('No key yet. Run: node pc-referee.mjs new-key');
    process.exit(1);
  }
  return readFileSync(KEY_FILE, 'utf8').trim();
}
const key = readKey();

// Ollama ---------------------------------------------------------------------------------

async function ollama(path, body, timeoutMs = 120000) {
  const res = await fetch(`${OLLAMA}${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Ollama said ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function ollamaReady() {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const { models = [] } = await res.json();
    return models.some((model) => model.name === MODEL) ? 'ok' : 'missing';
  } catch {
    return 'down';
  }
}

// The referee's reply, held to this shape. Without it, this Ollama version writes out its reasoning
// first even with thinking off, which took over 2 seconds a check instead of under 1 (Nov 20, 2026).
const VERDICT = {
  type: 'object',
  properties: { valid: { type: 'boolean' }, name: { type: 'string' }, fame: { type: 'integer', enum: [1, 2, 3] } },
  required: ['valid', 'name', 'fame'],
};

// Tried and dropped (Nov 20, 2026, on the hard set of 107 answers): any JSON shape (same results, but
// sometimes unreadable) and the model's chat format written out by hand with an empty thinking
// block (turned down two real answers).
async function judge(messages, timeoutMs = 20000) {
  const started = Date.now();
  const data = await ollama('/api/chat', {
    model: MODEL,
    messages,
    stream: false,
    think: false,
    format: VERDICT,
    keep_alive: KEEP_LOADED,
    options: { temperature: 0, num_predict: 120 },
  }, timeoutMs);
  return { text: data.message?.content || '', ms: Date.now() - started };
}

// Loads the model and asks it one throwaway question, since the first answer after loading is slow.
const loadModel = () => judge([
  { role: 'system', content: 'Reply with JSON.' },
  { role: 'user', content: 'Is "Delta Air Lines" an airline? /no_think' },
], 180000);
const unloadModel = () => ollama('/api/generate', { model: MODEL, keep_alive: 0 }, 15000);

// Only the referee's own two messages are passed to the model.
const looksRight = (messages) => Array.isArray(messages) && messages.length === 2
  && messages.every((m) => m && ['system', 'user'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 8000);

// The connection ---------------------------------------------------------------------------

let socket = null;
let paused = false;
let retryMs = 2000;
const waiting = [];
let working = false;
let answered = 0;
let failed = 0;
let totalMs = 0;

const send = (data) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(typeof data === 'string' ? data : JSON.stringify(data));
};

// One check at a time, since the graphics card runs one at a time anyway.
async function work() {
  if (working) return;
  working = true;
  while (waiting.length) {
    const job = waiting.shift();
    let reply;
    try {
      reply = paused ? { error: 'Paused' } : await judge(job.messages);
    } catch (error) {
      reply = { error: String(error.message || error) };
    }
    if (reply.error) {
      failed += 1;
      log(`A check failed: ${reply.error}`);
    } else {
      answered += 1;
      totalMs += reply.ms;
      if (answered === 1 || answered % 25 === 0) log(`${answered === 1 ? "First check" : `${answered} checks`} answered, ${Math.round(totalMs / answered)} ms on average.`);
    }
    send({ type: 'result', id: job.id, ...reply });
  }
  working = false;
}

function connect() {
  const ws = new WebSocket(SERVER);
  socket = ws;
  let pinger = null;
  let lastPong = Date.now();
  ws.addEventListener('open', () => send({ type: 'hello', key, model: MODEL }));
  ws.addEventListener('message', (event) => {
    if (event.data === 'pong') {
      lastPong = Date.now();
      return;
    }
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.type === 'ready') {
      retryMs = 2000;
      log(`Connected to ${local ? 'the test server' : 'the game'}. ${paused ? 'Paused (type r to resume).' : 'Answering checks.'}`);
      if (paused) send({ type: 'pause' });
      clearInterval(pinger);
      lastPong = Date.now();
      pinger = setInterval(() => {
        // No pong for two pings: the connection died without saying so.
        if (Date.now() - lastPong > PING_MS * 2 + 5000) ws.close();
        else send('ping');
      }, PING_MS);
    } else if (data.type === 'job') {
      if (typeof data.id !== 'string' || !looksRight(data.messages)) return;
      if (waiting.length >= MAX_WAITING) return send({ type: 'result', id: data.id, error: 'Busy' });
      waiting.push(data);
      work();
    }
  });
  ws.addEventListener('close', (event) => {
    clearInterval(pinger);
    if (socket !== ws) return;
    if (event.code === 4001) {
      log('The server didn’t accept the key. Check that it has the same one as pc-referee/key.txt.');
      process.exit(1);
    }
    log(`Not connected (${event.code || 'no answer'}). Trying again in ${retryMs / 1000} s.`);
    setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 60000);
  });
  ws.addEventListener('error', () => {}); // a close always follows
}

// Keys -----------------------------------------------------------------------------------

createInterface({ input: process.stdin }).on('line', async (line) => {
  const command = line.trim().toLowerCase();
  if (command === 'p' && !paused) {
    paused = true;
    send({ type: 'pause' });
    await unloadModel().catch(() => {});
    log('Paused. The game uses Cloudflare’s referee, and the graphics card is free. Type r to resume.');
  } else if (command === 'r' && paused) {
    log('Loading the model again...');
    await loadModel().catch((error) => log(`Couldn’t load it: ${error.message}`));
    paused = false;
    send({ type: 'resume' });
    log('Answering checks again.');
  } else if (command === 'q') {
    log(`Stopping. ${answered} checks answered, ${failed} failed.`);
    socket?.close(1000, 'Quit');
    process.exit(0);
  }
});

// Start ------------------------------------------------------------------------------------

const ready = await ollamaReady();
if (ready === 'down') {
  console.log('Ollama isn’t running. Start it (it’s in the Start menu), then run this again.');
  process.exit(1);
}
if (ready === 'missing') {
  console.log(`Ollama doesn’t have ${MODEL}. Run: ollama pull ${MODEL}`);
  process.exit(1);
}
log(`Loading ${MODEL} onto the graphics card...`);
await loadModel();
log('Loaded. Type p and Enter to pause, r to resume, q to quit.');
connect();
