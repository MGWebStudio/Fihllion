// Writes data/index.json, which tells the game which file holds each prompt so it only fetches
// the files a dive needs. Run it whenever prompts are added, removed or renamed:
//   node scripts/build-index.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexJSON, readPrompts } from './prompt-files.mjs';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const content = readPrompts(dataDir);
writeFileSync(join(dataDir, 'index.json'), indexJSON(content));
console.log(`Indexed ${content.prompts.length} prompts in ${content.files.length} files.`);
