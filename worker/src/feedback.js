// The feedback box in the game's menu. Each note is saved for the admin script
// (node admin.mjs feedback). A cap on notes per day keeps one person from filling the database.
//
//   POST /feedback  {"text": "...", "key"?: "...", "device"?: "phone"|"computer", "place"?: "..."}  -> 204
import { parseJSON } from './shared.js';
import { playerFor } from './ranked.js';

export const MAX_TEXT = 600;
const MAX_PLACE = 160;
const DAILY_CAP = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function feedback(text, env, reply) {
  let data;
  try {
    data = parseJSON(text) || {};
  } catch (error) {
    return reply(400, error.message);
  }
  const note = typeof data.text === 'string'
    ? data.text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim()
    : '';
  if (note.length < 2) return reply(400, 'Empty');
  if (note.length > MAX_TEXT) return reply(413, 'Too long');
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM feedback WHERE at > ?1').bind(Date.now() - DAY_MS).first();
  if (recent.n >= DAILY_CAP) return reply(429, 'Full for today');
  const player = data.key ? await playerFor(env, data.key) : null;
  if (player?.banned) return reply(403, 'Banned'); // banned players play Endless only
  const device = ['phone', 'computer'].includes(data.device) ? data.device : null;
  const place = typeof data.place === 'string' ? data.place.trim().slice(0, MAX_PLACE) : '';
  await env.DB.prepare('INSERT INTO feedback (at, text, player, device, place) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(Date.now(), note, player?.id ?? null, device, place || null).run();
  return reply(204);
}
