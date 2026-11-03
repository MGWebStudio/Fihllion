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
  const add = (key, answer) => {
    if (!key) return;
    if (!exact.has(key)) exact.set(key, answer);
    forms.push({ key, answer });
  };
  // Answers are sorted common-first, so a shared spelling resolves to the commoner answer.
  for (const answer of prompt.answers) {
    for (const form of [answer.name, ...answer.aliases]) add(normalize(form, prompt.drop), answer);
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

function allowedEdits(a, b) {
  const longest = Math.max(a.length, b.length);
  if (longest <= 3) return 0;
  if (longest <= 7) return a[0] === b[0] || longest >= 6 ? 1 : 0;
  return a[0] === b[0] ? 2 : 1;
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
  return best;
}
