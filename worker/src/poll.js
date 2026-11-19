// The poll in the game (js/poll.js). Asking without a choice returns the totals and this voter's
// vote; asking with one saves it first. Results for the admin: node admin.mjs poll.
//
//   POST /poll  {"poll": "weekend-ranked", "choice"?: "fun", "key"?: "...", "browser"?: "...", "device"?: "phone"|"computer"}
//     -> {"open": true, "counts": {"ranked": 4, "fun": 7}, "mine": "fun"}
import { POLL, pollOpen } from '../../js/poll.js';
import { parseJSON } from './shared.js';
import { playerFor } from './ranked.js';

const MAX_VOTERS = 5000; // per poll, so a script can't fill the database

export async function poll(text, env, reply, json) {
  let data;
  try {
    data = parseJSON(text) || {};
  } catch (error) {
    return reply(400, error.message);
  }
  if (!POLL || data.poll !== POLL.id) return reply(404, 'No such poll');
  const player = data.key ? await playerFor(env, data.key) : null;
  const browser = typeof data.browser === 'string' && /^[a-z0-9]{16,40}$/.test(data.browser) ? data.browser : null;
  const voter = player && !player.banned ? `p:${player.id}` : browser ? `b:${browser}` : null;
  const open = pollOpen();

  if (data.choice !== undefined) {
    if (!open) return reply(409, 'Closed');
    if (!POLL.options.some((option) => option.id === data.choice)) return reply(400, 'Unknown choice');
    if (!voter) return reply(400, 'No voter');
    const known = await env.DB.prepare('SELECT 1 FROM poll_votes WHERE poll = ?1 AND voter = ?2').bind(POLL.id, voter).first();
    if (!known) {
      const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM poll_votes WHERE poll = ?1').bind(POLL.id).first();
      if (total.n >= MAX_VOTERS) return reply(429, 'Full');
    }
    const device = ['phone', 'computer'].includes(data.device) ? data.device : null;
    await env.DB.prepare(`INSERT INTO poll_votes (poll, voter, choice, named, device, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT (poll, voter) DO UPDATE SET choice = excluded.choice, device = excluded.device, at = excluded.at`)
      .bind(POLL.id, voter, data.choice, voter.startsWith('p:') ? 1 : 0, device, Date.now()).run();
  }

  const rows = (await env.DB.prepare('SELECT choice, COUNT(*) AS n FROM poll_votes WHERE poll = ?1 GROUP BY choice').bind(POLL.id).all()).results;
  const counts = Object.fromEntries(POLL.options.map((option) => [option.id, rows.find((row) => row.choice === option.id)?.n ?? 0]));
  const mine = voter
    ? (await env.DB.prepare('SELECT choice FROM poll_votes WHERE poll = ?1 AND voter = ?2').bind(POLL.id, voter).first())?.choice ?? null
    : null;
  return json({ open, counts, mine });
}
