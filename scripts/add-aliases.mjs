// Adds other names for existing answers from Wikidata, so "Doberman Pinscher" counts as Doberman.
// Each prompt in SOURCES says what kind of thing its answers are. An answer gets names only from
// the one Wikidata item of that kind that matches it exactly, and a name is skipped if the game
// already accepts it or it could belong to a different answer. Wikidata is public domain (CC0).
//
//   node scripts/add-aliases.mjs           shows what it would add
//   node scripts/add-aliases.mjs --write   adds it to the data files
//
// Then run node scripts/check-prompts.mjs and read the diff before publishing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, findAnswer, normalize } from '../js/match.js';
import { readPrompts } from './prompt-files.mjs';
import { SOURCES, PEOPLE, sparql, values, texts } from './wikidata.mjs';

const WRITE = process.argv.includes('--write');
const MAX_NEW = 3;
const MIN_COVERAGE = 0.3;

// The spellings Wikidata might use for one of our answer forms.
function lookups(form, drop) {
  const out = new Set([form, form.toLowerCase()]);
  if (!form.includes(' ')) out.add(form[0].toUpperCase() + form.slice(1).toLowerCase());
  for (const word of drop) {
    if (word.length > 2) out.add(`${form} ${word}`).add(`${form} ${word}`.toLowerCase());
  }
  return [...out];
}

const nameLike = (name, answer) => name.length >= 2 && name.length <= 40
  && !/[()[\]{}|:;/\\"]/.test(name)
  && /^[\p{Script=Latin}\p{N}\s'’.,&!?-]+$/u.test(name)
  && (!/\d/.test(name) || /\d/.test(answer.name))
  && name.split(/\s+/).length <= 5;

const JUNK = /\b(LLC|Inc|Ltd|Corp|genus|family|species|author of)\b|\bCo\.|\b[A-Z]{2}-[A-Z0-9]{1,3}\b/i;
const STOP = new Set(['the', 'of', 'and', 'a', 'an', 'de', 'la', 'le', 'el', 'von', 'van']);
const wordsOf = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !STOP.has(w));

// A new name has to look like a name for this answer: long enough not to be a code like ME or th,
// and, except for people, sharing a word with the answer (or for a single word, starting the same
// way), which keeps out generic words and names of a different thing.
function fitsAnswer(name, answer, prompt) {
  if (JUNK.test(name)) return false;
  if (normalize(name, prompt.drop).length < 4 && normalize(answer.name, prompt.drop).length > 4) return false;
  const mine = new Set([answer.name, ...answer.aliases].flatMap(wordsOf));
  const theirs = wordsOf(name);
  const prefixed = theirs.length === 1 && theirs[0].length >= 3
    && [...mine].some((w) => w.length >= 3 && (w.startsWith(theirs[0]) || theirs[0].startsWith(w)));
  if (PEOPLE.has(prompt.id)) return theirs.length > 1 || prefixed;
  return prefixed || (theirs.length > 1 && theirs.some((w) => w.length >= 3 && mine.has(w)));
}

async function aliasesFor(prompt, pattern) {
  const keyOwner = new Map();
  for (const answer of prompt.answers) {
    for (const form of [answer.name, ...answer.aliases]) keyOwner.set(normalize(form, prompt.drop), answer);
  }
  const forms = [...new Set(prompt.answers.flatMap((answer) => [answer.name, ...answer.aliases].flatMap((form) => lookups(form, prompt.drop))))];
  const items = new Map();
  for (let i = 0; i < forms.length; i += 80) {
    const rows = await sparql(`SELECT ?item ?form ?links (SAMPLE(?label) AS ?name) (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {
      ${values('form', texts(forms.slice(i, i + 80)))}
      ?item rdfs:label|skos:altLabel ?form .
      FILTER EXISTS { ${pattern} }
      ?item wikibase:sitelinks ?links .
      OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "en") }
      OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
    } GROUP BY ?item ?form ?links`);
    for (const row of rows) {
      const answer = keyOwner.get(normalize(row.form.value, prompt.drop));
      if (!answer) continue;
      const id = row.item.value;
      if (!items.has(id)) {
        items.set(id, {
          links: Number(row.links.value),
          names: [row.name?.value, ...(row.aliases?.value ? row.aliases.value.split('|') : [])].filter(Boolean),
          answers: new Set(),
        });
      }
      items.get(id).answers.add(answer);
    }
  }

  // An item that matches two of our answers can't tell them apart, so it's left out. When several
  // items match one answer, the best known one is used only if it's far better known than the rest.
  const byAnswer = new Map();
  for (const item of items.values()) {
    if (item.answers.size !== 1) continue;
    const [answer] = item.answers;
    if (!byAnswer.has(answer)) byAnswer.set(answer, []);
    byAnswer.get(answer).push(item);
  }
  const index = buildIndex(prompt);
  const proposals = new Map();
  const claimed = new Map();
  for (const [answer, candidates] of byAnswer) {
    candidates.sort((a, b) => b.links - a.links);
    if (candidates.length > 1 && candidates[0].links < 3 * candidates[1].links) continue;
    const [label, ...rest] = candidates[0].names;
    const fresh = [];
    for (const name of [label, ...rest.sort((a, b) => a.length - b.length)].map((text) => text?.trim())) {
      if (!name || !nameLike(name, answer) || !fitsAnswer(name, answer, prompt) || findAnswer(name, index)) continue;
      const key = normalize(name, prompt.drop);
      if (!key || key.length < 2 || fresh.some((other) => normalize(other, prompt.drop) === key)) continue;
      if (claimed.has(key) && claimed.get(key) !== answer) {
        claimed.set(key, null);
        continue;
      }
      claimed.set(key, answer);
      fresh.push(name);
    }
    if (fresh.length) proposals.set(answer, fresh);
  }
  // A name two answers both wanted goes to neither.
  for (const [answer, names] of proposals) {
    const kept = names.filter((name) => claimed.get(normalize(name, prompt.drop)) === answer).slice(0, MAX_NEW);
    if (kept.length) proposals.set(answer, kept);
    else proposals.delete(answer);
  }
  return { coverage: byAnswer.size / prompt.answers.length, proposals };
}

// Appends the new names to the matching answers, leaving every other line exactly as it was.
function rewrite(text, promptsInFile, additions) {
  const escape = (name) => name.replace(/,/g, '\\,');
  let n = -1;
  return text.split('\n').map((raw) => {
    const line = raw.trim();
    if (line.startsWith('? ')) n += 1;
    const adds = additions.get(promptsInFile[n]?.id);
    const match = adds && line.match(/^(10|15|30|60|85|100):\s*(.*)$/);
    if (!match) return raw;
    const addTo = (piece) => {
      const name = piece.replace(/\\,/g, ',').split('|')[0].trim();
      const extra = adds.get(name);
      return extra ? `${piece.trim()}|${extra.map(escape).join('|')}` : piece.trim();
    };
    if (match[1] === '100') {
      const cut = match[2].indexOf('::');
      return cut < 0 ? `100: ${addTo(match[2])}` : `100: ${addTo(match[2].slice(0, cut))} ${match[2].slice(cut)}`;
    }
    const pieces = match[2].replace(/\\,/g, '\u0001').split(',').map((piece) => addTo(piece.replace(/\u0001/g, '\\,')));
    return `${match[1]}: ${pieces.join(', ')}`;
  }).join('\n');
}

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const { files, prompts } = readPrompts(dataDir);
const unknown = Object.keys(SOURCES).filter((id) => !prompts.some((p) => p.id === id));
if (unknown.length) console.log(`Not in the banks, skipped: ${unknown.join(', ')}`);

const additions = new Map();
const report = [];
let total = 0;
for (const prompt of prompts) {
  if (!SOURCES[prompt.id] || prompt.exact) continue;
  try {
    const { coverage, proposals } = await aliasesFor(prompt, SOURCES[prompt.id]);
    const count = [...proposals.values()].reduce((sum, names) => sum + names.length, 0);
    const used = coverage >= MIN_COVERAGE && count > 0;
    report.push({ id: prompt.id, coverage: Math.round(coverage * 100), added: used ? count : 0, sample: [...proposals].slice(0, 4).map(([answer, names]) => `${answer.name} += ${names.join(' / ')}`) });
    console.log(`${prompt.id}: matched ${Math.round(coverage * 100)}% of answers, ${used ? `${count} new names` : coverage < MIN_COVERAGE ? 'too few matches, skipped' : 'nothing new'}`);
    if (used) {
      additions.set(prompt.id, new Map([...proposals].map(([answer, names]) => [answer.name, names])));
      total += count;
    }
  } catch (error) {
    report.push({ id: prompt.id, error: error.message });
    console.log(`${prompt.id}: FAILED ${error.message}`);
  }
}

const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
if (reportArg) writeFileSync(reportArg.slice(9), JSON.stringify({ report, additions: Object.fromEntries([...additions].map(([id, map]) => [id, Object.fromEntries(map)])) }, null, 2));
console.log(`${total} new names across ${additions.size} prompts.`);
if (WRITE) {
  files.forEach((file, i) => {
    const path = join(dataDir, file.path);
    const before = readFileSync(path, 'utf8');
    const after = rewrite(before, prompts.filter((p) => p.file === i), additions);
    if (after !== before) writeFileSync(path, after);
  });
  console.log('Written. Now run node scripts/check-prompts.mjs and review the diff.');
}
