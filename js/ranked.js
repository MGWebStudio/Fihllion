// Ranked mode's side of the conversation with the server (worker/src/ranked.js). The nickname and
// the secret key that owns it live on this device only. The server runs ranked dives: it sends each
// question, keeps the clock and scores every answer.
import * as store from './store.js';
import { HAS_SERVER, post, addressNow } from './server.js';

const TIMEOUT_MS = 12000; // long enough for the referee, which can take a few seconds

export const available = HAS_SERVER;
export const player = () => store.get('ranked.player', null); // { name, key }
export const forget = () => store.remove('ranked.player');

async function call(action, body = {}) {
  const res = await post(`/ranked/${action}`, body, { timeout: TIMEOUT_MS });
  if (!res.ok) throw new Error(`ranked ${action}: ${res.status}`);
  return res.json();
}

const withKey = (body = {}) => ({ ...body, key: player()?.key });

// Resolves to { name } or { error: 'invalid' | 'blocked' | 'taken' }.
export async function join(name) {
  const result = await call('join', { name });
  if (result.key) store.set('ranked.player', { name: result.name, key: result.key });
  return result;
}

export const status = () => call('status', withKey());
// `day` is the Daily this page is playing. If midnight passed, the server says so instead of starting
// the next day's dive early.
export const question = (day) => call('question', withKey({ day }));
export const guess = (day, round, typed, final = false) => call('guess', withKey({ day, round, typed, final }));
export const board = (day) => call('board', withKey(day ? { day } : {}));

// Sent as the page hides, so it has to survive the tab closing.
export function voidRound(day, round) {
  const body = JSON.stringify(withKey({ day, round }));
  const url = `${addressNow()}/ranked/void`;
  if (navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
}
