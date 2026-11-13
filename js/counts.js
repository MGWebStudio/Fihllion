// Sends each finished Daily dive to the anonymous answer counter (worker/), once.
//
// Only prompts the player is meeting for the first time count, so the totals measure what people
// think of cold, not what they remember. Archive replays and Endless are never sent. If the counter
// can't be reached, the dive is tried again the next time the game opens, for a day or so.
import * as store from './store.js';
import { HAS_SERVER, post } from './server.js';

// Every prompt that has come up in Endless on this device. Endless's own "seen" list resets when
// the pool runs low, so it can't be used for this.
export function noteEndless(ids) {
  const met = store.get('endless.met', []);
  const fresh = ids.filter((id) => !met.includes(id));
  if (fresh.length) store.set('endless.met', [...met, ...fresh]);
}

function metInEndless() {
  const state = store.get('endless.state', {});
  return new Set([...store.get('endless.met', []), ...(state.seen || []), ...(store.get('endless.current')?.ids || [])]);
}

export function sendDaily(dive, calendar) {
  if (!HAS_SERVER || dive.mode !== 'daily' || !dive.done || !dive.onTime || dive.sent) return;
  const met = metInEndless();
  const rounds = dive.rounds
    .filter((round) => calendar.firstDay(round.id) === dive.day && !met.has(round.id))
    .map((round) => (round.name ? { id: round.id, name: round.name } : { id: round.id, typed: round.input || '' }));
  const finish = () => {
    dive.sent = true;
    store.set(`daily.${dive.day}`, dive);
  };
  if (!rounds.length) {
    finish();
    return;
  }
  post('/dive', { day: dive.day, rounds }, { timeout: 15000, keepalive: true })
    .then((res) => {
      // 400 means the counter will never take this dive (too old, say), so stop retrying.
      if (res.ok || res.status === 400) finish();
    })
    .catch(() => {});
}
