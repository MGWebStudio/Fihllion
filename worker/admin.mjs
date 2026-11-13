// Ranked mode admin, run from this PC with the Wrangler login that deploys the Worker.
// There's no admin password on the server: these commands talk to the database directly.
//
//   node admin.mjs board [day]     today's board (or that day's), with flags for left-the-tab questions
//   node admin.mjs ban <name>      hide a nickname from every board and stop it playing ranked
//   node admin.mjs unban <name>
//   add --local to any of them to use the test database on this PC instead of the live one
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const local = args.includes('--local');
const [command, value] = args.filter((arg) => arg !== '--local');

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
} else {
  console.log('Use: node admin.mjs board [day] | ban <name> | unban <name>  [--local]');
}
