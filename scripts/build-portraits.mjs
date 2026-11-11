// Builds data/portraits.json: a photo of the person or band a prompt is about ("Name a Michael
// Jackson song" shows Michael Jackson), shown beside the question. The photo is the subject's
// Wikidata image, which always lives on Wikimedia Commons under a free license, and its credit is
// kept. Subjects are listed by hand in SUBJECTS; the best-known Wikidata item with that name and a
// photo is used, and its description is printed so a wrong match is easy to spot.
//
//   node scripts/build-portraits.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_AGENT, sparql, texts } from './wikidata.mjs';

const WIDTH = 240;
const PERSON = 'wd:Q5';
const BAND = 'wd:Q215380';
const CHARACTER = 'wd:Q15632617'; // fictional human

// Prompt id -> [name on Wikidata, kind of thing].
const SUBJECTS = {
  'taylor-swift-song': ['Taylor Swift', PERSON],
  'michael-jackson-song': ['Michael Jackson', PERSON],
  'elvis-song': ['Elvis Presley', PERSON],
  'madonna-song': ['Madonna', PERSON],
  'billy-joel-song': ['Billy Joel', PERSON],
  'elton-john-song': ['Elton John', PERSON],
  'tom-hanks-movie': ['Tom Hanks', PERSON],
  'will-smith-movie': ['Will Smith', PERSON],
  'steven-spielberg-movie': ['Steven Spielberg', PERSON],
  'christopher-nolan-movie': ['Christopher Nolan', PERSON],
  'charles-dickens-character': ['Charles Dickens', PERSON],
  'shakespeare-play': ['William Shakespeare', PERSON],
  'shakespeare-character': ['William Shakespeare', PERSON],
  'dr-seuss-book': ['Dr. Seuss', PERSON],
  'stephen-king-book': ['Stephen King', PERSON],
  'roald-dahl-book': ['Roald Dahl', PERSON],
  'seinfeld-character': ['Jerry Seinfeld', PERSON],
  'beatles-song': ['The Beatles', BAND],
  'queen-song': ['Queen', BAND],
  'abba-song': ['ABBA', BAND],
  'james-bond-movie': ['James Bond', CHARACTER],
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const portraits = {};

for (const [id, [name, kind]] of Object.entries(SUBJECTS)) {
  const rows = await sparql(`SELECT ?item ?file ?links ?desc WHERE {
    VALUES ?form { ${texts([name]).join(' ')} }
    ?item rdfs:label|skos:altLabel ?form ; wdt:P31/wdt:P279* ${kind} ; wdt:P18 ?file ; wikibase:sitelinks ?links .
    OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
  } ORDER BY DESC(?links) LIMIT 1`);
  const row = rows[0];
  if (!row) {
    console.log(`${id}: no photo for ${name}`);
    continue;
  }
  const file = decodeURIComponent(row.file.value.split('/').pop()).replace(/_/g, ' ');
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}&titles=${encodeURIComponent(`File:${file}`)}`;
  const page = (await (await fetch(url, { headers: { 'User-Agent': USER_AGENT } })).json())?.query?.pages?.[0];
  const ii = page?.imageinfo?.[0];
  if (!ii?.thumburl) {
    console.log(`${id}: no thumbnail for ${file}`);
    continue;
  }
  const meta = ii.extmetadata || {};
  const artist = strip(meta.Artist?.value).replace(/^(.{6,}?)\1/, '$1').slice(0, 80) || 'Unknown';
  const license = strip(meta.LicenseShortName?.value) || 'see file page';
  portraits[id] = { name, img: ii.thumburl, page: ii.descriptionurl, credit: `${artist}, ${license}` };
  console.log(`${id}: ${name} (${row.desc?.value || 'no description'}) <- ${file} [${artist}, ${license}]`);
}

writeFileSync(join(root, 'data', 'portraits.json'), `${JSON.stringify(portraits, null, 1)}\n`);
console.log(`${Object.keys(portraits).length} of ${Object.keys(SUBJECTS).length} prompts have a photo.`);
