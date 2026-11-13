// Where the game's small server (worker/) lives: the answer counter, the AI referee and ranked mode.
// It has two addresses because some networks, school Wi-Fi filters mostly, block workers.dev. The
// pages.dev one (relay/) hands everything to the same server. The game asks both and uses whichever
// answers. On this PC the game talks to a local copy started with `npm run dev` in worker/.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const ADDRESSES = IS_LOCAL
  ? ['http://localhost:8787']
  : ['https://fihllion-counts.mgstudiogame.workers.dev', 'https://fihllion-api.pages.dev'];

export const HAS_SERVER = ADDRESSES.length > 0;

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

// Asks every address at once and settles on the first to answer. Resolves to null when none do,
// and the next call asks again.
export function findServer() {
  if (current) return Promise.resolve(current);
  if (!finding) {
    finding = new Promise((resolve) => {
      let left = ADDRESSES.length;
      const heard = (base) => {
        if (base) resolve(base);
        else if (--left === 0) resolve(null);
      };
      for (const base of ADDRESSES) {
        fetch(`${base}/health`, { cache: 'no-store', signal: timeoutSignal(8000) })
          .then((res) => res.ok && res.text())
          .then((text) => heard(text === 'ok' ? base : null), () => heard(null));
      }
    });
    finding.then((base) => {
      current = base;
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

// POSTs JSON as text/plain, a simple request, so there's no preflight round trip. If the address
// in use stops answering, it finds one that does and tries once more. A timeout isn't retried:
// the server may still be working on it.
export async function post(path, body, { timeout = 12000, keepalive = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    const base = await findServer();
    if (!base) throw new Unreachable();
    try {
      return await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        signal: timeoutSignal(timeout),
        keepalive,
      });
    } catch (error) {
      if (attempt > 0 || error.name === 'AbortError' || error.name === 'TimeoutError') throw error;
      if (current === base) current = null;
    }
  }
}

// For sendBeacon, which can't wait to find an address: the one in use, or the first.
export const addressNow = () => current || ADDRESSES[0];
