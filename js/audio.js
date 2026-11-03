// Every sound is synthesized, so the game ships no audio files.
let ac = null;
let master = null;
let muted = false;
let ambientFilter = null;

function ensure() {
  if (ac) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  ac = new Ctx();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ac.destination);
  startAmbient();
  return true;
}

function tone(freq, dur, { type = 'sine', vol = 0.1, slide = null, delay = 0 } = {}) {
  if (!ac || muted) return;
  const at = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, at + dur);
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function noiseBuffer(seconds, brown = false) {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function noise(dur, { vol = 0.15, cutoff = 1200, delay = 0 } = {}) {
  if (!ac || muted) return;
  const at = ac.currentTime + delay;
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(dur);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff / 6), at + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  source.connect(filter).connect(gain).connect(master);
  source.start(at);
}

function startAmbient() {
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(4, true);
  source.loop = true;
  ambientFilter = ac.createBiquadFilter();
  ambientFilter.type = 'lowpass';
  ambientFilter.frequency.value = 420;
  const gain = ac.createGain();
  gain.gain.value = 0.05;
  source.connect(ambientFilter).connect(gain).connect(master);
  source.start();
}

const LADDER = [233, 277, 330, 392, 466, 554];

export const audio = {
  get muted() { return muted; },
  setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.8;
  },
  unlock() {
    if (ensure() && ac.state === 'suspended') ac.resume();
  },
  setDepth(metres) {
    if (ambientFilter) ambientFilter.frequency.value = Math.max(110, 420 - metres * 0.08);
  },
  click() { tone(520, 0.05, { type: 'square', vol: 0.035 }); },
  bubble() { tone(260 + Math.random() * 200, 0.09, { vol: 0.05, slide: 900 + Math.random() * 300 }); },
  wrong() {
    tone(170, 0.12, { type: 'square', vol: 0.04, slide: 120 });
    tone(120, 0.14, { type: 'square', vol: 0.04, slide: 90, delay: 0.1 });
  },
  tick() { tone(880, 0.04, { type: 'triangle', vol: 0.06 }); },
  splash() {
    noise(0.45, { vol: 0.2, cutoff: 2600 });
    tone(180, 0.2, { vol: 0.08, slide: 60 });
  },
  drop() {
    tone(320, 0.2, { type: 'triangle', vol: 0.06, slide: 90 });
    noise(0.25, { vol: 0.07, cutoff: 900 });
  },
  pass(step) {
    tone(LADDER[step] || 554, 0.14, { type: 'triangle', vol: 0.09 });
    noise(0.1, { vol: 0.03, cutoff: 1600 });
  },
  land(tier) {
    tone(95, 0.32, { vol: 0.26, slide: 42 });
    noise(0.3, { vol: 0.1, cutoff: 700 });
    if (tier >= 3) tone(LADDER[tier], 0.3, { type: 'triangle', vol: 0.07, delay: 0.05 });
    if (tier >= 3) tone(LADDER[tier] * 1.5, 0.34, { type: 'triangle', vol: 0.06, delay: 0.12 });
  },
  gem() {
    [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => {
      tone(freq, 0.2, { type: 'square', vol: 0.05, delay: 0.12 + i * 0.09 });
    });
  },
  miss() {
    tone(330, 0.26, { type: 'triangle', vol: 0.07, slide: 150 });
    tone(220, 0.34, { type: 'triangle', vol: 0.06, slide: 90, delay: 0.14 });
  },
  rise() { noise(0.9, { vol: 0.05, cutoff: 1500 }); },
};
