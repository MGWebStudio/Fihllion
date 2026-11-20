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

// Counts this device once a day toward how many different people open the game (the admin's
// dashboard). It sends a random id kept on this device; the server keeps only a scrambled copy tied
// to the day, so one day's visitors can't be matched with another's.
export function sendVisit(day, phone) {
  if (!HAS_SERVER || store.get('visit.day') === day) return;
  let id = store.get('visit.id');
  // New to the game: no id yet, and nothing played on this device before.
  const fresh = !id && !store.keysWith('daily.').length && !store.keysWith('endless.').length && !store.get('ranked.player');
  if (!/^[a-f0-9]{24}$/.test(id || '')) {
    id = [...crypto.getRandomValues(new Uint8Array(12))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    store.set('visit.id', id);
  }
  post('/visit', { day, id, phone, fresh }, { timeout: 15000, keepalive: true })
    .then((res) => {
      if (res.ok || res.status === 400) store.set('visit.day', day);
    })
    .catch(() => {});
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
