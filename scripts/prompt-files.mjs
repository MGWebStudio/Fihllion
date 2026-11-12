// Shared by the scripts in this folder: finds every prompt file under data/ and reads it.
// A file's category is its name minus any batch number, so pool/food-0002.txt is "food".
// Prompts under data/endless/ only appear in Endless and are never put on the daily schedule.
// A prompt marked ~retired is out of play: a past dive that used it still loads it, but Endless
// skips it and it's never scheduled again. Retired prompts nobody has played yet live in data/retired/.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePrompts } from '../js/content.js';

export function readPrompts(dataDir) {
  const files = readdirSync(dataDir, { recursive: true })
    .map((name) => String(name).replace(/\\/g, '/'))
    .filter((path) => path.endsWith('.txt'))
    .sort()
    .map((path) => ({ path, category: path.split('/').pop().replace(/(-\d+)?\.txt$/, '') }));
  const prompts = files.flatMap((file, i) => parsePrompts(readFileSync(join(dataDir, file.path), 'utf8'), file.category)
    .map((prompt) => Object.assign(prompt, { file: i, endlessOnly: file.path.startsWith('endless/') })));
  return { files, prompts };
}

// One line per entry keeps the diff small when prompts are added. A retired prompt gets a third
// field, so the game can leave it out of Endless without loading its file.
export function indexJSON({ files, prompts }) {
  const lines = (list) => list.map((item) => `    ${JSON.stringify(item)}`).join(',\n');
  return `{\n  "files": [\n${lines(files)}\n  ],\n  "prompts": [\n${lines(prompts.map((p) => (p.retired ? [p.id, p.file, 1] : [p.id, p.file])))}\n  ]\n}\n`;
}
