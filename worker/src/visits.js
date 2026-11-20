// How many different people open the game each day, for the admin's dashboard (dashboard.js).
//
//   POST /visit  {"day": 18, "id": "<24 hex characters>", "phone": true, "fresh": false}  ->  204
//
// Each device sends its own random id once a day (js/counts.js); "fresh" means it had never played
// before. Only a scrambled copy of the id tied to the day is kept, just long enough to count each
// device once, so one day's visitors can't be matched with another day's.
import { parseJSON, utcToday } from './shared.js';

const MAX_PER_DAY = 20000; // so a script can't fill the database

export async function visit(text, env, reply) {
  let data;
  try {
    data = parseJSON(text) || {};
  } catch (error) {
    return reply(400, error.message);
  }
  // The game's day is Mountain Time's, never more than a day from UTC's.
  if (!Number.isInteger(data.day) || Math.abs(data.day - utcToday()) > 1) return reply(400, 'Not a current day');
  if (typeof data.id !== 'string' || !/^[a-f0-9]{24}$/.test(data.id)) return reply(400, 'Wrong id');

  const counted = await env.DB.prepare('SELECT n FROM visit_days WHERE day = ?1').bind(data.day).first('n');
  if (counted >= MAX_PER_DAY) return reply(204);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${data.day}:${data.id}`));
  const who = [...new Uint8Array(digest).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const added = await env.DB.prepare('INSERT OR IGNORE INTO visits (day, who) VALUES (?1, ?2)').bind(data.day, who).run();
  if (added.meta.changes) {
    await env.DB.prepare(`INSERT INTO visit_days (day, n, phone, fresh) VALUES (?1, 1, ?2, ?3)
      ON CONFLICT (day) DO UPDATE SET n = n + 1, phone = phone + ?2, fresh = fresh + ?3`)
      .bind(data.day, data.phone === true ? 1 : 0, data.fresh === true ? 1 : 0).run();
    // Only today's and yesterday's copies are needed to count each device once.
    if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM visits WHERE day < ?1').bind(data.day - 2).run();
  }
  return reply(204);
}
