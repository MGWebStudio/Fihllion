// Adds answers the hand-made lists missed, from Wikidata, for prompts whose kind of thing Wikidata
// knows exactly (CATALOGS in wikidata.mjs). Only items covered by at least MIN_LINKS Wikipedia
// language editions qualify. A new answer is scored by comparing how widely it's covered with the
// answers already on the list, at most 30 points and never as the hidden answer.
//
//   node scripts/add-answers.mjs [prompt-id ...]           shows what it would add
//   node scripts/add-answers.mjs --write [prompt-id ...]   adds it to the data files
//
// Then run node scripts/check-prompts.mjs and read the diff before publishing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, findAnswer, normalize } from '../js/match.js';
import { readPrompts } from './prompt-files.mjs';
import { SOURCES, CATALOGS, sparql, values, texts } from './wikidata.mjs';

const WRITE = process.argv.includes('--write');
const ONLY = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const MIN_LINKS = 4;
const MIN_COVERAGE = 0.5; // the kind has to fit at least half the answers already on the list
const MAX_ADD = 120;
const TIER_PTS = { 2: 30, 3: 60, 4: 85 };

const nameLike = (name) => name.length >= 3 && name.length <= 40
  && !/[()[\]{}|:;/\\"]/.test(name)
  && /^[\p{Script=Latin}\p{N}\s'’.,&!?-]+$/u.test(name)
  && name.split(/\s+/).length <= 5
  && !/^(list|history|category|template) /i.test(name);

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length];
}

const median = (list) => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// How widely each answer already on the list is covered, to learn this prompt's scale.
async function linksOfListed(prompt, pattern) {
  const owner = new Map();
  for (const answer of prompt.answers) {
    for (const form of [answer.name, ...answer.aliases]) owner.set(normalize(form, prompt.drop), answer);
  }
  const forms = [...new Set(prompt.answers.flatMap((answer) => [answer.name, ...answer.aliases]))];
  const best = new Map();
  for (let i = 0; i < forms.length; i += 80) {
    const rows = await sparql(`SELECT ?form (MAX(?n) AS ?links) WHERE {
      ${values('form', texts(forms.slice(i, i + 80)))}
      ?item rdfs:label|skos:altLabel ?form .
      FILTER EXISTS { ${pattern} }
      ?item wikibase:sitelinks ?n .
    } GROUP BY ?form`);
    for (const row of rows) {
      const answer = owner.get(normalize(row.form.value, prompt.drop));
      if (answer) best.set(answer, Math.max(best.get(answer) || 0, Number(row.links.value)));
    }
  }
  return best;
}

async function candidates(pattern) {
  const rows = await sparql(`SELECT ?item ?links ?label WHERE {
    { SELECT DISTINCT ?item WHERE { ${pattern} } }
    ?item wikibase:sitelinks ?links . FILTER(?links >= ${MIN_LINKS})
    ?item rdfs:label ?label . FILTER(LANG(?label) IN ("en", "mul"))
  } ORDER BY DESC(?links) LIMIT 900`);
  return rows.map((row) => ({ label: row.label.value.trim(), links: Number(row.links.value) }));
}

async function answersFor(prompt, pattern) {
  const listed = await linksOfListed(prompt, pattern);
  const coverage = listed.size / prompt.answers.length;
  if (coverage < MIN_COVERAGE) return { coverage, added: [] };

  // The middle coverage of each tier on the list sets where a new answer lands.
  const byTier = (tier) => median([...listed].filter(([answer]) => answer.tier === tier).map(([, links]) => links));
  const cut30 = byTier(2) ?? Infinity;
  const cut60 = byTier(3) ?? Infinity;
  const tierFor = (links) => (links >= cut30 ? 2 : links >= cut60 ? 3 : 4);

  const index = buildIndex(prompt);
  const keys = [...index.exact.keys()];
  const near = (key) => keys.some((other) => {
    if (Math.abs(other.length - key.length) > 2) return false;
    return editDistance(key, other) <= (Math.min(key.length, other.length) >= 6 ? 2 : 1);
  });
  const added = [];
  for (const { label, links } of await candidates(pattern)) {
    if (added.length >= MAX_ADD) break;
    if (!nameLike(label) || /\d/.test(label)) continue;
    const key = normalize(label, prompt.drop);
    if (!key || key.length < 3 || findAnswer(label, index) || near(key)) continue;
    keys.push(key);
    added.push({ name: label, tier: tierFor(links), links });
  }
  return { coverage, added };
}

// Appends new answers to the end of the prompt's tier lines, leaving every other line as it was.
function rewrite(text, promptsInFile, additions) {
  const escape = (name) => name.replace(/,/g, '\\,');
  let n = -1;
  return text.split('\n').map((raw) => {
    const line = raw.trim();
    if (line.startsWith('? ')) n += 1;
    const adds = additions.get(promptsInFile[n]?.id);
    const match = adds && line.match(/^(30|60|85):\s*(.*)$/);
    if (!match) return raw;
    const tier = { 30: 2, 60: 3, 85: 4 }[match[1]];
    const extra = adds.filter((a) => a.tier === tier).map((a) => escape(a.name));
    return extra.length ? `${match[1]}: ${match[2].trim()}, ${extra.join(', ')}` : raw;
  }).join('\n');
}

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const { files, prompts } = readPrompts(dataDir);
const additions = new Map();
let total = 0;
for (const prompt of prompts) {
  if (!CATALOGS.has(prompt.id) || !SOURCES[prompt.id] || prompt.exact) continue;
  if (ONLY.length && !ONLY.includes(prompt.id)) continue;
  try {
    const { coverage, added } = await answersFor(prompt, SOURCES[prompt.id]);
    const pct = Math.round(coverage * 100);
    if (coverage < MIN_COVERAGE) {
      console.log(`${prompt.id}: kind fits only ${pct}% of the list, skipped`);
      continue;
    }
    const counts = [2, 3, 4].map((tier) => `${added.filter((a) => a.tier === tier).length}×${TIER_PTS[tier]}`).join(' ');
    console.log(`${prompt.id}: fits ${pct}%, ${added.length} new (${counts}): ${added.slice(0, 6).map((a) => a.name).join(', ')}${added.length > 6 ? ', …' : ''}`);
    if (added.length) {
      additions.set(prompt.id, added);
      total += added.length;
    }
  } catch (error) {
    console.log(`${prompt.id}: FAILED ${error.message}`);
  }
}
console.log(`${total} new answers across ${additions.size} prompts.`);
if (WRITE) {
  files.forEach((file, i) => {
    const path = join(dataDir, file.path);
    const before = readFileSync(path, 'utf8');
    const after = rewrite(before, prompts.filter((p) => p.file === i), additions);
    if (after !== before) writeFileSync(path, after);
  });
  console.log('Written. Now run node scripts/check-prompts.mjs and review the diff.');
}
