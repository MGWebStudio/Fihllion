// localStorage can throw or come back empty (private windows, blocked storage), so the
// game also keeps everything in memory and still works for the length of the visit.
const PREFIX = 'fihllion.';
const memory = new Map();

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* fall through to memory */ }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function set(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* memory copy is enough */ }
}

export function keysWith(prefix) {
  const found = new Set([...memory.keys()].filter((key) => key.startsWith(prefix)));
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key.startsWith(PREFIX + prefix)) found.add(key.slice(PREFIX.length));
    }
  } catch { /* memory keys only */ }
  return [...found];
}
