// Ranked mode admin, run from this PC with the Wrangler login that deploys the Worker.
// There's no admin password on the server: these commands talk to the database directly.
//
//   node admin.mjs board [day]     today's board (or that day's), with flags for left-the-tab questions
//   node admin.mjs answers <name> [day]   what that player answered on their latest ranked run (or that day's)
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
} else {
  console.log('Use: node admin.mjs board [day] | answers <name> [day] | ban | unban | pause | unpause <name>');
  console.log('     | offer-rename <name> [name...] | force-rename | cancel-rename <name>  [--local]');
}
