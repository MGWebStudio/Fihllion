// Turns what a player typed into one of the prompt's accepted answers.

const FOLD = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

function words(text, drop = []) {
  const cleaned = text
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øæœßłđðþı]/g, (ch) => FOLD[ch])
    .replace(/&/g, ' and ')
    .replace(/['’`.]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  let parts = cleaned.split(' ').filter(Boolean);
  if (parts.length > 1 && ['the', 'a', 'an'].includes(parts[0])) parts = parts.slice(1);
  if (drop.length) {
    const kept = parts.filter((part) => !drop.includes(part));
    if (kept.length) parts = kept;
  }
  return parts;
}

export const normalize = (text, drop) => words(text, drop).join('');

function singular(key) {
  if (key.length <= 4) return key;
  if (key.endsWith('ies')) return `${key.slice(0, -3)}y`;
  if (/(ch|sh|x|z|ss)es$/.test(key)) return key.slice(0, -2);
  if (key.endsWith('s') && !/(ss|us|is)$/.test(key)) return key.slice(0, -1);
  return key;
}

export function buildIndex(prompt) {
  const exact = new Map();
  const forms = [];
  const add = (key, answer, sound = null) => {
    if (!key) return;
    if (!exact.has(key)) exact.set(key, answer);
    forms.push({ key, answer, sound });
  };
  // Answers are sorted common-first, so a shared spelling resolves to the commoner answer.
  for (const answer of prompt.answers) {
    for (const form of [answer.name, ...answer.aliases]) add(normalize(form, prompt.drop), answer, sounds(form, prompt.drop));
  }
  if (!prompt.exact) {
    for (const answer of prompt.answers) {
      for (const form of [answer.name, ...answer.aliases]) add(singular(normalize(form, prompt.drop)), answer);
    }
  }
  if (prompt.lastName) {
    for (const answer of prompt.answers) {
      const parts = words(answer.name);
      if (parts.length > 1) add(parts[parts.length - 1], answer);
    }
  }
  return { exact, forms, drop: prompt.drop, strict: prompt.exact };
}

function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      row.push(value);
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    before = prev;
    prev = row;
  }
  return prev[b.length];
}

// First letters that sound alike count as the same start, so "crave" is one letter off Krave.
const START = { c: 'k', k: 'k', q: 'k', s: 's', z: 's', f: 'f', v: 'f', i: 'i', y: 'i' };
const sameStart = (a, b) => a[0] === b[0] || (START[a[0]] && START[a[0]] === START[b[0]]);

function allowedEdits(a, b) {
  const longest = Math.max(a.length, b.length);
  if (longest <= 3) return 0;
  if (longest <= 7) return sameStart(a, b) || longest >= 6 ? 1 : 0;
  return sameStart(a, b) ? 2 : 1;
}

// How a word sounds, roughly: vowels after the first letter drop out, letters that sound alike
// share a code (c/k/q, ph/f, s/z, sh/ch) and doubled sounds count once. "sentar" and "Centaur"
// both sound like SNTR, and "airheart" and "Earhart" like ART, so a guess spelled the way it
// sounds still counts. Words are compared one by one, so "john white" isn't "John Doe".
const SOUND_MIN = 6; // shorter words share their consonants too often: tiger and Toyger, water and weather
const VOWELS = 'aeiouy';
const sounds = (text, drop) => words(text, drop).map(soundKey).join(' ');
export function soundKey(key) {
  const s = key.replace(/^(kn|gn|pn|ps|pt|wr)/, (pair) => pair[1]);
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    const next = s[i + 1] || '';
    if (VOWELS.includes(c)) {
      if (i === 0) out += 'A';
      continue;
    }
    switch (c) {
      case 'c': out += next === 'h' ? 'X' : 'eiy'.includes(next) && next ? 'S' : 'K'; break;
      case 'd': out += 'T'; break;
      case 'g': out += next === 'h' ? '' : 'G'; break;
      case 'h': out += i === 0 ? 'H' : ''; break;
      case 'p': out += next === 'h' ? 'F' : 'P'; break;
      case 'q': out += 'K'; break;
      case 's': out += next === 'h' ? 'X' : next === 'c' && s[i + 2] === 'h' ? '' : 'S'; break;
      case 'v': out += 'F'; break;
      case 'w': out += VOWELS.includes(next) && next ? 'W' : ''; break;
      case 'x': out += i === 0 ? 'S' : 'KS'; break;
      case 'z': out += 'S'; break;
      default: out += c.toUpperCase();
    }
  }
  return out.replace(/(.)\1+/g, '$1');
}

export function findAnswer(input, index) {
  const key = normalize(input, index.drop);
  if (!key) return null;
  if (index.strict) return index.exact.get(key) || null;
  const direct = index.exact.get(key) || index.exact.get(singular(key));
  if (direct) return direct;
  let best = null;
  let bestDistance = Infinity;
  for (const form of index.forms) {
    const limit = allowedEdits(key, form.key);
    if (limit === 0) continue;
    const distance = editDistance(key, form.key, limit);
    if (distance <= limit && distance < bestDistance) {
      best = form.answer;
      bestDistance = distance;
    }
  }
  if (best || key.length < SOUND_MIN) return best;
  // Nothing a letter or two off, so try sound-alike spellings. They still have to be close: one
  // more letter off than usual (two more for long answers), so words that only share their
  // consonants, like midas and Medusa, don't match.
  const sound = sounds(input, index.drop);
  const limit = key.length >= 11 ? 3 : 2;
  for (const form of index.forms) {
    if (form.sound !== sound || !sameStart(key, form.key)) continue;
    if (editDistance(key, form.key, limit) <= limit) return form.answer;
  }
  return null;
}
