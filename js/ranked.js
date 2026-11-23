// Ranked mode's side of the conversation with the server (worker/src/ranked.js). The nickname and
// the secret key that owns it live on this device only. The server runs ranked dives: it sends each
// question, keeps the clock and scores every answer.
import * as store from './store.js';
import { HAS_SERVER, post, urlNow } from './server.js';

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

// The player's own name, or `anonymous: true` for a name like anonymous482 picked by the server.
// Resolves to { name } or { error: 'invalid' | 'blocked' | 'anon' | 'taken' }.
export async function join(name, { anonymous = false } = {}) {
  const result = await call('join', anonymous ? { anonymous: true } : { name });
  if (result.key) store.set('ranked.player', { name: result.name, key: result.key });
  return result;
}

export const status = () => call('status', withKey());

// A new name for the name question (real name or anonymous), or when the admin offered or required
// one. The scores stay with the key.
export async function rename(name, { anonymous = false } = {}) {
  const result = await call('rename', withKey(anonymous ? { anonymous: true } : { name }));
  if (result.name && !result.error) store.set('ranked.player', { ...player(), name: result.name });
  return result;
}
export const keepName = () => call('rename', withKey({ keep: true }));

// Asks for a different name on the boards, from the leaderboard. It changes once the admin approves
// it. Resolves to { request: { name, state: 'waiting' } } or { error }; cancelling to { request: null }.
export const requestName = (name) => call('request', withKey({ name }));
export const cancelRequest = () => call('request', withKey({ cancel: true }));

// A banned player asks for the ban to be lifted. Resolves to { appeal: { state: 'waiting', at } } or
// { error: 'empty' | 'waiting' | 'not-banned' }.
export const appeal = (text) => call('appeal', withKey({ text }));

// The server's name wins, so a nickname the admin changed shows up on this device too.
export function syncName(name) {
  const me = player();
  if (me && name && me.name !== name) store.set('ranked.player', { ...me, name });
}
// `day` is the Daily this page is playing. If midnight passed, the server says so instead of starting
// the next day's dive early.
export const question = (day) => call('question', withKey({ day }));
export const guess = (day, round, typed, final = false) => call('guess', withKey({ day, round, typed, final }));
export const board = (day) => call('board', withKey(day ? { day } : {}));

// Sent as the page hides, so it has to survive the tab closing.
export function voidRound(day, round) {
  const body = JSON.stringify(withKey({ day, round }));
  const url = urlNow('/ranked/void');
  if (navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
}
