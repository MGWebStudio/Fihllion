// Builds data/faces.json: photos of the commonest (10-point) answers on prompts about real people,
// so a player who knows a face but not the name can still get an answer down. Only Plankton answers
// get photos, so faces never point anyone at a rare answer. Each person is the real human on
// Wikidata with that name (the best known one if several), and the photo is their Wikidata image,
// which always lives on Wikimedia Commons under a free license. The credit for each is kept.
//
//   node scripts/build-faces.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPrompts } from './prompt-files.mjs';
import { USER_AGENT, sparql, values, texts } from './wikidata.mjs';

const WIDTH = 160;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { prompts } = readPrompts(join(root, 'data'));
// Fictional characters share nicknames with real people ("Scotty", "Kramer"), so their prompts are left out.
const FICTIONAL = new Set(['star-trek-character', 'seinfeld-character', 'charles-dickens-character']);
const people = prompts.filter((prompt) => prompt.lastName && !FICTIONAL.has(prompt.id));

// The answer's own name, then its other names of two or more words. One-word nicknames like
// "Bush" or "Ike" could find the wrong person.
const wanted = [];
for (const prompt of people) {
  for (const answer of prompt.answers.filter((a) => a.tier === 0)) {
    if (/\band\b|&/i.test(answer.name)) continue; // pairs like "Penn and Teller" have no single face
    wanted.push({ prompt, answer, forms: [answer.name, ...answer.aliases.filter((alias) => alias.trim().includes(' '))] });
  }
}

const forms = [...new Set(wanted.flatMap((w) => w.forms))];
const best = new Map(); // form -> { file, links }
for (let i = 0; i < forms.length; i += 40) {
  const rows = await sparql(`SELECT ?form ?file ?links WHERE {
    ${values('form', texts(forms.slice(i, i + 40)))}
    ?item rdfs:label|skos:altLabel ?form ; wdt:P31 wd:Q5 ; wdt:P18 ?file ; wikibase:sitelinks ?links .
  }`);
  for (const row of rows) {
    const links = Number(row.links.value);
    const form = row.form.value;
    if (!best.has(form) || best.get(form).links < links) {
      best.set(form, { file: decodeURIComponent(row.file.value.split('/').pop()).replace(/_/g, ' '), links });
    }
  }
}

// The answer's own name wins over its other names, which can belong to someone else.
const chosen = [];
for (const w of wanted) {
  const hit = w.forms.map((form) => best.get(form)).find(Boolean);
  if (hit) chosen.push({ ...w, file: hit.file });
}

// Thumbnail address, file page and credit for each photo, 50 files per request.
const info = new Map();
const files = [...new Set(chosen.map((c) => c.file))];
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
for (let i = 0; i < files.length; i += 50) {
  const titles = files.slice(i, i + 50).map((f) => `File:${f}`).join('|');
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}&titles=${encodeURIComponent(titles)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const pages = (await res.json())?.query?.pages || [];
  for (const page of pages) {
    const ii = page.imageinfo?.[0];
    if (!ii?.thumburl) continue;
    const meta = ii.extmetadata || {};
    let artist = strip(meta.Artist?.value).slice(0, 80) || 'Unknown';
    const license = strip(meta.LicenseShortName?.value) || 'see file page';
    artist = artist.replace(/^(.{6,}?)\1/, '$1'); // Commons sometimes doubles it: "Unknown authorUnknown author"
    info.set(page.title.replace(/^File:/, ''), { img: ii.thumburl, page: ii.descriptionurl, credit: `${artist}, ${license}` });
  }
}

const faces = {};
let count = 0;
for (const c of chosen) {
  const photo = info.get(c.file);
  if (!photo) continue;
  (faces[c.prompt.id] ||= []).push({ name: c.answer.name, ...photo });
  count += 1;
}
// A prompt needs a few faces to be worth a picker.
for (const id of Object.keys(faces)) if (faces[id].length < 3) delete faces[id];
writeFileSync(join(root, 'data', 'faces.json'), `${JSON.stringify(faces, null, 1)}\n`);
const kept = Object.values(faces).reduce((sum, list) => sum + list.length, 0);
console.log(`${kept} faces on ${Object.keys(faces).length} prompts (found ${count} of ${wanted.length} people with photos).`);
const missing = wanted.filter((w) => !faces[w.prompt.id]?.some((f) => f.name === w.answer.name)).map((w) => `${w.prompt.id}: ${w.answer.name}`);
if (missing.length) console.log(`No face: ${missing.join('; ')}`);
