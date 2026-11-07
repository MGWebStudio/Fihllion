// Appends new daily dives to data/schedule.json using prompts that haven't been scheduled yet.
// Days already in the file never change, so past dives and today's dive stay the same for everyone.
//
//   node scripts/build-schedule.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS_PER_DIVE } from '../js/content.js';
import { readPrompts } from './prompt-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schedulePath = join(root, 'data', 'schedule.json');
const schedule = existsSync(schedulePath)
  ? JSON.parse(readFileSync(schedulePath, 'utf8'))
  : { epoch: '2026-11-03', days: [] };

const { prompts } = readPrompts(join(root, 'data'));

let seed = 20261103 + schedule.days.length;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const used = new Set(schedule.days.flat());
const pools = new Map();
for (const prompt of prompts) {
  if (used.has(prompt.id)) continue;
  if (!pools.has(prompt.category)) pools.set(prompt.category, []);
  pools.get(prompt.category).push(prompt.id);
}
for (const pool of pools.values()) {
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
}

// Fill each dive from the fullest categories, so every dive covers seven different subjects
// and the categories run out at about the same time.
let added = 0;
while (true) {
  const open = [...pools.entries()].filter(([, pool]) => pool.length);
  if (open.length < PROMPTS_PER_DIVE) break;
  open.sort((a, b) => b[1].length - a[1].length || random() - 0.5);
  const dive = open.slice(0, PROMPTS_PER_DIVE).map(([, pool]) => pool.pop());
  for (let i = dive.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [dive[i], dive[j]] = [dive[j], dive[i]];
  }
  schedule.days.push(dive);
  added += 1;
}

writeFileSync(schedulePath, `{\n  "epoch": ${JSON.stringify(schedule.epoch)},\n  "days": [\n${schedule.days.map((day) => `    ${JSON.stringify(day)}`).join(',\n')}\n  ]\n}\n`);
const left = [...pools.values()].reduce((sum, pool) => sum + pool.length, 0);
console.log(`Added ${added} dives. ${schedule.days.length} total. ${left} prompts left unscheduled.`);
