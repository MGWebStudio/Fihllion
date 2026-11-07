// Checks the prompt files and schedule for mistakes. Run before publishing new prompts:
//   node scripts/check-prompts.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS_PER_DIVE } from '../js/content.js';
import { buildIndex, findAnswer, normalize } from '../js/match.js';
import { indexJSON, readPrompts } from './prompt-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const warnings = [];
const content = readPrompts(join(root, 'data'));
const { prompts } = content;
const counts = {};
for (const prompt of prompts) counts[prompt.category] = (counts[prompt.category] || 0) + 1;
if (!prompts.length) problems.push('no prompt files found in data/');

const indexPath = join(root, 'data', 'index.json');
if (!existsSync(indexPath) || readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n') !== indexJSON(content)) {
  problems.push('data/index.json is out of date. Run node scripts/build-index.mjs');
}

const seenIds = new Map();
for (const prompt of prompts) {
  if (seenIds.has(prompt.id)) problems.push(`duplicate prompt id ${prompt.id} (${seenIds.get(prompt.id)}, ${prompt.category})`);
  seenIds.set(prompt.id, prompt.category);
  if (!prompt.gem) problems.push(`${prompt.id}: no 100-point answer`);
  if (prompt.gem && !prompt.gem.blurb) problems.push(`${prompt.id}: hidden answer has no blurb`);
  for (const tier of [0, 2, 3, 4]) {
    if (!prompt.answers.some((answer) => answer.tier === tier)) warnings.push(`${prompt.id}: nothing in tier ${tier}`);
  }

  const owners = new Map();
  for (const answer of prompt.answers) {
    for (const form of [answer.name, ...answer.aliases]) {
      const key = normalize(form, prompt.drop);
      if (!key) {
        problems.push(`${prompt.id}: "${form}" is empty once normalized`);
        continue;
      }
      if (owners.has(key) && owners.get(key) !== answer) {
        problems.push(`${prompt.id}: "${form}" is listed under both "${owners.get(key).name}" and "${answer.name}"`);
      }
      owners.set(key, answer);
    }
  }

  // Every listed spelling has to resolve to its own answer, or that answer can't be reached.
  const index = buildIndex(prompt);
  for (const answer of prompt.answers) {
    for (const form of [answer.name, ...answer.aliases]) {
      const hit = findAnswer(form, index);
      if (hit !== answer) warnings.push(`${prompt.id}: typing "${form}" gives "${hit?.name}" instead of "${answer.name}"`);
    }
  }
}

const schedulePath = join(root, 'data', 'schedule.json');
let days = 0;
if (existsSync(schedulePath)) {
  const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'));
  days = schedule.days.length;
  schedule.days.forEach((day, i) => {
    if (day.length !== PROMPTS_PER_DIVE) problems.push(`schedule day ${i + 1} has ${day.length} prompts`);
    const cats = new Set();
    for (const id of day) {
      const category = seenIds.get(id);
      if (!category) problems.push(`schedule day ${i + 1}: unknown prompt ${id}`);
      if (cats.has(category)) warnings.push(`schedule day ${i + 1}: two ${category} prompts`);
      cats.add(category);
    }
  });
  const used = new Set(schedule.days.flat());
  const unused = prompts.filter((p) => !used.has(p.id));
  if (unused.length) warnings.push(`${unused.length} prompts aren't scheduled: ${unused.map((p) => p.id).join(', ')}`);
} else {
  problems.push('data/schedule.json is missing');
}

const total = prompts.reduce((sum, p) => sum + p.answers.length, 0);
console.log(`${prompts.length} prompts, ${total} answers, ${days} scheduled dives`);
console.log(Object.entries(counts).map(([file, n]) => `${file}: ${n}`).join('  '));
const smallest = [...prompts].sort((a, b) => a.answers.length - b.answers.length).slice(0, 5);
console.log(`Smallest banks: ${smallest.map((p) => `${p.id} (${p.answers.length})`).join(', ')}`);
for (const line of warnings) console.log(`warning: ${line}`);
for (const line of problems) console.log(`PROBLEM: ${line}`);
if (problems.length) process.exit(1);
