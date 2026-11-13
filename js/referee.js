// Asks the AI referee (worker/) about an answer that isn't on the prompt's list. Resolves to
// { name, tier } when it counts, false when the referee rules it out, or null when the referee
// couldn't be reached in time. Rulings are remembered for the visit, so a repeat guess is instant.
import { HAS_SERVER, post } from './server.js';

const TIMEOUT_MS = 5000;
const asked = new Map();

export function askReferee(promptId, typed) {
  if (!HAS_SERVER) return Promise.resolve(null);
  const key = `${promptId}\n${typed.trim().toLowerCase()}`;
  if (asked.has(key)) return asked.get(key);
  const job = post('/check', { prompt: promptId, typed }, { timeout: TIMEOUT_MS })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || data.busy) return null;
      const ok = data.valid === true && typeof data.name === 'string' && Number.isInteger(data.tier) && data.tier >= 0 && data.tier <= 5;
      return ok ? { name: data.name, tier: data.tier } : false;
    })
    .catch(() => null);
  asked.set(key, job);
  job.then((verdict) => { if (verdict === null) asked.delete(key); }); // let a failed check be retried
  return job;
}
