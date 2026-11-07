// Prompts live in .txt files under data/. A file's category is its name minus any batch number,
// so data/food.txt and data/pool/food-0002.txt are both "food". data/index.json says which file
// holds each prompt, so the game only fetches the files a dive needs. Format:
//
//   ? Name a pasta shape
//   ~drop pasta                      (optional: ignore this word in answers, so "penne pasta" counts)
//   ~last                            (optional: accept a person's last name alone)
//   ~exact                           (optional: no spelling forgiveness, for rhymes and word puzzles)
//   10: Spaghetti, Penne, Lasagna|Lasagne
//   15: Orzo
//   30: Rigatoni
//   60: Pappardelle
//   85: Bucatini
//   100: Strozzapreti :: The line shown when this hidden answer is revealed.
//
// Commas separate answers, | adds a spelling or nickname, and \, is a literal comma.
// Each prompt has exactly one 100-point answer.

export const LIMIT = 25;
export const COUNTDOWN = 3;
export const PROMPTS_PER_DIVE = 7;
export const METRES_PER_POINT = 10;
export const MAX_POINTS = 700;

export const TIERS = [
  { name: 'Plankton', pts: 10, color: '#c4f5d6', emoji: '🫧', icon: 'iconPlankton', blurb: 'What everyone says.',
    lines: ['Everybody and their goldfish said that.', 'That barely got your fins wet.', 'The whole ocean thought of that one.'] },
  { name: 'Too Clever', pts: 15, color: '#ff7fb2', emoji: '🤓', icon: 'iconClever', blurb: 'Sounds obscure. Isn’t.',
    lines: ['You and every other clever fish.', 'Sounds obscure. Isn’t.', 'Nice try. We saw you coming.'] },
  { name: 'Schooler', pts: 30, color: '#62d2f7', emoji: '🐟', icon: 'iconSchooler', blurb: 'A solid, less obvious pick.',
    lines: ['Solid. You’ve got company down here.', 'A respectable swim.', 'Not bad for a fish your size.'] },
  { name: 'Rare', pts: 60, color: '#b98aff', emoji: '🐡', icon: 'iconRare', blurb: 'Not many people get here.',
    lines: ['Not many fish swim this far.', 'The light’s getting thin. Nice.', 'Now you’re getting somewhere.'] },
  { name: 'Deep Cut', pts: 85, color: '#ff8a5c', emoji: '🦑', icon: 'iconDeep', blurb: 'Specialist knowledge.',
    lines: ['Who taught you that?', 'The locals are staring.', 'Even the anglerfish is impressed.'] },
  { name: 'One in a Fihllion', pts: 100, color: '#ffd24d', emoji: '🌟', icon: 'iconGem', blurb: 'The one answer hidden on each prompt.',
    lines: ['You found the one we hid down here.'] },
];

const PTS_TO_TIER = { 10: 0, 15: 1, 30: 2, 60: 3, 85: 4, 100: 5 };

export const RANKS = [
  { min: 0, name: 'Bowl Dweller', joke: 'The castle in your bowl misses you.' },
  { min: 100, name: 'Lamp Chaser', joke: 'You made it down to where the sun gives up.' },
  { min: 200, name: 'Midnight Regular', joke: 'Deeper than most whales bother going.' },
  { min: 300, name: 'Wreck Diver', joke: 'You’re in Titanic territory now.' },
  { min: 400, name: 'Abyss Cruiser', joke: 'Nothing down here has ever seen the sun.' },
  { min: 500, name: 'Pressure Proof', joke: 'A goldfish should not be this deep. Yet here you are.' },
  { min: 600, name: 'Hadal Terror', joke: 'Named after the underworld, and you fit right in.' },
  { min: 700, name: 'One in a Fihllion', joke: 'A perfect dive. The goldfish is as surprised as you are.' },
];

export const rankFor = (points) => [...RANKS].reverse().find((r) => points >= r.min);

const slug = (text) => text.toLowerCase()
  .replace(/^name (a |an |the |some )?/, '')
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

function entry(raw, tier) {
  const [name, ...aliases] = raw.split('|').map((part) => part.trim()).filter(Boolean);
  return { name, aliases, tier };
}

export function parsePrompts(text, category) {
  const prompts = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('? ')) {
      const promptText = line.slice(2).trim();
      current = { id: slug(promptText), text: promptText, category, answers: [], gem: null, lastName: false, exact: false, drop: [] };
      prompts.push(current);
      continue;
    }
    if (!current) throw new Error(`${category}: answers before any prompt: ${line}`);
    if (line === '~last') { current.lastName = true; continue; }
    if (line === '~exact') { current.exact = true; continue; }
    if (line.startsWith('~drop ')) {
      current.drop = line.slice(6).split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);
      continue;
    }
    const match = line.match(/^(10|15|30|60|85|100):\s*(.*)$/);
    if (!match) throw new Error(`${category}: can't read line: ${line}`);
    const tier = PTS_TO_TIER[match[1]];
    if (tier === 5) {
      const [answer, blurb = ''] = match[2].split('::').map((part) => part.trim());
      current.gem = { ...entry(answer.replace(/\\,/g, ','), 5), blurb };
      current.answers.push(current.gem);
      continue;
    }
    const pieces = match[2].replace(/\\,/g, '\u0001').split(',');
    for (const piece of pieces) {
      const cleaned = piece.replace(/\u0001/g, ',').trim();
      if (cleaned) current.answers.push(entry(cleaned, tier));
    }
  }
  for (const prompt of prompts) prompt.answers.sort((a, b) => a.tier - b.tier);
  return prompts;
}

const utcDay = (year, month, day) => Date.UTC(year, month, day) / 86400000;

export function makeCalendar(schedule) {
  const [y, m, d] = schedule.epoch.split('-').map(Number);
  const epoch = utcDay(y, m - 1, d);
  const first = new Map();
  schedule.days.forEach((ids, i) => ids.forEach((id) => { if (!first.has(id)) first.set(id, i + 1); }));
  return {
    dayNumber(date) {
      return Math.max(1, utcDay(date.getFullYear(), date.getMonth(), date.getDate()) - epoch + 1);
    },
    dateOf(day) {
      const utc = new Date((epoch + day - 1) * 86400000);
      return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
    },
    idsFor(day) {
      return schedule.days[(day - 1) % schedule.days.length];
    },
    // The first day a prompt is the daily dive, or null if it isn't on the schedule.
    firstDay(id) {
      return first.get(id) ?? null;
    },
  };
}

async function fetchOk(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res;
}

// Loads the schedule and the prompt index. Prompt files load later, when a dive needs them.
export async function loadContent() {
  const [schedule, index] = await Promise.all(['data/schedule.json', 'data/index.json'].map((path) => fetchOk(path).then((res) => res.json())));
  const fileOf = new Map(index.prompts.map(([id, file]) => [id, file]));
  const byId = new Map();
  const loading = new Map();
  const filesFor = (ids) => [...new Set(ids.map((id) => fileOf.get(id)))];

  const loadFile = (i, options) => {
    if (!loading.has(i)) {
      const { path, category } = index.files[i];
      const job = fetchOk(`data/${path}`, options).then((res) => res.text()).then((text) => {
        for (const prompt of parsePrompts(text, category)) byId.set(prompt.id, prompt);
      });
      // A failed fetch is forgotten, so the next request tries again.
      job.catch(() => loading.delete(i));
      loading.set(i, job);
    }
    return loading.get(i);
  };

  return {
    calendar: makeCalendar(schedule),
    ids: index.prompts.map(([id]) => id),
    byId,
    categoryOf: (id) => index.files[fileOf.get(id)]?.category ?? null,
    has: (ids) => ids.every((id) => byId.has(id)),
    async load(ids) {
      const unknown = ids.filter((id) => !fileOf.has(id));
      if (unknown.length) throw new Error(`not in data/index.json: ${unknown.join(', ')}`);
      await Promise.all(filesFor(ids).map((i) => loadFile(i)));
      // A copy the browser cached before a prompt was added won't have it, so fetch past the cache once.
      const missing = ids.filter((id) => !byId.has(id));
      if (!missing.length) return;
      for (const i of filesFor(missing)) loading.delete(i);
      await Promise.all(filesFor(missing).map((i) => loadFile(i, { cache: 'reload' })));
      const lost = ids.filter((id) => !byId.has(id));
      if (lost.length) throw new Error(`missing from their files: ${lost.join(', ')}`);
    },
  };
}
