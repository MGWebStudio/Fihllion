// Where the game's small server (worker/) lives: the answer counter, the AI referee and ranked mode.
// School filters (Securly, at least) block both of its own addresses, workers.dev and pages.dev
// (relay/), so there's a third way in: a Google Apps Script relay (relay/google-apps-script.js),
// since Google gets through. The game asks the server's own addresses first and only tries the
// Google relay, which is slower and has a daily limit, when neither answers. On this PC the game
// talks to a local copy started with `npm run dev` in worker/.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const GOOGLE_RELAY = 'https://script.google.com/macros/s/AKfycbyU4JcIVZqJW5G2wCNFJ1KEtlMlU6DxxMPhKTXdUxqN1Tu3Gz-midM5QOkiQLOuF46F/exec';
const DIRECT = IS_LOCAL
  ? ['http://localhost:8787']
  : ['https://fihllion-counts.mgstudiogame.workers.dev', 'https://fihllion-api.pages.dev'];
const RELAYS = IS_LOCAL ? [] : [GOOGLE_RELAY].filter(Boolean);

// The relay takes the path as ?path=, and adds a hop each way.
const direct = (base) => ({ base, relay: false, url: (path) => `${base}${path}` });
const relay = (base) => ({ base, relay: true, url: (path) => (path === '/health' ? base : `${base}?path=${encodeURIComponent(path)}`) });
const STAGES = [DIRECT.map(direct), RELAYS.map(relay)].filter((stage) => stage.length);
const RELAY_EXTRA_MS = 6000;

export const HAS_SERVER = STAGES.length > 0;

// AbortSignal.timeout is missing before Chrome 103 and Safari 16, which older Chromebooks and
// iPhones still run.
export function timeoutSignal(ms) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

let current = null; // the address in use
let finding = null;

// Asks every address in a stage at once and takes the first to answer.
function firstToAnswer(stage) {
  return new Promise((resolve) => {
    let left = stage.length;
    const heard = (address) => {
      if (address) resolve(address);
      else if (--left === 0) resolve(null);
    };
    for (const address of stage) {
      fetch(address.url('/health'), { cache: 'no-store', signal: timeoutSignal(address.relay ? 15000 : 8000) })
        .then((res) => res.ok && res.text())
        .then((text) => heard(text === 'ok' ? address : null), () => heard(null));
    }
  });
}

// Settles on an address that answers, trying the server's own addresses before the relay.
// Resolves to null when nothing does, and the next call asks again.
export function findServer() {
  if (current) return Promise.resolve(current);
  if (!finding) {
    finding = (async () => {
      for (const stage of STAGES) {
        const address = await firstToAnswer(stage);
        if (address) return address;
      }
      return null;
    })();
    finding.then((address) => {
      current = address;
      finding = null;
    });
  }
  return finding;
}

// Thrown when no address answers, so the game can say it's the network and not the player.
export class Unreachable extends Error {
  constructor() {
    super('No server address answered');
    this.name = 'Unreachable';
  }
}

// The relay always answers 200 with {"s": status, "b": body}. This turns that back into the
// server's own reply, so callers can't tell the difference.
async function unwrap(res) {
  const reply = await res.json();
  if (!reply || !Number.isInteger(reply.s)) throw new TypeError('Relay sent something unexpected');
  return new Response([204, 205, 304].includes(reply.s) ? null : reply.b, { status: reply.s });
}

// POSTs JSON as text/plain, a simple request, so there's no preflight round trip. If the address
// in use stops answering, it finds one that does and tries once more. A timeout isn't retried:
// the server may still be working on it.
export async function post(path, body, { timeout = 12000, keepalive = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    const address = await findServer();
    if (!address) throw new Unreachable();
    try {
      const res = await fetch(address.url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        signal: timeoutSignal(timeout + (address.relay ? RELAY_EXTRA_MS : 0)),
        keepalive,
      });
      return address.relay ? await unwrap(res) : res;
    } catch (error) {
      if (attempt > 0 || error.name === 'AbortError' || error.name === 'TimeoutError') throw error;
      if (current === address) current = null;
    }
  }
}

// For sendBeacon, which can't wait to find an address: the one in use, or the first.
export const urlNow = (path) => (current || STAGES[0][0]).url(path);
