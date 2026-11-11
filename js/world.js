import * as art from './sprites.js';
import { TIERS, METRES_PER_POINT } from './content.js';
import { audio } from './audio.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x) => {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f));
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const rgb = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const RAMP = [
  [0, [52, 196, 190]], [40, [31, 158, 172]], [120, [20, 118, 148]], [250, [15, 86, 122]],
  [500, [12, 60, 100]], [1000, [10, 40, 80]], [2000, [11, 26, 64]], [4000, [9, 15, 44]],
  [6000, [5, 8, 26]], [7000, [2, 4, 13]],
];
function waterRGB(m) {
  if (m <= 0) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i += 1) {
    if (m <= RAMP[i][0]) return mix(RAMP[i - 1][1], RAMP[i][1], (m - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]));
  }
  return RAMP[RAMP.length - 1][1];
}
const SKY_TOP = [116, 203, 238];
const SKY_LOW = [255, 236, 200];

const METRES_ON_SCREEN = 380;
export const TITLE_SURFACE = 0.52;
const PLAY_OFFSET = 0.3;
const SINK_OFFSET = 0.42;
const REVEAL_OFFSET = 0.25;

const CAPTIONS = [
  { m: 40, text: 'recreational divers turn back here' },
  { m: 150, text: 'goldfish remember things for months. the 3-second thing is a myth.' },
  { m: 200, text: 'THE TWILIGHT ZONE', big: true },
  { m: 300, text: 'your bowl is now extremely far away' },
  { m: 564, text: 'an emperor penguin has been tracked this deep' },
  { m: 700, text: 'coelacanths lurk here. thought extinct until 1938.' },
  { m: 880, text: 'the oldest goldfish on record lived to 43' },
  { m: 1000, text: 'THE MIDNIGHT ZONE', big: true },
  { m: 1090, text: 'no sunlight at all. every light from here on is alive.' },
  { m: 1280, text: 'a leatherback turtle has dived this far' },
  { m: 1650, text: 'anglerfish fish with their own flashlights' },
  { m: 2000, text: 'pressure: 200x the surface. goldfish not rated for this.' },
  { m: 2388, text: 'an elephant seal has been logged at this depth' },
  { m: 2992, text: 'the mammal record: a Cuvier’s beaked whale' },
  { m: 3320, text: 'the water hovers just above freezing' },
  { m: 3688, text: 'the average depth of the entire ocean' },
  { m: 3800, text: 'the Titanic lies this deep', wreck: true },
  { m: 4000, text: 'THE ABYSSAL ZONE', big: true },
  { m: 4100, text: 'abyss: from the Greek for “bottomless”' },
  { m: 4791, text: 'the battleship Bismarck came to rest here' },
  { m: 5200, text: 'abyssal plains: some of the flattest ground on Earth' },
  { m: 6000, text: 'THE HADAL ZONE', big: true },
  { m: 6100, text: 'hadal, as in Hades. the ocean’s basement.' },
  { m: 6895, text: 'the wreck of USS Samuel B. Roberts' },
  { m: 6957, text: 'the deepest octopus ever filmed: a dumbo' },
  { m: 7000, text: 'a perfect dive ends here. the real trench keeps going for 3,900 m.' },
];

// Which creatures can turn up at a given depth.
function creaturePool(m) {
  if (m < 250) return ['school', 'school', 'school', 'school', 'turtle', 'whale'];
  if (m < 1000) return ['school', 'jelly', 'jelly', 'squid', 'lantern', 'lantern', 'whale'];
  if (m < 4000) return ['lantern', 'lantern', 'angler', 'angler', 'jelly', 'squid', 'eel'];
  return ['dumbo', 'dumbo', 'snail', 'snail', 'eel', 'jelly', 'angler'];
}

const LINES_TO_SAY = ['blub', 'blub blub', 'wait, what was the question?', 'who are you again?', 'is it lunch?', 'am i deep yet?', 'i forgot', 'nice castle', 'blub?'];
const THANKSGIVING_LINES = ['gobble?', 'is it pie time yet?', 'i’m thankful for… what was i saying?', 'save me some stuffing', 'pass the fish flakes', 'do you like my hat?'];

export class World {
  constructor(canvas, { theme = null } = {}) {
    this.canvas = canvas;
    this.theme = theme?.name || null;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0;
    this.last = 0;
    this.depth = 0;
    this.diving = false;
    this.rulerAlpha = 0;
    this.bubbles = [];
    this.sparks = [];
    this.pastAnchors = [];
    this.anchor = null;
    this.sink = null;
    this.ascent = null;
    this.restLine = null;
    this.flash = 0;
    this.camRate = 3;
    this.bubbleClock = 1;
    this.fish = { x: 0, m: 0, vx: 0, vy: 0, flip: false, angle: 0, mode: 'bowl', phase: 0, say: null, sayUntil: 0 };
    this.W = this.H = 1;
    this.P = this.dpr = this.ppm = 1;
    this.cam = this.camTarget = 0;
    this.boatX = 0;
    this.buildArt();
    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', (event) => this.onPointer(event));
    requestAnimationFrame((t) => this.frame(t));
  }

  buildArt() {
    this.fishSprite = art.goldfish();
    this.anchorSprite = art.anchor();
    this.boat = art.boat();
    this.sunSprite = art.sun();
    this.clouds = [0, 1, 2, 3, 4, 5].map((seed) => art.cloud(seed));
    this.fishGlow = art.glow(255, 186, 96);
    this.bubbleRings = this.makeBubbles();
    this.dark = {};
    this.light = {};
    for (const name of ['smallfish', 'turtle', 'whale', 'jelly', 'squid', 'lantern', 'angler', 'dumbo', 'eel', 'snail', 'wreck']) {
      this.dark[name] = art.silhouette(name, '#04263a');
      this.light[name] = art.silhouette(name, '#3f6480');
    }
    this.tierIcons = TIERS.map((tier) => art.icon(tier.icon));
    this.snow = Array.from({ length: 70 }, (_, i) => ({
      x: hash(i + 1), y: hash(i + 101), z: 0.35 + hash(i + 201) * 0.65, v: 0.004 + hash(i + 301) * 0.012, blink: hash(i + 401),
    }));
    this.skyTop = SKY_TOP;
    this.skyLow = SKY_LOW;
    this.lines = LINES_TO_SAY;
    this.captions = CAPTIONS;
    this.hat = null;
    this.leafSprites = null;
    this.indoors = false;
    this.room = null;
    if (this.theme === 'thanksgiving') this.dressForThanksgiving();
  }

  // The bowl moves indoors: a dining room with leaves falling past the window, a pilgrim hat,
  // and a turkey riding along on a boat in the fish tank.
  dressForThanksgiving() {
    this.indoors = true;
    this.skyTop = [134, 146, 112];
    this.skyLow = [134, 146, 112];
    this.captions = [...CAPTIONS, { m: 14, text: 'this tank is deeper than it looks', side: 'right' }];
    art.dressBoatForThanksgiving(this.boat);
    this.hat = art.pilgrimHat();
    this.lines = [...LINES_TO_SAY, ...THANKSGIVING_LINES];
    this.leafSprites = art.leaves();
    const leaf = (i, seed) => ({
      x: hash(seed + i), y: hash(seed + 50 + i), v: hash(seed + 100 + i), sway: hash(seed + 150 + i),
      ph: hash(seed + 200 + i) * Math.PI * 2, sprite: Math.floor(hash(seed + 250 + i) * this.leafSprites.length),
    });
    this.windowLeaves = Array.from({ length: 7 }, (_, i) => leaf(i, 1500));
    this.floatLeaves = Array.from({ length: 5 }, (_, i) => leaf(i, 1800));
    this.seaLeaves = Array.from({ length: 14 }, (_, i) => leaf(i, 2100));
  }

  makeBubbles() {
    return [2, 3, 5].map((r) => {
      const size = r * 2 + 1;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const d = Math.hypot(x - r, y - r);
          if (d <= r + 0.3 && d > r - 0.9) {
            ctx.fillStyle = 'rgba(214,247,255,.8)';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillRect(r - Math.ceil(r / 2), r - Math.ceil(r / 2), 1, 1);
      return c;
    });
  }

  resize() {
    // A page opened in a hidden tab or pane can report a zero-sized window.
    if (!innerWidth || !innerHeight) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const oldW = this.W || innerWidth * dpr;
    this.dpr = dpr;
    this.W = Math.round(innerWidth * dpr);
    this.H = Math.round(innerHeight * dpr);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const pixel = clamp(Math.round(Math.max(innerWidth, innerHeight) / 480), 2, 3);
    this.P = Math.round(pixel * dpr);
    this.ppm = this.H / METRES_ON_SCREEN;
    this.boatX = innerWidth / innerHeight > 1.15 ? this.W * 0.77 : this.W * 0.5;
    this.fish.x *= this.W / oldW;
    this.captionLayout = null;
    if (this.indoors) this.buildRoom();
    this.ctx.imageSmoothingEnabled = false;
    if (!this.diving && !this.ascent) this.snapToTitle();
    if (this.fish.mode === 'bowl') this.placeFishInBowl();
  }

  // Camera ---------------------------------------------------------------------------
  titleCam() { return -TITLE_SURFACE * this.H / this.ppm; }
  // Where the title screen's text has to stop, in CSS pixels, to stay clear of the water and the bowl.
  titleTextLimit() {
    const surface = TITLE_SURFACE * this.H;
    const rim = art.BOAT.waterline - art.BOAT.bowl.y + art.BOAT.bowl.r - 3;
    return (this.boatX > this.W * 0.6 ? surface : surface - rim * this.P) / this.dpr;
  }
  snapToTitle() { this.cam = this.camTarget = this.titleCam(); }
  m2y(m) { return (m - this.cam) * this.ppm; }
  y2m(y) { return y / this.ppm + this.cam; }
  view(mode) {
    const screens = this.H / this.ppm;
    if (mode === 'title') this.camTarget = this.titleCam();
    if (mode === 'play') this.camTarget = this.depth - PLAY_OFFSET * screens;
    if (mode === 'reveal') this.camTarget = this.depth - REVEAL_OFFSET * screens;
    this.camRate = this.reduced ? 40 : 2.6;
  }

  // Scene changes ---------------------------------------------------------------------
  setDive(depth, rounds) {
    this.depth = depth;
    this.diving = true;
    this.anchor = null;
    this.sink = null;
    this.restLine = null;
    this.pastAnchors = rounds;
  }

  clearDive() {
    this.diving = false;
    this.depth = 0;
    this.pastAnchors = [];
    this.restLine = null;
    this.anchor = null;
    this.sink = null;
    this.ascent = null;
    this.fish.mode = 'bowl';
    this.view('title');
  }

  // The goldfish leaves the bowl. With jump off (resuming, or reduced motion) it's already in the water.
  enterWater({ jump }) {
    return new Promise((resolve) => {
      const done = () => {
        this.fish.mode = 'idle';
        this.view('play');
        setTimeout(resolve, this.reduced ? 0 : 520);
      };
      if (!jump || this.reduced || this.fish.mode !== 'bowl') {
        this.fish.x = this.W * 0.5;
        this.fish.m = Math.max(this.depth, 0) + 30;
        this.fish.vx = this.fish.vy = 0;
        done();
        return;
      }
      const f = this.fish;
      f.mode = 'jump';
      f.onSplash = done;
      const leftward = this.boatX > this.W * 0.6;
      f.vx = (leftward ? -1 : 1) * this.W * 0.22;
      f.vy = -this.H * 0.86;
      audio.bubble();
    });
  }

  setFishMode(mode) { this.fish.mode = mode; }

  say(text) {
    this.fish.say = text;
    this.fish.sayUntil = this.time + 2.1;
  }

  onPointer(event) {
    if (this.sink || this.ascent) { this.hurry(); return; }
    const x = event.clientX * this.dpr;
    const y = event.clientY * this.dpr;
    const f = this.fish;
    if (Math.hypot(x - f.x, y - this.m2y(f.m)) < 26 * this.P) {
      this.say(this.lines[Math.floor(Math.random() * this.lines.length)]);
      this.burst(f.x, f.m, 5);
      audio.unlock();
      audio.bubble();
    }
  }

  hurry() {
    if (this.sink) this.sink.speed = 3.5;
    if (this.ascent) this.ascent.speed = 3.5;
  }

  // Drop the answer. Each tier line is a stop on the way down, so the speed never gives the result away.
  drop({ name, tier }) {
    return new Promise((resolve) => {
      const base = this.depth;
      const stops = TIERS.map((t) => t.pts * METRES_PER_POINT);
      const segs = [];
      let prev = 0;
      for (let i = 0; i <= tier; i += 1) {
        const dur = (0.5 + (stops[i] - prev) / 320) * (this.reduced ? 0.3 : 1);
        segs.push({ from: prev, to: stops[i], dur });
        prev = stops[i];
      }
      this.sink = {
        base, tier, segs, seg: 0, t: 0, speed: 1, resolve,
        lines: TIERS.map((t, i) => ({ m: base + stops[i], tier: i, passed: false })),
      };
      this.anchor = { name, tier, m: base, swing: 0 };
      this.fish.mode = 'chase';
      audio.drop();
    });
  }

  updateSink(dt) {
    const s = this.sink;
    s.t += dt * s.speed;
    let seg = s.segs[s.seg];
    if (s.t >= seg.dur) {
      s.t -= seg.dur;
      this.anchor.m = s.base + seg.to;
      s.lines[s.seg].passed = true;
      s.seg += 1;
      this.burst(this.boatlessX(), this.anchor.m, 4);
      if (s.seg >= s.segs.length) {
        this.landAnchor();
        return;
      }
      audio.pass(s.seg - 1);
      seg = s.segs[s.seg];
    }
    const k = clamp(s.t / seg.dur, 0, 1);
    this.anchor.m = s.base + lerp(seg.from, seg.to, easeInOut(k));
    this.camTarget = this.anchor.m - SINK_OFFSET * this.H / this.ppm;
    this.camRate = 7;
  }

  boatlessX() { return this.W / 2; }

  landAnchor() {
    const s = this.sink;
    const a = this.anchor;
    const tier = s.tier;
    this.depth = s.base + TIERS[tier].pts * METRES_PER_POINT;
    a.m = this.depth;
    this.restLine = { m: this.depth, tier };
    this.pastAnchors = [...this.pastAnchors, { name: a.name, tier, m: this.depth }];
    this.anchor = null;
    this.sink = null;
    this.fish.mode = 'party';
    this.fish.partyStart = this.time;
    this.burst(this.W / 2, this.depth, 12 + tier * 5);
    audio.land(tier);
    if (tier === 5) {
      this.goldBurst();
      audio.gem();
    }
    setTimeout(s.resolve, this.reduced ? 0 : 420);
  }

  goldBurst() {
    if (this.reduced) return;
    this.flash = 0.5;
    const x = this.W / 2;
    const y = this.m2y(this.depth);
    for (let i = 0; i < 70; i += 1) {
      const a = (i / 70) * Math.PI * 2;
      const v = (160 + hash(i + 7) * 460) * this.dpr;
      this.sparks.push({ x, y0: this.y2m(y), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 140 * this.dpr, life: 1.1 + hash(i) * 0.6, age: 0, color: hash(i + 3) > 0.5 ? '#ffc94d' : '#fff3c4', m: this.depth });
    }
  }

  // Back up past every answer of the dive.
  ascend() {
    return new Promise((resolve) => {
      const from = this.cam;
      const to = this.titleCam();
      const dur = this.reduced ? 0.01 : Math.min(5.5, 1.5 + this.depth / 1500);
      this.restLine = null;
      this.ascent = { from, to, t: 0, dur, speed: 1, resolve };
      this.fish.mode = 'rise';
      audio.rise();
    });
  }

  updateAscent(dt) {
    const a = this.ascent;
    a.t += dt * a.speed;
    const k = clamp(a.t / a.dur, 0, 1);
    this.cam = this.camTarget = lerp(a.from, a.to, easeInOutCubic(k));
    if (this.cam < this.titleCam() + 110 && this.fish.mode === 'rise') this.fish.mode = 'bowl';
    if (k >= 1) {
      this.ascent = null;
      this.diving = false;
      this.fish.mode = 'bowl';
      a.resolve();
    }
  }

  burst(x, m, count) {
    if (this.reduced) return;
    for (let i = 0; i < count; i += 1) {
      this.bubbles.push({
        x: x + (Math.random() - 0.5) * 42 * this.P,
        m: m + (Math.random() - 0.5) * 8,
        v: 14 + Math.random() * 26,
        size: Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2,
        life: 1.5 + Math.random() * 1.6,
        age: 0,
        wob: Math.random() * 6,
      });
    }
  }

  splash(x) {
    audio.splash();
    if (this.reduced) return;
    for (let i = 0; i < 26; i += 1) {
      const a = -Math.PI * (0.12 + Math.random() * 0.76);
      const v = (120 + Math.random() * 300) * this.dpr;
      this.sparks.push({ x, y0: 0, m: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900 * this.dpr, life: 0.9, age: 0, color: hash(i) > 0.5 ? '#eafcff' : '#9fe8ea' });
    }
    this.burst(x, 10, 12);
  }

  // Fish ------------------------------------------------------------------------------
  bowlPoint() {
    const { P } = this;
    const yS = this.m2y(0);
    const bob = this.boatBob();
    const y = yS + bob - (art.BOAT.waterline - art.BOAT.bowl.y) * P;
    return { x: this.boatX, m: this.y2m(y) };
  }

  boatBob() {
    return Math.round(Math.sin(this.time * 1.1) * 1.4) * this.P;
  }

  placeFishInBowl() {
    const b = this.bowlPoint();
    this.fish.x = b.x;
    this.fish.m = b.m;
    this.fish.vx = this.fish.vy = 0;
  }

  updateFish(dt) {
    const f = this.fish;
    const t = this.time;
    const { P } = this;
    const screens = this.H / this.ppm;
    let tx = f.x;
    let tm = f.m;
    let k = 8;
    let c = 3.2;
    switch (f.mode) {
      case 'bowl': {
        const b = this.bowlPoint();
        tx = b.x + Math.sin(t * 0.8) * 5 * P;
        tm = b.m + (Math.sin(t * 1.3) * 3 * P) / this.ppm - (1.5 * P) / this.ppm;
        k = 26;
        c = 7;
        break;
      }
      case 'idle':
        tx = this.W * (0.5 + 0.3 * Math.sin(t * 0.33));
        tm = this.depth - PLAY_OFFSET * screens + 0.6 * screens + Math.sin(t * 0.8) * 8;
        k = 3;
        c = 2.2;
        break;
      case 'chase': {
        const a = this.anchor;
        if (a) {
          tx = this.W / 2 + Math.sin(t * 2.2) * 58 * P * 0.6 + 40 * P;
          tm = a.m - 26 + Math.sin(t * 3.1) * 7;
        }
        k = 22;
        c = 5.5;
        break;
      }
      case 'party': {
        const spin = (t - f.partyStart) * 3.6;
        tx = this.W / 2 + Math.min(74 * P, this.W * 0.28) + Math.cos(spin) * 20 * P;
        tm = this.depth - 16 + Math.sin(spin) * 12;
        k = 26;
        c = 6;
        break;
      }
      case 'rise':
        tx = this.W / 2 + Math.sin(t * 1.4) * 18 * P;
        tm = this.cam + screens * 0.55;
        k = 14;
        c = 6;
        break;
      case 'jump':
        f.vy += this.H * 1.75 * dt;
        f.x += f.vx * dt;
        f.m += (f.vy * dt) / this.ppm;
        if (f.m >= 0 && f.vy > 0) {
          f.mode = 'dive';
          f.vx *= 0.4;
          f.vy *= 0.35;
          this.splash(f.x);
          if (f.onSplash) f.onSplash();
          f.onSplash = null;
        }
        break;
      default:
        break;
    }
    if (f.mode !== 'jump') {
      f.vx += (tx - f.x) * k * dt;
      f.vy += (tm - f.m) * this.ppm * k * dt;
      const decay = Math.exp(-c * dt);
      f.vx *= decay;
      f.vy *= decay;
      const wasWet = f.m >= 0;
      f.x += f.vx * dt;
      f.m += (f.vy * dt) / this.ppm;
      // Riding up with the camera, too fast for the spring to keep the fish on screen.
      if (f.mode === 'rise') {
        f.m = tm;
        f.vy = -this.H * 0.5;
      }
      if (wasWet !== (f.m >= 0)) this.splash(f.x);
    }
    const speed = Math.hypot(f.vx, f.vy);
    if (Math.abs(f.vx) > 14 * this.dpr) f.flip = f.vx < 0;
    const pitch = f.mode === 'bowl'
      ? 0
      : clamp(Math.atan2(f.vy, Math.abs(f.vx) + 60 * this.dpr), f.mode === 'jump' ? -1.2 : -0.62, f.mode === 'jump' ? 1.2 : 0.62);
    f.angle += (pitch - f.angle) * Math.min(1, dt * 8);
    f.phase += dt * (5 + Math.min(16, speed / (28 * this.dpr)));

    this.bubbleClock -= dt;
    if (this.bubbleClock <= 0 && f.m > 3 && f.mode !== 'bowl') {
      this.bubbleClock = 0.9 + Math.random() * 1.4;
      this.bubbles.push({ x: f.x + (f.flip ? -1 : 1) * 15 * P, m: f.m - 2, v: 18 + Math.random() * 10, size: Math.random() < 0.6 ? 0 : 1, life: 2.4, age: 0, wob: Math.random() * 6 });
    }
  }

  // Frame -----------------------------------------------------------------------------
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.time += dt;

    if (this.sink) this.updateSink(dt);
    if (this.ascent) {
      this.updateAscent(dt);
    } else {
      this.cam += (this.camTarget - this.cam) * (1 - Math.exp(-dt * this.camRate));
    }
    this.updateFish(dt);
    for (const b of this.bubbles) {
      b.age += dt;
      b.m -= b.v * dt;
    }
    this.bubbles = this.bubbles.filter((b) => b.age < b.life && b.m > -1);
    for (const s of this.sparks) s.age += dt;
    this.sparks = this.sparks.filter((s) => s.age < s.life);
    this.flash = Math.max(0, this.flash - dt * 1.3);
    this.rulerAlpha += ((this.diving ? 1 : 0) - this.rulerAlpha) * Math.min(1, dt * 3);
    audio.setDepth(Math.max(0, this.y2m(this.H / 2)));

    this.draw();
  }

  shownDepth() {
    return this.anchor ? this.anchor.m : this.depth;
  }

  draw() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    this.drawBackdrop(ctx);
    const yS = this.m2y(0);
    if (yS > -80 * this.P) {
      if (this.room) this.drawRoom(ctx, yS);
      else this.drawSky(ctx);
      this.drawBoat(ctx);
      this.drawWaves(ctx, yS);
      if (this.leafSprites) this.drawFloatingLeaves(ctx, yS);
      if (this.room) this.drawGlass(ctx, yS);
    }
    this.drawRays(ctx, yS);
    this.drawWall(ctx, 0.84, 1.7, 0.32);
    this.drawCreatures(ctx);
    this.drawLandmarks(ctx);
    this.drawWall(ctx, 1, 1, 0.62);
    this.drawKelp(ctx);
    this.drawSnow(ctx);
    if (this.leafSprites) this.drawSeaLeaves(ctx);
    this.drawCaptions(ctx);
    this.drawRuler(ctx);
    this.drawTierLines(ctx);
    this.drawPastAnchors(ctx);
    if (this.anchor) this.drawSign(ctx, this.anchor.name, this.anchor.m, Math.sin(this.time * 2.6) * 0.05, null);
    this.drawBubbles(ctx);
    if (this.fish.mode !== 'bowl' || this.fish.m > 0) this.drawFish(ctx);
    this.drawSparks(ctx);
    this.drawSpeech(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,214,120,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  drawBackdrop(ctx) {
    const { W, H, P } = this;
    const band = P * 3;
    const yWater = this.m2y(0) + 9 * P;
    const skySpan = H * 0.62;
    for (let y = 0; y < H; y += band) {
      if (y + band <= yWater) {
        const t = clamp((yWater - y) / skySpan, 0, 1);
        ctx.fillStyle = rgb(mix(this.skyLow, this.skyTop, smooth(0, 1, t)));
      } else {
        ctx.fillStyle = rgb(waterRGB(this.y2m(y + band / 2)));
      }
      ctx.fillRect(0, y, W, band);
    }
  }

  drawSky(ctx) {
    const { W, H, P } = this;
    const yS = this.m2y(0);
    const sw = this.sunSprite.width * P;
    const sunX = this.boatX > W * 0.6 ? W * 0.14 : W * 0.82;
    ctx.drawImage(this.sunSprite, Math.round(sunX - sw / 2), Math.round(yS - H * 0.43), sw, sw);
    this.clouds.forEach((cloud, i) => {
      const cw = cloud.width * P;
      const span = W + cw * 2;
      const x = ((hash(i + 21) * span + this.time * (3 + i * 1.3) * this.dpr) % span) - cw;
      const y = yS - H * (0.1 + hash(i + 40) * 0.36) - cloud.height * P;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(cloud, Math.round(x / P) * P, Math.round(y / P) * P, cw, cloud.height * P);
    });
    ctx.globalAlpha = 1;
  }

  // Lays out the Thanksgiving dining room for this screen: the window goes on the side away
  // from the boat, and on wide screens a portrait hangs beside the bowl.
  buildRoom() {
    const { W, H, P } = this;
    const w = Math.ceil(W / P);
    const waterY = Math.ceil((TITLE_SURFACE * H) / P);
    const boatAt = this.boatX / P;
    const keepClear = [boatAt - art.BOAT.w / 2 - 2, boatAt + art.BOAT.w / 2 + 2];
    const boatOnRight = this.boatX > W * 0.6;
    let ww = clamp(Math.round(w * 0.16), 40, 64);
    const wh = Math.min(Math.round(ww * 1.3), waterY - 56);
    ww = Math.min(ww, Math.round(wh / 1.3));
    const win = wh >= 30
      ? { x: Math.round(w * (boatOnRight ? 0.14 : 0.82) - ww / 2), y: waterY - 32 - wh, w: ww, h: wh }
      : null;
    // The portrait hangs just right of the bowl, below the logo and above the chair rail.
    const pictureX = Math.round(boatAt + 28);
    const picture = boatOnRight && pictureX + 40 <= w ? { x: pictureX, y: waterY - 30 - 28 } : null;
    this.room = {
      waterY,
      win,
      wall: art.thanksgivingRoom({ w, h: waterY + 8, waterY, win, picture, keepClear }),
      view: win ? art.windowView(win.w - 6, win.h - 6) : null,
    };
  }

  drawRoom(ctx, yS) {
    const { P } = this;
    const { wall, view, win, waterY } = this.room;
    const top = Math.round(yS - waterY * P);
    if (view) {
      const gx = (win.x + 3) * P;
      const gy = top + (win.y + 3) * P;
      const gw = view.width * P;
      const gh = view.height * P;
      ctx.drawImage(view, gx, gy, gw, gh);
      // Leaves blowing past outside, drawn small because they're far away.
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();
      const t = this.leafTime();
      const scale = Math.max(1, Math.round(P / 2));
      for (const leaf of this.windowLeaves) {
        const y = gy + ((leaf.y + t * (0.07 + leaf.v * 0.08)) % 1) * (gh + 16 * scale) - 8 * scale;
        const sway = Math.sin(t * (0.8 + leaf.sway) + leaf.ph) * (4 + leaf.sway * 6) * scale;
        const x = gx + ((((leaf.x * gw + t * 9 * scale + sway) % gw) + gw) % gw);
        this.drawLeaf(ctx, leaf, x, y, { spin: t * (1.4 + leaf.v * 2) + leaf.ph, tilt: Math.sin(t * 1.1 + leaf.ph) * 0.35, scale });
      }
      ctx.restore();
    }
    ctx.drawImage(wall, 0, top, wall.width * P, wall.height * P);
  }

  // Shine on the tank's front glass, brightest at the rim and gone a little way under the surface.
  drawGlass(ctx, yS) {
    const { W, P } = this;
    const top = yS - 11 * P;
    const rows = 80;
    for (const [at, width, strength] of [[0.03, 4, 0.28], [0.03, -3, 0.2], [0.9, 2, 0.16]]) {
      const base = Math.round((W * at) / P) * P + (width < 0 ? 7 * P : 0);
      for (let r = 0; r < rows; r += 1) {
        ctx.fillStyle = `rgba(255,255,255,${(strength * (1 - r / rows)).toFixed(3)})`;
        ctx.fillRect(base + Math.floor((rows - r) / 2) * P, top + r * P, Math.abs(width) * P, P);
      }
    }
  }

  drawBoat(ctx) {
    const { P } = this;
    const yS = this.m2y(0);
    const bob = this.boatBob();
    const left = Math.round(this.boatX - (art.BOAT.w * P) / 2);
    const top = Math.round(yS + bob - art.BOAT.waterline * P);
    const w = art.BOAT.w * P;
    const h = art.BOAT.h * P;
    ctx.drawImage(this.boat.back, left, top, w, h);
    if (this.fish.mode === 'bowl' && this.fish.m <= 0) this.drawFish(ctx);
    ctx.drawImage(this.boat.front, left, top, w, h);
  }

  drawWaves(ctx, yS) {
    const { W, P } = this;
    const step = P * 2;
    const t = this.time;
    const bottom = yS + 12 * P;
    for (let x = 0; x < W; x += step) {
      const raw = Math.sin(x * 0.012 / this.dpr + t * 0.9) * 2.6 + Math.sin(x * 0.031 / this.dpr - t * 1.4) * 1.5;
      const yw = Math.round(yS / P + raw) * P;
      ctx.fillStyle = rgb(waterRGB(2));
      ctx.fillRect(x, yw, step, bottom - yw);
      ctx.fillStyle = 'rgba(236,255,250,.9)';
      ctx.fillRect(x, yw, step, P);
    }
  }

  drawRays(ctx, yS) {
    const alpha = 0.13 * (1 - smooth(120, 330, this.y2m(this.H * 0.4)));
    if (alpha <= 0.002) return;
    const { W, H, P } = this;
    const row = P * 4;
    for (let i = 0; i < 6; i += 1) {
      const x0 = W * (0.08 + i * 0.17) + Math.sin(this.time * 0.25 + i) * 18 * this.dpr;
      const start = Math.max(0, yS);
      for (let y = start; y < Math.min(H, yS + 300 * this.ppm); y += row) {
        const d = y - yS;
        const fade = 1 - d / (300 * this.ppm);
        ctx.fillStyle = `rgba(232,255,240,${alpha * fade})`;
        ctx.fillRect(Math.round((x0 - d * 0.16) / P) * P, y, Math.round((26 * P + d * 0.1) / P) * P, row);
      }
    }
  }

  wallWidth(m, row, seed) {
    const { W } = this;
    const entry = smooth(30, 240, m);
    const narrowing = lerp(0.035, 0.17, smooth(800, 7000, m));
    const roughness = 0.55 * noise(row * 0.09 + seed) + 0.45 * noise(row * 0.33 + seed * 2);
    return entry * W * (narrowing + roughness * 0.075);
  }

  drawWall(ctx, parallax, widen, darken) {
    const { W, H, P } = this;
    const rowPx = P * 4;
    const scroll = this.cam * this.ppm * parallax;
    const offset = ((scroll % rowPx) + rowPx) % rowPx;
    for (let y = -offset; y < H; y += rowPx) {
      const m = this.y2m(y + rowPx / 2);
      if (m < 30) continue;
      const row = Math.round((y + scroll) / rowPx);
      const color = waterRGB(m);
      const lift = smooth(1500, 5000, m) * (parallax < 1 ? 16 : 7);
      ctx.fillStyle = rgb(mix(color, [lift, lift + 3, lift + 10], darken));
      const left = Math.round((this.wallWidth(m, row, 3.1 + parallax) * widen) / P) * P;
      const right = Math.round((this.wallWidth(m, row, 17.7 + parallax) * widen) / P) * P;
      ctx.fillRect(0, y, left, rowPx);
      ctx.fillRect(W - right, y, right, rowPx);
    }
  }

  drawKelp(ctx) {
    const { W, H, P } = this;
    const top = Math.max(30, this.y2m(0) - 40);
    const bottom = Math.min(280, this.y2m(H) + 60);
    if (bottom <= top) return;
    const cell = 13;
    for (let c = Math.floor(top / cell); c <= bottom / cell; c += 1) {
      if (hash(c + 77) < 0.42) continue;
      const m = c * cell;
      const onRight = hash(c + 5) > 0.5;
      const row = Math.round((m * this.ppm) / (P * 4));
      const root = this.wallWidth(m, row, onRight ? 18.7 : 4.1);
      const baseX = onRight ? W - root + 2 * P : root - 2 * P;
      const y0 = this.m2y(m);
      const segments = 9 + Math.floor(hash(c + 9) * 16);
      const shade = 1 - smooth(60, 260, m) * 0.68;
      ctx.fillStyle = rgb([14 + 16 * shade, 70 + 58 * shade, 66 + 16 * shade]);
      for (let s = 0; s < segments; s += 1) {
        const lean = (onRight ? -1 : 1) * s * 0.55 * P;
        const sway = Math.sin(this.time * 0.9 + s * 0.42 + c) * s * 0.26 * P;
        const x = Math.round((baseX + lean + sway) / P) * P;
        const y = y0 - s * 2 * P;
        ctx.fillRect(x, y, P * 2, P * 2);
        if (s % 3 === 1 && s < segments - 1) ctx.fillRect(x + (s % 2 ? -P * 2 : P * 2), y, P * 2, P);
      }
    }
  }

  drawCreatures(ctx) {
    const { W, H, P } = this;
    const cell = 34;
    const top = Math.floor(this.y2m(-40 * P) / cell);
    const bottom = Math.ceil(this.y2m(H + 40 * P) / cell);
    for (let c = top; c <= bottom; c += 1) {
      const m = c * cell + hash(c + 900) * cell;
      if (m < 16) continue;
      const density = m < 1000 ? 0.62 : 0.5;
      if (hash(c + 1300) > density) continue;
      const pool = creaturePool(m);
      const kind = pool[Math.floor(hash(c + 1700) * pool.length)];
      const dir = hash(c + 2100) > 0.5 ? 1 : -1;
      const speed = (8 + hash(c + 2500) * 16) * this.dpr * (kind === 'whale' ? 0.5 : 1);
      const span = W + 150 * P;
      const raw = (hash(c + 2900) * span + this.time * speed * dir) % span;
      const x = (raw < 0 ? raw + span : raw) - 70 * P;
      const y = this.m2y(m) + Math.sin(this.time * 0.7 + c) * 3 * P;
      const set = m > 700 ? this.light : this.dark;
      const alpha = m > 700 ? 0.55 : 0.5;
      if (kind === 'school') {
        const n = 4 + Math.floor(hash(c + 3300) * 6);
        const sprite = set.smallfish;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < n; i += 1) {
          const ox = (hash(c + i * 11) - 0.5) * 60 * P + Math.sin(this.time + i) * 2 * P;
          const oy = (hash(c + i * 23) - 0.5) * 22 * P;
          this.blit(ctx, sprite, x + ox, y + oy, dir < 0);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = kind === 'jelly' ? 0.8 : alpha;
      this.blit(ctx, set[kind], x, y, dir < 0);
      ctx.globalAlpha = 1;
    }
  }

  blit(ctx, sprite, cx, cy, flip) {
    const { P } = this;
    const w = sprite.width * P;
    const h = sprite.height * P;
    const x = Math.round((cx - w / 2) / P) * P;
    const y = Math.round((cy - h / 2) / P) * P;
    if (!flip) {
      ctx.drawImage(sprite, x, y, w, h);
      return;
    }
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, w, h);
    ctx.restore();
  }

  drawLandmarks(ctx) {
    const y = this.m2y(3800);
    if (y < -200 * this.P || y > this.H + 200 * this.P) return;
    ctx.globalAlpha = 0.75;
    ctx.save();
    ctx.translate(this.W * 0.27, y);
    ctx.rotate(-0.14);
    const s = this.light.wreck;
    ctx.drawImage(s, (-s.width * this.P * 1.5) / 2, (-s.height * this.P * 1.5) / 2, s.width * this.P * 1.5, s.height * this.P * 1.5);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawSnow(ctx) {
    const { W, H, P } = this;
    const surfaceY = this.m2y(0) + 14 * P;
    for (const s of this.snow) {
      let y = (s.y * H - this.cam * this.ppm * s.z + this.time * s.v * H) % H;
      if (y < 0) y += H;
      if (y < surfaceY) continue;
      const m = this.y2m(y);
      const deep = smooth(600, 2500, m);
      const blink = deep > 0.4 && s.blink > 0.8 ? 0.45 + 0.55 * Math.sin(this.time * 2 + s.blink * 40) : 0;
      ctx.fillStyle = blink > 0 ? `rgba(140,235,255,${blink})` : `rgba(226,244,255,${0.2 + s.z * 0.2})`;
      const size = s.z > 0.8 ? P : Math.max(1, P / 2);
      ctx.fillRect(Math.round((s.x * W) / P) * P, Math.round(y / P) * P, size, size);
    }
  }

  layoutCaptions(ctx) {
    const { W, dpr } = this;
    const maxWidth = Math.min(W * 0.62, 340 * dpr);
    ctx.font = `${Math.round(11 * dpr)}px Silkscreen, monospace`;
    this.captionLayout = this.captions.map((caption) => {
      const words = caption.text.split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      lines.push(line);
      return { ...caption, lines };
    });
  }

  drawCaptions(ctx) {
    if (this.rulerAlpha < 0.02) return;
    const { W, H, dpr } = this;
    if (!this.captionLayout || this.fontsReadyStamp !== document.fonts?.status) {
      this.layoutCaptions(ctx);
      this.fontsReadyStamp = document.fonts?.status;
    }
    // A caption sitting on a tier line would be unreadable, so the line wins.
    const tierLines = this.sink ? this.sink.lines.map((line) => line.m) : this.restLine ? [this.restLine.m] : [];
    this.captionLayout.forEach((caption, i) => {
      const y = this.m2y(caption.m);
      if (y < -60 * dpr || y > H + 60 * dpr) return;
      if (tierLines.some((m) => Math.abs(m - caption.m) < 16)) return;
      const onLeft = caption.side ? caption.side === 'left' : i % 2 === 0;
      const margin = Math.max(W * 0.05, this.wallWidth(caption.m, 0, 3) + 14 * dpr);
      ctx.globalAlpha = this.rulerAlpha * (caption.big ? 0.92 : 0.72);
      ctx.fillStyle = caption.big ? '#fff1d0' : '#d5ebf4';
      ctx.font = caption.big ? `700 ${Math.round(13 * dpr)}px Silkscreen, monospace` : `${Math.round(11 * dpr)}px Silkscreen, monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = caption.big ? 'center' : onLeft ? 'left' : 'right';
      const x = caption.big ? W / 2 : onLeft ? margin : W - margin - 46 * dpr;
      caption.lines.forEach((line, n) => ctx.fillText(line, x, y + n * 15 * dpr));
    });
    ctx.globalAlpha = 1;
  }

  drawRuler(ctx) {
    if (this.rulerAlpha < 0.02) return;
    const { W, H, dpr, P } = this;
    const step = 50;
    const first = Math.ceil(this.y2m(0) / step) * step;
    ctx.font = `${Math.round(11 * dpr)}px Silkscreen, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = this.rulerAlpha * 0.65;
    ctx.fillStyle = '#d5ebf4';
    for (let m = Math.max(0, first); m <= this.y2m(H); m += step) {
      const y = Math.round(this.m2y(m));
      const major = m % 100 === 0;
      ctx.fillRect(W - (major ? 10 : 5) * dpr, y, (major ? 10 : 5) * dpr, Math.max(1, dpr));
      if (major) ctx.fillText(`${m.toLocaleString('en-US')} m`, W - 14 * dpr, y);
    }
    ctx.globalAlpha = this.rulerAlpha;
    const here = this.m2y(this.shownDepth());
    if (here > -10 && here < H + 10) {
      ctx.fillStyle = '#ff8a1e';
      ctx.fillRect(W - 16 * dpr, Math.round(here) - P, 16 * dpr, P * 2);
    }
    ctx.globalAlpha = 1;
  }

  drawTierLines(ctx) {
    const lines = this.sink ? this.sink.lines : this.restLine ? [{ ...this.restLine, resting: true }] : [];
    if (!lines.length) return;
    const { W, H, P, dpr } = this;
    const x0 = W * 0.04;
    const x1 = W - 46 * dpr;
    for (const line of lines) {
      const y = Math.round(this.m2y(line.m) / P) * P;
      if (y < -10 || y > H + 10) continue;
      const tier = TIERS[line.tier];
      const bright = line.resting ? 1 : line.passed ? 0.35 : 0.75;
      ctx.globalAlpha = bright;
      ctx.fillStyle = tier.color;
      for (let x = x0; x < x1; x += P * 5) ctx.fillRect(Math.round(x / P) * P, y, P * 3, line.resting ? P * 2 : P);
      ctx.font = `${Math.round(11 * dpr)}px Silkscreen, monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const label = `${tier.name} · ${tier.pts}`;
      ctx.fillText(label, x1, y + 6 * dpr);
      const icon = this.tierIcons[line.tier];
      const textW = ctx.measureText(label).width;
      const size = 9 * Math.max(1, Math.round(P / 2));
      ctx.drawImage(icon, x1 - textW - size - 5 * dpr, y + 3 * dpr, size, size);
      ctx.globalAlpha = 1;
    }
  }

  drawPastAnchors(ctx) {
    const { H, P } = this;
    for (const past of this.pastAnchors) {
      const y = this.m2y(past.m);
      if (y < -80 * P || y > H + 80 * P) continue;
      this.drawSign(ctx, past.name, past.m, Math.sin(this.time * 1.2 + past.m) * 0.02, past.tier);
    }
  }

  // The answer on a wooden board, tied to the anchor that's dragging it down.
  drawSign(ctx, name, m, angle, tier) {
    const { P, W, dpr } = this;
    const a = this.anchorSprite;
    const anchorH = a.height * P;
    const rope = 7 * P;
    const yTip = this.m2y(m);
    ctx.save();
    ctx.translate(W / 2, yTip);
    ctx.rotate(angle);

    ctx.drawImage(a, Math.round((-a.width * P) / 2), -anchorH, a.width * P, anchorH);
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(-P, -anchorH - rope, P * 2, rope + P);

    let size = 25;
    let text = name;
    ctx.font = `${Math.round(size * dpr)}px "Jersey 25", monospace`;
    const maxText = Math.min(W * 0.72, 460 * dpr);
    while (ctx.measureText(text).width > maxText && size > 16) {
      size -= 1;
      ctx.font = `${Math.round(size * dpr)}px "Jersey 25", monospace`;
    }
    if (ctx.measureText(text).width > maxText) {
      while (ctx.measureText(`${text}…`).width > maxText) text = text.slice(0, -1);
      text = `${text}…`;
    }
    const tw = ctx.measureText(text).width;
    const w = Math.ceil((tw + 18 * dpr) / P) * P;
    const h = Math.ceil((size + 7) * dpr / P) * P;
    const left = -Math.round(w / 2 / P) * P;
    const top = -anchorH - rope - h;

    ctx.fillStyle = '#2f1809';
    ctx.fillRect(left, top - P, w, h + P * 2);
    ctx.fillRect(left - P, top, w + P * 2, h);
    ctx.fillStyle = '#8b5a2c';
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = '#9d6a36';
    ctx.fillRect(left, top, w, P);
    ctx.fillStyle = '#74481f';
    ctx.fillRect(left, top + Math.round(h / 2 / P) * P, w, P);
    if (tier !== null && tier !== undefined) {
      ctx.fillStyle = TIERS[tier].color;
      ctx.fillRect(left, top + h - P, w, P);
    }

    ctx.fillStyle = '#fff1d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, top + h / 2 + dpr);
    ctx.restore();
  }

  drawBubbles(ctx) {
    const { P, H } = this;
    for (const b of this.bubbles) {
      const y = this.m2y(b.m);
      if (y < -20 || y > H + 20) continue;
      const sprite = this.bubbleRings[b.size];
      const x = Math.round((b.x + Math.sin(this.time * 3 + b.wob) * 3 * P) / P) * P;
      ctx.globalAlpha = clamp(1.4 - b.age / b.life, 0, 1);
      ctx.drawImage(sprite, x, Math.round(y / P) * P, sprite.width * P, sprite.height * P);
    }
    ctx.globalAlpha = 1;
  }

  drawFish(ctx) {
    const f = this.fish;
    const { P } = this;
    const y = this.m2y(f.m);
    if (y < -60 * P || y > this.H + 60 * P) return;

    const lit = smooth(180, 1100, f.m) * 0.34;
    if (lit > 0.01) {
      const size = 150 * P;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lit;
      ctx.drawImage(this.fishGlow, f.x - size / 2, y - size / 2, size, size);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    const s = this.fishSprite;
    const amp = f.mode === 'bowl' ? 1.6 : 2.8;
    ctx.save();
    ctx.translate(Math.round(f.x), Math.round(y));
    if (f.flip) ctx.scale(-1, 1);
    ctx.rotate(f.angle);
    for (let sx = 0; sx < s.width; sx += 1) {
      const k = 1 - sx / s.width;
      const off = Math.round(Math.sin(f.phase + sx * 0.34) * amp * k * k);
      ctx.drawImage(s, sx, 0, 1, s.height, (sx - s.width / 2) * P, (off - s.height / 2) * P, P + 0.5, s.height * P);
    }
    if (this.hat) {
      const h = this.hat;
      ctx.drawImage(h, (art.HAT_AT.x - s.width / 2) * P, (art.HAT_AT.y - s.height / 2) * P, h.width * P, h.height * P);
    }
    ctx.restore();
  }

  // Leaves -------------------------------------------------------------------------------
  // Leaves tumble by flipping between full, half and mirrored widths, which keeps the pixels crisp.
  drawLeaf(ctx, leaf, x, y, { spin = 0, tilt = 0, alpha = 1, scale = this.P } = {}) {
    const sprite = this.leafSprites[leaf.sprite];
    const P = scale;
    const c = Math.cos(spin);
    const flip = this.reduced ? 1 : c > 0.5 ? 1 : c > 0 ? 0.5 : c > -0.5 ? -0.5 : -1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(tilt);
    ctx.scale(flip, 1);
    ctx.drawImage(sprite, (-sprite.width / 2) * P, (-sprite.height / 2) * P, sprite.width * P, sprite.height * P);
    ctx.restore();
  }

  leafTime() {
    return this.reduced ? this.time * 0.15 : this.time;
  }

  // A few leaves riding the swell before they sink.
  drawFloatingLeaves(ctx, yS) {
    const { W, P } = this;
    const t = this.leafTime();
    const span = W + 40 * P;
    for (const leaf of this.floatLeaves) {
      const x = ((leaf.x * span + t * (3 + leaf.v * 5) * P) % span) - 20 * P;
      const raw = Math.sin(x * 0.012 / this.dpr + this.time * 0.9) * 2.6 + Math.sin(x * 0.031 / this.dpr - this.time * 1.4) * 1.5;
      const slope = Math.cos(x * 0.012 / this.dpr + this.time * 0.9) * 0.25;
      this.drawLeaf(ctx, leaf, x, Math.round(yS / P + raw) * P - 2 * P, { tilt: slope + (leaf.ph - Math.PI) * 0.15 });
    }
  }

  // Sunken leaves sway down through the shallows and fade out before the dark water.
  drawSeaLeaves(ctx) {
    const { W, H, P } = this;
    const t = this.leafTime();
    const surfaceY = this.m2y(0) + 16 * P;
    for (const leaf of this.seaLeaves) {
      let y = (leaf.y * H - this.cam * this.ppm * 0.9 + t * (0.012 + leaf.v * 0.02) * H) % H;
      if (y < 0) y += H;
      if (y < surfaceY) continue;
      const fade = 1 - smooth(120, 850, this.y2m(y));
      if (fade < 0.03) continue;
      const sway = Math.sin(t * (0.5 + leaf.sway * 0.6) + leaf.ph) * (6 + leaf.sway * 12) * P;
      this.drawLeaf(ctx, leaf, leaf.x * W + sway, y, {
        spin: t * (0.6 + leaf.v) + leaf.ph, tilt: Math.sin(t * 0.8 + leaf.ph) * 0.5, alpha: 0.75 * fade,
      });
    }
  }

  drawSparks(ctx) {
    const { P } = this;
    for (const s of this.sparks) {
      const x = s.x + s.vx * s.age;
      const y = this.m2y(s.m) + s.vy * s.age + 0.5 * s.g * s.age * s.age;
      if (s.m === 0 && y > this.m2y(0) + P) continue;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = clamp(1.5 - (s.age / s.life) * 1.5, 0, 1);
      ctx.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, P, P);
    }
    ctx.globalAlpha = 1;
  }

  drawSpeech(ctx) {
    const f = this.fish;
    if (!f.say || this.time > f.sayUntil) return;
    const { P, dpr, W } = this;
    ctx.font = `${Math.round(11 * dpr)}px Silkscreen, monospace`;
    const tw = ctx.measureText(f.say).width;
    const w = Math.ceil((tw + 14 * dpr) / P) * P;
    const h = 8 * P + 4 * dpr;
    const x = clamp(f.x - w / 2, 6 * dpr, W - w - 6 * dpr);
    const y = this.m2y(f.m) - 16 * P - h;
    ctx.fillStyle = '#fff1d0';
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(f.x - P, y + h, P * 2, P * 2);
    ctx.fillStyle = '#2a0f02';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.say, x + w / 2, y + h / 2);
  }
}
