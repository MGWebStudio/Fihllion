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
import { SOURCES, CATALOGS, sparql } from './wikidata.mjs';

const WRITE = process.argv.includes('--write');
const ONLY = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const MIN_LINKS = 4;
const MIN_COVERAGE = 0.4; // the kind has to cover at least 40% of the answers already on the list
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

// Kept flat on purpose: wrapping the pattern in a subquery makes Wikidata's planner time out.
// Each item's other names come along, so an answer already on the list under another name
// ("Constantine I" for Constantine the Great) isn't added twice.
async function candidates(pattern) {
  const rows = await sparql(`SELECT ?item ?links ?label (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
    ${pattern}
    ?item wikibase:sitelinks ?links . FILTER(?links >= ${MIN_LINKS})
    OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
    OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
    BIND(COALESCE(?en, ?mul) AS ?label) FILTER(BOUND(?label))
    OPTIONAL { ?item skos:altLabel ?alt FILTER(LANG(?alt) IN ("en", "mul")) }
  } GROUP BY ?item ?links ?label ORDER BY DESC(?links) LIMIT 900`);
  return rows.map((row) => ({
    label: row.label.value.trim(),
    links: Number(row.links.value),
    alts: row.alts?.value ? row.alts.value.split('|').map((alt) => alt.trim()).filter(Boolean) : [],
  }));
}

// One query per prompt: the catalog's best-covered items. Items already on the list show how widely
// covered each tier is; the rest are the candidates.
async function answersFor(prompt, pattern) {
  const index = buildIndex(prompt);
  const items = await candidates(pattern);
  const listed = new Map();
  const fresh = [];
  for (const item of items) {
    const hit = [item.label, ...item.alts].map((name) => findAnswer(name, index)).find(Boolean);
    if (hit) listed.set(hit, Math.max(listed.get(hit) || 0, item.links));
    else fresh.push(item);
  }
  const coverage = listed.size / prompt.answers.length;
  if (coverage < MIN_COVERAGE) return { coverage, added: [] };

  // The middle coverage of each tier on the list sets where a new answer lands.
  const byTier = (tier) => median([...listed].filter(([answer]) => answer.tier === tier).map(([, links]) => links));
  const cut30 = byTier(2) ?? Infinity;
  const cut60 = byTier(3) ?? Infinity;
  const tierFor = (links) => (links >= cut30 ? 2 : links >= cut60 ? 3 : 4);

  const keys = [...index.exact.keys()];
  const near = (key) => keys.some((other) => {
    if (Math.abs(other.length - key.length) > 2) return false;
    return editDistance(key, other) <= (Math.min(key.length, other.length) >= 6 ? 2 : 1);
  });
  const added = [];
  for (const { label, links } of fresh) {
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
// --report=file saves what was found; --apply=file writes a saved report without asking Wikidata
// again, after any lines you don't want have been deleted from it.
const reportPath = process.argv.find((arg) => arg.startsWith('--report='))?.slice(9);
const applyPath = process.argv.find((arg) => arg.startsWith('--apply='))?.slice(8);
if (applyPath) {
  for (const [id, added] of Object.entries(JSON.parse(readFileSync(applyPath, 'utf8')))) {
    additions.set(id, added);
    total += added.length;
  }
}
for (const prompt of applyPath ? [] : prompts) {
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
if (reportPath) writeFileSync(reportPath, JSON.stringify(Object.fromEntries(additions), null, 1));
if (WRITE || applyPath) {
  files.forEach((file, i) => {
    const path = join(dataDir, file.path);
    const before = readFileSync(path, 'utf8');
    const after = rewrite(before, prompts.filter((p) => p.file === i), additions);
    if (after !== before) writeFileSync(path, after);
  });
  console.log('Written. Now run node scripts/check-prompts.mjs and review the diff.');
}
