// Ranked mode admin, run from this PC with the Wrangler login that deploys the Worker.
// There's no admin password on the server: these commands talk to the database directly.
//
//   node admin.mjs board [day]     today's board (or that day's), with flags for left-the-tab questions
//   node admin.mjs answers <name> [day]   what that player answered on their latest ranked run (or that day's)
//   node admin.mjs feedback [days] what players sent from the feedback box in the last 7 days (or that many)
//   node admin.mjs poll            results of the poll in js/poll.js
//   node admin.mjs referee [days]  the AI referee's calls, units and failures per day, and when it ran out
//   node admin.mjs ban <name>      hide a nickname from every board and stop it playing ranked
//   node admin.mjs unban <name>
//   node admin.mjs pause <name>    keep a nickname off the boards and out of ranked for now; it keeps its scores
//   node admin.mjs unpause <name>
//   node admin.mjs offer-rename <name> [name...]   next time they open the game, offer a one-time nickname change
//   node admin.mjs force-rename <name>   off the boards until they pick a new nickname; scores move to the new one
//   node admin.mjs cancel-rename <name>
//   add --local to any of them to use the test database on this PC instead of the live one
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TIERS, makeCalendar, parsePrompts } from '../js/content.js';
import { POLL, pollOpen } from '../js/poll.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const local = args.includes('--local');
const [command, value, extra] = args.filter((arg) => arg !== '--local');
const names = args.filter((arg) => arg !== '--local').slice(1);

function sql(query) {
  const wrangler = join(here, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const where = local ? ['--local', '--persist-to', join(here, '.wrangler', 'state')] : ['--remote'];
  const out = execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'fihllion', ...where, '--json', '--command', query], { cwd: here, encoding: 'utf8' });
  return JSON.parse(out)[0].results;
}

// Nicknames are letters and numbers only, so they're safe to put in a query once checked.
function nameKey(name) {
  if (!/^[A-Za-z0-9]{3,16}$/.test(name || '')) throw new Error('Give a nickname: 3-16 letters or numbers.');
  return name.toLowerCase();
}

if (command === 'board') {
  const day = value ? Number(value) : null;
  const dayClause = day ? `r.day = ${Math.floor(day)}` : 'r.day = (SELECT MAX(day) FROM runs)';
  const rows = sql(`SELECT r.day, p.name, r.score, json_array_length(r.rounds) AS answered, r.flags, p.banned
    FROM runs r JOIN players p ON p.id = r.player WHERE ${dayClause} ORDER BY r.score DESC`);
  console.table(rows);
} else if (command === 'ban' || command === 'unban') {
  const key = nameKey(value);
  const found = sql(`SELECT name FROM players WHERE name_key = '${key}'`);
  if (!found.length) throw new Error(`No player called ${value}.`);
  sql(`UPDATE players SET banned = ${command === 'ban' ? 1 : 0} WHERE name_key = '${key}'`);
  console.log(`${found[0].name} ${command === 'ban' ? 'is hidden from the boards and can’t play ranked' : 'is back on the boards'}.`);
} else if (['pause', 'unpause', 'offer-rename', 'force-rename', 'cancel-rename'].includes(command)) {
  if (!names.length) throw new Error('Give at least one nickname.');
  const set = {
    pause: 'paused = 1',
    unpause: 'paused = 0',
    'offer-rename': 'rename_offer = 1',
    'force-rename': 'rename_offer = 2',
    'cancel-rename': 'rename_offer = 0',
  }[command];
  const said = {
    pause: 'is off the boards and can’t play ranked for now',
    unpause: 'can play ranked again and is back on the boards',
    'offer-rename': 'will be offered a new nickname next time they open the game',
    'force-rename': 'is off the boards until they pick a new nickname',
    'cancel-rename': 'won’t be asked to change nickname',
  }[command];
  for (const name of names) {
    const key = nameKey(name);
    const found = sql(`SELECT name FROM players WHERE name_key = '${key}'`);
    if (!found.length) {
      console.log(`No player called ${name}.`);
      continue;
    }
    sql(`UPDATE players SET ${set} WHERE name_key = '${key}'`);
    console.log(`${found[0].name} ${said}.`);
  }
} else if (command === 'answers') {
  const key = nameKey(value);
  const dayClause = extra ? `AND r.day = ${Math.floor(Number(extra))}` : '';
  const [run] = sql(`SELECT p.name, r.day, r.rounds, r.score, r.flags FROM runs r JOIN players p ON p.id = r.player
    WHERE p.name_key = '${key}' ${dayClause} ORDER BY r.day DESC LIMIT 1`);
  if (!run) throw new Error(`No ranked run for ${value}${extra ? ` on day ${extra}` : ''}.`);
  // Prompt text comes from this copy of the site's data, which matches the live site once it's pushed.
  const data = join(here, '..', 'data');
  const index = JSON.parse(readFileSync(join(data, 'index.json'), 'utf8'));
  const ids = makeCalendar(JSON.parse(readFileSync(join(data, 'schedule.json'), 'utf8'))).idsFor(run.day);
  const promptText = (id) => {
    const entry = index.prompts.find(([pid]) => pid === id);
    const file = entry && index.files[entry[1]];
    if (!file) return id;
    return parsePrompts(readFileSync(join(data, file.path), 'utf8'), file.category).find((p) => p.id === id)?.text || id;
  };
  const rows = JSON.parse(run.rounds).map((round, i) => ({
    prompt: promptText(ids[i]),
    answer: round.tier >= 0 ? round.name ?? '(not saved)' : '',
    typed: round.typed ?? '',
    result: round.tier >= 0 ? `${TIERS[round.tier].name}, ${round.pts}${round.ref ? ' (referee)' : ''}` : round.flag ? 'Left the tab, 0' : 'No answer, 0',
  }));
  console.log(`${run.name}, day ${run.day}: ${run.score} points${run.flags ? `, ${run.flags} flagged` : ''}.`);
  console.table(rows);
} else if (command === 'feedback') {
  const days = value ? Math.max(1, Math.floor(Number(value)) || 7) : 7;
  const rows = sql(`SELECT f.at, f.text, f.device, f.place, p.name FROM feedback f LEFT JOIN players p ON p.id = f.player
    WHERE f.at > ${Date.now() - days * 86400000} ORDER BY f.at`);
  if (!rows.length) console.log(`No feedback in the last ${days} days.`);
  for (const row of rows) {
    const when = new Date(row.at).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const about = [when, row.name || 'no nickname', row.device, row.place].filter(Boolean).join(' · ');
    console.log(`${about}\n  ${row.text.replace(/\n/g, '\n  ')}\n`);
  }
  console.log(`${rows.length} in the last ${days} days.`);
} else if (command === 'poll') {
  if (!POLL || !/^[a-z0-9-]+$/.test(POLL.id)) throw new Error('No poll in js/poll.js.');
  const rows = sql(`SELECT choice, named, device, COUNT(*) AS n FROM poll_votes WHERE poll = '${POLL.id}' GROUP BY choice, named, device`);
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  const sum = (test) => rows.filter(test).reduce((s, row) => s + row.n, 0);
  console.log(`${POLL.title}, ${pollOpen() ? `open until ${POLL.closesSaid}` : 'closed'}: ${POLL.question}`);
  console.table(POLL.options.map((option) => {
    const votes = sum((row) => row.choice === option.id);
    return {
      option: option.label,
      votes,
      share: total ? `${Math.round((votes / total) * 100)}%` : '-',
      'with a nickname': sum((row) => row.choice === option.id && row.named),
      'no nickname': sum((row) => row.choice === option.id && !row.named),
      computer: sum((row) => row.choice === option.id && row.device === 'computer'),
      phone: sum((row) => row.choice === option.id && row.device === 'phone'),
    };
  }));
  console.log(`${total} ${total === 1 ? 'vote' : 'votes'}.`);
} else if (command === 'referee') {
  const days = value ? Math.max(1, Math.floor(Number(value)) || 7) : 7;
  // ai_calls counts by UTC day (it resets at 5 PM Mountain Time), numbered like the game's days.
  const mt = (ms) => (ms ? new Date(ms).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const rows = sql(`SELECT day, n, units, failed, practice_out_at, ranked_out_at FROM ai_calls ORDER BY day DESC LIMIT ${days}`);
  console.log('AI referee by UTC day (each one runs 5 PM to 5 PM Mountain Time):');
  console.table(rows.map((row) => ({
    day: row.day,
    calls: row.n,
    units: Math.round(row.units),
    failed: row.failed,
    'practice ran out': mt(row.practice_out_at),
    'ranked ran out': mt(row.ranked_out_at),
  })));
  const since = Date.now() - days * 86400000;
  const kinds = sql(`SELECT kind, COUNT(*) AS n FROM ai_failures WHERE at > ${since} GROUP BY kind ORDER BY n DESC`);
  if (!kinds.length) {
    console.log(`No failed calls recorded in the last ${days} days.`);
  } else {
    console.log('Failed calls recorded (up to 200 a day):', kinds.map((k) => `${k.kind} ${k.n}`).join(', '));
    const common = sql(`SELECT kind, substr(detail, 1, 120) AS detail, COUNT(*) AS n FROM ai_failures WHERE at > ${since}
      GROUP BY kind, substr(detail, 1, 120) ORDER BY n DESC LIMIT 8`);
    console.table(common);
  }
} else {
  console.log('Use: node admin.mjs board [day] | answers <name> [day] | feedback [days] | poll | referee [days] | ban | unban | pause | unpause <name>');
  console.log('     | offer-rename <name> [name...] | force-rename | cancel-rename <name>  [--local]');
}
