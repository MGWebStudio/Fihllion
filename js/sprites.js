// All the game's pixel art. Each sprite is a list of rows; '.' is transparent and every
// other character looks up a colour. Rasterized once to a small canvas, then scaled up
// with smoothing off.

const FISH = {
  K: '#6f2a0c', O: '#ff8c1a', D: '#e9650f', L: '#ffb54a', Y: '#ffe39a',
  T: '#ff6a2b', t: '#ffa46a', W: '#fff8e8', E: '#1d0f08',
};

const LIT = { g: '#c9ff8f', c: '#8fe9ff', y: '#ffe27a', m: '#ff9ad5', w: '#e8f6ff' };

export const GOLDFISH = [
  '...................KKK........',
  '................KKKTTTK.......',
  '..............KKTTTtTTTK......',
  'KKK..........KTTTTtTTTTTK.....',
  'KTTK........KKKKKKKKKKKKKKK...',
  'KTTTK.....KKDDDDOOOOOOOOOOOKK.',
  'KTtTTK...KDDDOOOOLLLLOOWWWWOOK',
  'KTTtTTK.KDDOOOOOLLLLOOWWEEWOOK',
  '.KTTtTTKDDOOOOOOOOOOOOWWEEWOOK',
  '..KTTtTTDOOOOKKKOOOOOOOWWWWOKK',
  '..KTTtTTDOOOKTTTKOOOOOOOOOOOK.',
  '.KTTtTTKDOOOKTtTKOOOOOOOOYYOK.',
  'KTTtTTK.KOYYKTTKOOOOOYYYYYYK..',
  'KTtTTK...KYYYKKYYYYYYYYYYKK...',
  'KTTTK.....KKYYYYYYYYYYKKKK....',
  'KTTK........KKKKKKKKKK........',
  'KKK..........KTTK.KTTK........',
  '...............KK...KK........',
];

const ANCHOR = {
  palette: { A: '#47596a', B: '#8ba4b4', C: '#d3e4ec' },
  rows: [
    '......AAAAA......',
    '.....AB...BA.....',
    '.....AB...BA.....',
    '......AABAA......',
    '.......ABA.......',
    '...AAAAACAAAAA...',
    '...ABBBBCBBBBA...',
    '...AAAAACAAAAA...',
    '.......ACA.......',
    '.......ACA.......',
    '.......ACA.......',
    'AA.....ACA.....AA',
    'ABA....ACA....ABA',
    'ACBA...ACA...ABCA',
    'AACBA..ACA..ABCAA',
    '.AACBAAACAAABCAA.',
    '..AACBBBCBBBCAA..',
    '...AAACCCCCAAA...',
    '......AAAAA......',
  ],
};

const SILHOUETTES = {
  smallfish: [
    '.....##..',
    '#..#####.',
    '#########',
    '#..#####.',
    '.....##..',
  ],
  turtle: [
    '......#######......',
    '....###########....',
    '...#############.##',
    '..###############.#',
    '..#################',
    '.####.########.###.',
    '##.....#####...##..',
    '#......###......#..',
    '........##.........',
  ],
  whale: [
    '#.#.............................................',
    '###.............................................',
    '.###................############................',
    '..####..........######################..........',
    '...#####.....#############################......',
    '....#############################################...',
    '......##############################################.',
    '........###########################################w#',
    '.........############################################',
    '...........#########################...................',
    '..............####################.....................',
    '.................#############.........................',
    '.....................#######...........................',
    '.......................####............................',
  ],
  jelly: [
    '....ccccc....',
    '..ccccccccc..',
    '.ccc#####ccc.',
    '.cc#######cc.',
    'cc#########cc',
    'cc#########cc',
    'ccccccccccccc',
    '.c.c.c.c.c.c.',
    '.c.c.c.c.c.c.',
    '..c.c.c.c.c..',
    '..c.c.c.c.c..',
    '.c..c.c.c..c.',
    '.c..c...c..c.',
    '....c...c....',
  ],
  squid: [
    '#.................',
    '##...........#....',
    '.##.......#######.',
    '..###..############',
    '...###############w#',
    '#########################',
    '...###############w#',
    '..###..############',
    '.##.......#######.',
    '##...........#....',
    '#.................',
  ],
  lantern: [
    '....#####...',
    '#..########.',
    '##.######w##',
    '############',
    '#g#g#g#g#g#.',
    '.....####...',
  ],
  angler: [
    '................gg......',
    '...............gyyg.....',
    '................gg.#....',
    '..................#.....',
    '.............####.#.....',
    '#..........#########....',
    '##.......############...',
    '###....###############..',
    '#####.##########w#######',
    '#########################',
    '###.####################.',
    '##.....###########w.w.w.w',
    '#.........#############..',
    '............##########...',
    '...............#####.....',
  ],
  dumbo: [
    '......####......',
    '....########....',
    '##.##########.##',
    '################',
    '.##.#########.##',
    '....##w###w##...',
    '....#########...',
    '...###########..',
    '...###########..',
    '..##.##.##.##...',
    '..#..#..#...#...',
  ],
  eel: [
    '..............................###.',
    '#########################.########',
    '################################w#',
    '#########################.########',
    '..............................###.',
  ],
  snail: [
    '.........#####..',
    '#.....#########.',
    '###############w',
    '###############.',
    '.......#######..',
  ],
  wreck: [
    '...................##.........##...................',
    '...................##.........##...................',
    '..................###........###...................',
    '............#.....####.......####....#.............',
    '............#..#############################.......',
    '...#########################################.####..',
    '..##################################################',
    '...################################################.',
    '....##############################################..',
    '.....############################################...',
    '......#########################################.....',
    '.......#####################################........',
    '........#################################...........',
  ],
};

const ICONS = {
  iconPlankton: { palette: { g: '#c4f5d6', G: '#effff6' }, rows: [
    '.........',
    '..ggg....',
    '.gGGGg...',
    '.gGGGg.g.',
    '..ggg.gGg',
    '.......g.',
    '...gg....',
    '...gg....',
    '.........',
  ] },
  iconClever: { palette: { p: '#ff7fb2', P: '#ffd0e2', k: '#8d3e5e' }, rows: [
    '...ppp...',
    '..pPPPp..',
    '.pPPPPPp.',
    '.pPPPPPp.',
    '..pPPPp..',
    '...pPp...',
    '...kkk...',
    '...kkk...',
    '.........',
  ] },
  iconSchooler: { palette: { b: '#62d2f7', W: '#fff', E: '#0a2a3f' }, rows: [
    '.........',
    '.....bbb.',
    'b..bbbbbb',
    'bbbbbbWEb',
    'bbbbbbbbb',
    'b..bbbbbb',
    '.....bbb.',
    '.........',
    '.........',
  ] },
  iconRare: { palette: { p: '#7d5be6', P: '#b98aff', W: '#fff' }, rows: [
    '...ppp...',
    '..pPPPp..',
    '.pPWPPPp.',
    '.pWPPPPp.',
    '.pPPPPPp.',
    '.pPPPPPp.',
    '..pPPPp..',
    '...ppp...',
    '.........',
  ] },
  iconDeep: { palette: { r: '#ff8a5c', E: '#3b0d0a', W: '#fff' }, rows: [
    '....r....',
    '...rrr...',
    '..rrrrr..',
    '..rWErW..',
    '..rrrrr..',
    '...rrr...',
    '.r.r.r.r.',
    '.r.r.r.r.',
    'r..r.r..r',
  ] },
  iconGem: { palette: { y: '#d98a12', Y: '#ffd24d', W: '#fff6cf' }, rows: [
    '..yyyyy..',
    '.yYWWYYy.',
    'yYWYYYYYy',
    'yyyyyyyyy',
    '.yYYYYYy.',
    '..yYYYy..',
    '...yYy...',
    '....y....',
    '.........',
  ] },
  iconMiss: { palette: { x: '#8ea5b1' }, rows: [
    '.........',
    '.xx...xx.',
    '..xx.xx..',
    '...xxx...',
    '...xxx...',
    '..xx.xx..',
    '.xx...xx.',
    '.........',
    '.........',
  ] },
};

const LETTERS = {
  F: ['######', '######', '##....', '##....', '#####.', '#####.', '##....', '##....', '##....'],
  I: ['####', '####', '.##.', '.##.', '.##.', '.##.', '.##.', '####', '####'],
  H: ['##..##', '##..##', '##..##', '##..##', '######', '######', '##..##', '##..##', '##..##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  O: ['..####..', '.######.', '##....##', '##....##', '##....##', '##....##', '##....##', '.######.', '..####..'],
  N: ['##...##', '###..##', '###..##', '####.##', '##.####', '##..###', '##..###', '##...##', '##...##'],
};
const LOGO_ROWS = ['#fff6d2', '#fff0b4', '#ffe28a', '#ffd266', '#ffc24a', '#ffb12f', '#ffa023', '#ff8f1c', '#f97d14'];

function newCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function paint(rows, palette) {
  const canvas = newCanvas(Math.max(...rows.map((row) => row.length)), rows.length);
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || !palette[ch]) return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

export const goldfish = () => paint(GOLDFISH, FISH);
export const anchor = () => paint(ANCHOR.rows, ANCHOR.palette);
export const silhouette = (name, color) => paint(SILHOUETTES[name], { ...LIT, '#': color });
export const icon = (name) => paint(ICONS[name].rows, ICONS[name].palette);

export function paintIcon(canvas, name) {
  const source = icon(name);
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
}

export function iconURL(name) {
  return icon(name).toDataURL();
}

const inCircle = (x, y, cx, cy, r) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;

export function cloud(seed) {
  const rnd = (n) => {
    const s = Math.sin((seed + 1) * (n + 1) * 91.17) * 4375.5453;
    return s - Math.floor(s);
  };
  const w = 64 + Math.floor(rnd(1) * 40);
  const h = 26;
  const canvas = newCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const puffs = [];
  const count = 4 + Math.floor(rnd(2) * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 6 + rnd(3 + i) * 7;
    puffs.push({ x: r + (i / (count - 1)) * (w - 2 * r), y: h - r * (0.7 + rnd(9 + i) * 0.35), r });
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!puffs.some((p) => inCircle(x, y, p.x, p.y, p.r))) continue;
      ctx.fillStyle = y > h - 6 ? '#dff1f7' : '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

const SUN_RINGS = [[36, 'rgba(255,240,190,.28)'], [29, 'rgba(255,236,170,.42)'], [23, '#ffe88f'], [18, '#fff2b5']];

export function sun(rings = SUN_RINGS) {
  const size = 72;
  const canvas = newCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  for (const [r, color] of rings) {
    ctx.fillStyle = color;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (inCircle(x, y, c, c, r)) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

// Quantized alpha steps keep the goldfish's light looking like part of the pixel art.
export function glow(r, g, b) {
  const size = 96;
  const canvas = newCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (d >= 1) continue;
      const alpha = Math.round((1 - d) ** 2.2 * 14) / 14;
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// A very small boat carrying a very large goldfish bowl. Split in two so the live goldfish
// can swim between the water and the front of the glass.
export const BOAT = { w: 104, h: 68, waterline: 63, bowl: { x: 52, y: 27, r: 24 } };

export function boat() {
  const { w, h, bowl } = BOAT;
  const back = newCanvas(w, h);
  const front = newCanvas(w, h);
  const bc = back.getContext('2d');
  const fc = front.getContext('2d');
  const top = bowl.y - bowl.r + 5;
  const waterTop = top + 5;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const d = Math.hypot(x + 0.5 - bowl.x, y + 0.5 - bowl.y);
      if (d > bowl.r || y < top) continue;
      if (d > bowl.r - 1.6) {
        fc.fillStyle = 'rgba(226,250,255,.85)';
        fc.fillRect(x, y, 1, 1);
      } else if (y >= waterTop) {
        bc.fillStyle = y === waterTop ? '#c6f6f4' : y > bowl.y + 12 ? '#3fb9c9' : '#62d1da';
        bc.fillRect(x, y, 1, 1);
      } else {
        bc.fillStyle = 'rgba(226,250,255,.2)';
        bc.fillRect(x, y, 1, 1);
      }
    }
  }

  // Rim of the bowl.
  const half = Math.round(Math.sqrt(bowl.r ** 2 - (top - bowl.y) ** 2));
  fc.fillStyle = '#eefdff';
  fc.fillRect(bowl.x - half - 2, top - 2, half * 2 + 4, 2);
  fc.fillStyle = '#b7e6ee';
  fc.fillRect(bowl.x - half - 2, top, half * 2 + 4, 1);

  // Glass highlights.
  fc.fillStyle = 'rgba(255,255,255,.75)';
  [[34, 14], [33, 15], [32, 16], [31, 18], [30, 20], [30, 21], [29, 23], [29, 24], [29, 26]].forEach(([x, y]) => fc.fillRect(x, y, 2, 1));

  // Gravel and the plastic castle.
  const gravel = ['#d9b46a', '#b98d4c', '#e8cf95', '#a7773d'];
  for (let x = bowl.x - 15; x < bowl.x + 15; x += 1) {
    for (let y = 44; y < 48; y += 1) {
      if (!inCircle(x, y, bowl.x, bowl.y, bowl.r - 1.6)) continue;
      bc.fillStyle = gravel[(x * 7 + y * 3) % gravel.length];
      bc.fillRect(x, y, 1, 1);
    }
  }
  bc.fillStyle = '#8c95a3';
  bc.fillRect(61, 37, 8, 8);
  bc.fillRect(60, 34, 3, 4);
  bc.fillRect(64, 34, 2, 3);
  bc.fillRect(67, 34, 3, 4);
  bc.fillStyle = '#5a6371';
  bc.fillRect(64, 41, 2, 4);
  bc.fillStyle = '#c6ccd6';
  bc.fillRect(61, 37, 1, 8);

  // Hull.
  const hullTop = 49;
  const hullBottom = h - 1;
  for (let y = hullTop; y <= hullBottom; y += 1) {
    const t = (y - hullTop) / (hullBottom - hullTop);
    const inset = Math.round(t ** 1.7 * 26);
    const x0 = 11 + inset;
    const x1 = w - 12 - inset;
    bc.fillStyle = '#3b1e0e';
    bc.fillRect(x0, y, x1 - x0 + 1, 1);
    if (y === hullTop || y === hullBottom) continue;
    bc.fillStyle = y <= hullTop + 2 ? '#e0a45e' : (y - hullTop) % 5 === 3 ? '#7f4a22' : y % 2 ? '#b06e36' : '#a4632e';
    bc.fillRect(x0 + 1, y, x1 - x0 - 1, 1);
  }
  bc.fillStyle = '#3b1e0e';
  bc.fillRect(8, hullTop - 3, 3, 3);
  bc.fillRect(w - 12, hullTop - 3, 4, 3);
  bc.fillStyle = '#e0a45e';
  bc.fillRect(9, hullTop - 2, 2, 2);
  bc.fillRect(w - 11, hullTop - 2, 2, 2);

  return { back, front };
}

// The wordmark, drawn as pixels so the O can be a fishbowl. Returns the art size.
export function drawLogo(canvas, fishShift = 0) {
  const word = 'FIHLLION';
  const pad = 2;
  const widths = [...word].map((ch) => LETTERS[ch][0].length);
  const artW = widths.reduce((sum, w) => sum + w, 0) + (word.length - 1) + pad * 2 + 1;
  const artH = 9 + pad * 2 + 2;
  canvas.width = artW;
  canvas.height = artH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, artW, artH);

  const cells = [];
  let cursor = pad;
  let bowlX = 0;
  [...word].forEach((ch, i) => {
    if (ch === 'O') bowlX = cursor;
    LETTERS[ch].forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c === '#') cells.push([cursor + x, pad + y, y]);
      });
    });
    cursor += widths[i] + 1;
  });

  ctx.fillStyle = 'rgba(6,62,88,.55)';
  for (const [x, y] of cells) ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillStyle = '#54210a';
  for (const [x, y] of cells) ctx.fillRect(x - 1, y - 1, 3, 3);

  // Water and a tiny goldfish inside the O.
  ctx.fillStyle = '#6fe0e8';
  ctx.fillRect(bowlX + 2, pad + 3, 4, 4);
  ctx.fillStyle = '#c6f6f4';
  ctx.fillRect(bowlX + 2, pad + 2, 4, 1);
  ['..oo', 'oooe', '..oo'].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = ch === 'e' ? '#54210a' : '#ff7a12';
      ctx.fillRect(bowlX + 2 + x, pad + 3 + fishShift + y, 1, 1);
    });
  });

  for (const [x, y, row] of cells) {
    ctx.fillStyle = LOGO_ROWS[row];
    ctx.fillRect(x, y, 1, 1);
  }
  return { artW, artH };
}

// Thanksgiving ---------------------------------------------------------------------------

// L is the leaf's colour, D a darker vein.
const LEAF_SHAPES = [
  [
    '....L....',
    '..L.L.L..',
    'L.LLLLL.L',
    'LLLLDLLLL',
    '.LLLDLLL.',
    'LLLLDLLLL',
    '..LLDLL..',
    '....D....',
    '....D....',
  ],
  [
    '..LL..',
    '.LLLL.',
    'LLLDLL',
    '.LLDL.',
    'LLLDLL',
    '.LLDL.',
    'LLLDLL',
    '..LD..',
    '...D..',
  ],
  [
    '..L..',
    '.LLL.',
    'LLDLL',
    'LLDLL',
    '.LDL.',
    '..D..',
    '..D..',
  ],
];
const LEAF_COLOURS = [['#c7352b', '#8a1f1a'], ['#de6a2a', '#9c3f14'], ['#eb9b30', '#a8601a'], ['#f2c24e', '#b07f22'], ['#a35a2b', '#6b3417']];

// Every shape in every colour, so a pile of leaves never looks copy-pasted.
export function leaves() {
  return LEAF_SHAPES.flatMap((rows) => LEAF_COLOURS.map(([L, D]) => paint(rows, { L, D })));
}

// Where the hat sits on the GOLDFISH grid: the brim rests on the top of the head, and the
// crown hides the front of the dorsal fin, so the fin pokes out behind it.
export const HAT_AT = { x: 17, y: -3 };
// A tapered crown with a square buckle centred on its band.
export function pilgrimHat() {
  return paint([
    '...KKKKK...',
    '...KhkkK...',
    '..KhkkkkK..',
    '..KhkkkkK..',
    '..KBYYYBK..',
    '..KBYByBK..',
    '..KByyyBK..',
    'KKKKKKKKKKK',
  ], { K: '#141217', k: '#34313a', h: '#56525e', B: '#0e0d11', Y: '#f2c14e', y: '#b8862a' });
}

function stamp(ctx, rows, palette, left, top) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || !palette[ch]) return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(left + x, top + y, 1, 1);
    });
  });
}

// The bowl moves indoors for Thanksgiving: a dining-room wall, a window onto an autumn
// afternoon, a leaf garland, and the back rim of the tank the boat floats in.
const ROOM = {
  wallTop: [146, 154, 106], wallLow: [212, 210, 160], panel: [118, 128, 84],
  trim: '#ece2c4', trimShade: '#c4b78f', trimDark: '#7d7a5c',
  wood: '#5c3822', woodLight: '#8f633f', woodDark: '#33200f',
  curtain: '#8e2a2a', curtainLight: '#ad3a32', curtainDark: '#5c191b',
  twine: '#6e5230', brass: '#d0a040', brassDark: '#8a6420',
};
const rgbText = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// The view out of the window, painted at the size of its glass. Leaves fall across it live.
export function windowView(w, h) {
  const canvas = newCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const fill = (color, x, y, cw = 1, ch = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cw, ch);
  };
  for (let y = 0; y < h; y += 2) {
    fill(rgbText(blend([112, 150, 200], [255, 200, 146], Math.min(1, y / (h * 0.74)))), 0, y, w, 2);
  }
  const sx = w * 0.3;
  const sy = h * 0.6;
  for (const [r, color] of [[10, 'rgba(255,196,128,.35)'], [7, '#ffb25c'], [5, '#ffd28a']]) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (inCircle(x, y, sx, sy, r)) fill(color, x, y);
      }
    }
  }
  for (let x = 0; x < w; x += 1) {
    const top = Math.round(h * 0.68 + Math.sin(x * 0.17) * 1.6 + Math.sin(x * 0.06 + 1) * 2.4);
    fill('#9a7682', x, top, 1, h - top);
  }
  const trees = [['#c7352b', '#8a1f1a'], ['#de6a2a', '#9c3f14'], ['#eb9b30', '#a8601a'], ['#f2c24e', '#b07f22']];
  for (let i = 0, cx = 2; cx < w + 4; i += 1, cx += 5 + ((i * 7) % 4)) {
    const r = 3 + ((i * 5) % 3);
    const cy = h * 0.8 - (i % 2);
    const [leaf, shade] = trees[(i * 3) % trees.length];
    fill('#4a2c18', Math.round(cx), Math.round(cy + r - 1), 1, 4);
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
      for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
        if (inCircle(x, y, cx, cy, r)) fill(y > cy + r / 3 ? shade : leaf, x, y);
      }
    }
  }
  const ground = Math.round(h * 0.88);
  fill('#9c7a44', 0, ground, w, 1);
  fill('#7d5f34', 0, ground + 1, w, h - ground - 1);
  return canvas;
}

// Thanksgiving dinner -------------------------------------------------------------------

// The roast turkey on its platter, drawn as ellipses so the dome comes out smooth.
function roastTurkey() {
  const w = 28;
  const h = 15;
  const base = h - 1;
  const canvas = newCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const fill = (color, x, y) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  const inside = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
  for (let y = base - 2; y <= base; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (inside(x, y, 14, base - 0.6, 14, 1.9) <= 1) fill(y === base ? '#a9b4b9' : '#e6ecee', x, y);
    }
  }
  for (let y = 0; y <= base - 2; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const d = inside(x, y, 14, base - 2, 10.5, 9);
      if (d > 1) continue;
      const t = (y - (base - 11)) / 9;
      fill(d > 0.8 ? '#5a2a0e' : t < 0.3 ? '#e3a052' : t < 0.62 ? '#c87432' : '#a2541f', x, y);
    }
  }
  for (const cx of [4.5, 23.5]) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const d = inside(x, y, cx, base - 5.5, 2.7, 2.7);
        if (d <= 1) fill(d > 0.6 ? '#5a2a0e' : '#c06c2c', x, y);
      }
    }
    const out = cx < 14 ? -1 : 1;
    const bx = Math.round(cx - 0.5);
    fill('#f3e6c8', bx + out, base - 8);
    fill('#f3e6c8', bx + out * 2, base - 9);
    for (const [dx, dy] of [[2, -10], [3, -10], [2, -11], [3, -11], [4, -11], [3, -12]]) fill('#ffffff', bx + out * dx, base + dy);
    fill('#dd9446', bx - 1, base - 6);
  }
  for (const [x, y] of [[9, 6], [10, 6], [11, 6], [8, 7], [9, 7]]) fill('#f6cf86', x, y);
  for (const [x, y] of [[1, base - 1], [2, base - 2], [3, base - 1], [24, base - 1], [25, base - 2], [26, base - 1]]) fill('#4f8a2b', x, y);
  return canvas;
}

const DISHES = {
  pie: paint([
    '...W...W...',
    '.CcWcCcWcC.',
    'CFFfFFFfFFC',
    'CCCCCCCCCCC',
    '.ttttttttt.',
  ], { W: '#fff8ec', C: '#c98a3e', c: '#e2a95a', F: '#d9701e', f: '#ee8a32', t: '#9aa3a8' }),
  potatoes: paint([
    '..s....s..',
    '...s..s...',
    '....yy....',
    '..MMyyMM..',
    '.MMMMMmMM.',
    'MmMMMMMMMm',
    'BBBBBBBBBB',
    '.BbBBBBbB.',
    '..BBBBBB..',
  ], { s: 'rgba(255,255,255,.5)', y: '#f7d64a', M: '#f4ecd6', m: '#d8ccb0', B: '#3d6fa8', b: '#2a4f7c' }),
  cranberry: paint([
    '.RRRRRR.',
    '.rcRRRr.',
    '.RRRRRR.',
    '.rcRRRr.',
    '.RRRRRR.',
    'pppppppp',
    '.qqqqqq.',
  ], { R: '#b0202c', r: '#7a1020', c: '#d8505a', p: '#e6ecee', q: '#a9b4b9' }),
  cider: paint([
    '.yy.',
    '.GG.',
    '.GG.',
    '.Gg.',
    'GGgG',
    'GGgG',
    'LLLL',
    'LllL',
    'LLLL',
    'GGgG',
    'GGgG',
    'GGGG',
  ], { y: '#d0a040', G: '#2e5a2a', g: '#5f9a54', L: '#efe2c0', l: '#c8622a' }),
  rolls: paint([
    '..LlL.LlL..',
    '.LLLLLLLLL.',
    'WwWwWwWwWwW',
    'wWwWwWwWwWw',
    '.WwWwWwWwW.',
    '..wwwwwww..',
  ], { L: '#e6a95a', l: '#b87830', W: '#a8783a', w: '#7a5226' }),
  beans: paint([
    '..oOooOoOo..',
    '.GgoGgOgGgo.',
    'DDDDDDDDDDDD',
    'DddddddddddD',
    '.DDDDDDDDDD.',
  ], { o: '#e0a050', O: '#b8762a', G: '#4f8a2b', g: '#356a1c', D: '#ece6d8', d: '#c9c0ae' }),
  sweetPotato: paint([
    '.WwW.WwW.WwW',
    'OWWOOWWOOWWO',
    'OOOOOOOOOOOO',
    'RRRRRRRRRRRR',
    '.RrrrrrrrrR.',
  ], { W: '#fff6e4', w: '#d9a066', O: '#e8862e', R: '#a8432e', r: '#7c2e1e' }),
  stuffing: paint([
    '..sbsbbs..',
    '.bsbBsbsb.',
    'sbBsbbsBbs',
    'YYYYYYYYYY',
    '.YyyyyyyY.',
    '..YYYYYY..',
  ], { s: '#7a5a30', b: '#a8783e', B: '#5d7a2b', Y: '#e8c23a', y: '#b8922a' }),
  pecanPie: paint([
    '.CcCcCcCcC.',
    'CPpPpPpPpPC',
    'CPPPPPPPPPC',
    'CCCCCCCCCCC',
    '.ttttttttt.',
  ], { C: '#c98a3e', c: '#e2a95a', P: '#5a2a12', p: '#8a4a22', t: '#9aa3a8' }),
  corn: paint([
    '..gYYYYYYg..',
    '.gYyYyYyYyg.',
    'ggYYYYYYYYgg',
    'pppppppppppp',
    '.qqqqqqqqqq.',
  ], { Y: '#f2c84a', y: '#d8a52c', g: '#7aa043', p: '#e6ecee', q: '#a9b4b9' }),
};

// A plate and a glass of cider, for the gaps between dishes.
const placeSetting = () => paint([
  '.........gaag',
  '.........gaag',
  '.........gAAg',
  '..........gg.',
  '..nnnn....gg.',
  'PPPPPPPP.gggg',
  '.pppppp......',
], { g: '#cfe7ea', a: '#e0962c', A: '#c47a1c', n: '#c8622a', P: '#f6f3ea', p: '#c9c4b4' });

// A taper in a brass holder. Its flame is drawn live, just above the wick.
const candle = () => Object.assign(paint([
  '.k..',
  ...Array(9).fill('.Cc.'),
  '.bb.',
  '.Bb.',
  '.BB.',
  'bBBb',
  'BBBB',
], { k: '#3a2a1a', C: '#f6ecd2', c: '#d9cba6', B: '#d0a040', b: '#8a6420' }), { isCandle: true });

const chair = () => paint([
  '.KK......KK.',
  'KTTKKKKKKTTK',
  'KTTTTTTTTTTK',
  'KTttttttttTK',
  'KKKKKKKKKKKK',
  ...Array(12).fill('KTK.K..K.KTK'),
  'KKKKKKKKKKKK',
  ...Array(5).fill('KTK......KTK'),
], { K: '#3e2414', T: '#8a5530', t: '#6a3e20' });

const GARLAND_ROWS = 22; // the garland hangs this far below the ceiling
const FLAME_ROWS = 4;
const DISH_GAP = 3;
const rowWidth = (row) => row.reduce((sum, img) => sum + img.width, 0) + DISH_GAP * Math.max(0, row.length - 1);
// How far down the lowest of `boxes` reaches over columns c0..c1 (boxes are { c0, c1, row }).
const reach = (boxes, c0, c1) => boxes.reduce((row, b) => (b.c1 < c0 || b.c0 > c1 ? row : Math.max(row, b.row)), -Infinity);

// The run of columns at least `width` wide where every cap is at least `height`, nearest the
// middle of the room.
function findRun(caps, w, height, width) {
  let best = null;
  const offCentre = (run) => Math.abs((run.l + run.r) / 2 - w / 2);
  for (let c = 0, start = null; c <= w; c += 1) {
    if (c < w && caps[c] !== null && caps[c] >= height) {
      if (start === null) start = c;
    } else if (start !== null) {
      const run = { l: start, r: c - 1 };
      if (run.r - run.l + 1 >= width && (!best || offCentre(run) < offCentre(best))) best = run;
      start = null;
    }
  }
  return best;
}

// Decides where the dinner table, window and portrait go. The table rises as high as it can
// (30 rows above the water) while its widest gap still fits the turkey and its candles under
// whatever is above: the title text, the window or the portrait. `text` lists the title's
// lines as { c0, c1, row } in room pixels.
function planRoom({ w, waterY, boatAt, boatOnRight, text }) {
  const turkey = roastTurkey();
  const turkeyRow = turkey.width + 2 * candle().width + 2 * DISH_GAP;
  const ww0 = Math.min(64, Math.max(36, Math.round(w * 0.16)));
  const winCentre = w * (boatOnRight ? 0.14 : 0.82);
  let plan = null;
  const textBottom = reach(text, 0, w);
  for (let rise = Math.max(15, Math.min(30, waterY - textBottom - 3)); rise >= 15; rise -= 1) {
    const top = waterY - rise;
    const base = top + 1; // the row dishes stand on
    let win = null;
    for (const gap of [20, 4]) {
      const bottom = top - gap;
      const ceiling = Math.max(GARLAND_ROWS, reach(text, winCentre - ww0 / 2 - 11, winCentre + ww0 / 2 + 11) + 7); // room for the curtain rod
      const wh = Math.min(Math.round(ww0 * 1.2), bottom - ceiling);
      if (wh < 30) continue;
      const ww = Math.min(ww0, Math.round(wh / 1.2));
      win = { x: Math.round(winCentre - ww / 2), y: bottom - wh, w: ww, h: wh };
      break;
    }
    const px = Math.round(boatOnRight ? boatAt + 28 : (boatAt - BOAT.bowl.r - 2) / 2 - 19);
    const py = top - 22 - 28;
    const picture = px >= 2 && px + 40 <= w && py - 8 >= Math.max(GARLAND_ROWS, reach(text, px, px + 38) + 1)
      ? { x: px, y: py } : null;
    // Down low the boat's own turkey and pumpkins would hide dishes, so the whole boat stays clear.
    const half = rise < 24 ? BOAT.w / 2 + 2 : BOAT.bowl.r + 2;
    const boatSpan = [Math.round(boatAt - half), Math.round(boatAt + half)];
    const above = [...text];
    if (win) above.push({ c0: win.x - 11, c1: win.x + win.w + 11, row: win.y + win.h + 3 });
    if (picture) above.push({ c0: picture.x, c1: picture.x + 38, row: picture.y + 28 });
    // How tall a dish can stand in each column (null behind the boat).
    const caps = Array.from({ length: w }, (_, c) => (
      c < 1 || c > w - 2 || (c >= boatSpan[0] && c <= boatSpan[1]) ? null : base - reach(above, c, c)));
    // The turkey and its candles go in the run of columns tall enough for a candle flame that's
    // nearest the middle of the screen. At the lowest table height the turkey can go alone.
    let main = findRun(caps, w, candle().height + FLAME_ROWS, turkeyRow);
    if (main) main.candles = true;
    else if (rise === 15) main = findRun(caps, w, turkey.height, turkey.width);
    if (main) main.maxH = Math.min(...caps.slice(main.l, main.r + 1));
    // Everywhere else, runs of columns with the same headroom.
    const segments = [];
    caps.forEach((maxH, c) => {
      if (maxH === null || (main && c >= main.l && c <= main.r)) return;
      const last = segments[segments.length - 1];
      if (last && last.r === c - 1 && last.maxH === maxH) last.r = c;
      else segments.push({ l: c, r: c, maxH });
    });
    plan = { top, base, win, picture, boatSpan, above, segments, main };
    if (main) break;
  }
  return plan;
}

// The dinner table runs the width of the room behind the tank. Chairs stand behind it wherever
// they'd show; dishes fill each gap, as tall as that gap allows. Returns where each flame goes.
function dinnerTable(ctx, { w, rimTop, plan }) {
  const { top, base, boatSpan, above, segments, main } = plan;
  const fill = (color, x, y, cw = 1, ch = 1) => {
    if (cw <= 0 || ch <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cw, ch);
  };

  const seat = chair();
  for (let x = 6; x + seat.width < w; x += 46) {
    const chairTop = top - seat.height + 3;
    if (x + seat.width > boatSpan[0] && x < boatSpan[1]) continue;
    if (chairTop <= reach(above, x, x + seat.width) + 1) continue;
    ctx.drawImage(seat, x, chairTop);
  }

  // Tablecloth: the top, its front edge, folds, and a plaid band near the hem when it shows.
  fill('#f7f0de', 0, top, w, 1);
  fill('#efe5cc', 0, top + 1, w, 1);
  fill('#e6d9bc', 0, top + 2, w, 1);
  fill('#cdbd98', 0, top + 3, w, 1);
  const drop = rimTop - top - 4;
  fill('#f1e7cf', 0, top + 4, w, drop);
  for (let x = 3; x < w; x += 7) {
    fill('#dccdab', x, top + 4, 1, drop);
    fill('#fbf5e6', x + 1, top + 4, 1, drop);
  }
  if (drop >= 8) {
    fill('#e8c23a', 0, rimTop - 6, w, 1);
    for (let x = 0; x < w; x += 4) {
      fill('#c8622a', x, rimTop - 5, 2, 2);
      fill('#a24a1c', x + 2, rimTop - 5, 2, 2);
    }
  }

  const queue = ['pie', 'potatoes', 'cranberry', 'sweetPotato', 'cider', 'rolls', 'stuffing', 'beans', 'pecanPie', 'corn']
    .map((name) => DISHES[name]);
  const setting = placeSetting();
  const candles = [];
  const ordered = [main, ...segments.filter((seg) => seg !== main).sort((a, b) => b.r - b.l - (a.r - a.l))].filter(Boolean);
  for (const seg of ordered) {
    const room = seg.r - seg.l + 1;
    const fits = (img) => img.height + (img.isCandle ? FLAME_ROWS : 0) <= seg.maxH;
    let row = [];
    if (seg === main) row = main.candles ? [candle(), roastTurkey(), candle()] : [roastTurkey()];
    let right = true;
    const add = (img) => {
      row = right ? [...row, img] : [img, ...row];
      right = !right;
    };
    for (let k = 0; k < queue.length;) {
      if (fits(queue[k]) && rowWidth([...row, queue[k]]) <= room) add(queue.splice(k, 1)[0]);
      else k += 1;
    }
    while (fits(setting) && rowWidth([...row, setting]) <= room) add(setting);
    let x = Math.round(seg.l + (room - rowWidth(row)) / 2);
    for (const img of row) {
      ctx.drawImage(img, x, base - img.height + 1);
      if (img.isCandle) candles.push({ x: x + 1, y: base - img.height });
      x += img.width + DISH_GAP;
    }
  }
  return candles;
}

// Everything above the water, painted once per screen size at sprite scale. The window's glass
// is left clear so the view and its leaves can be drawn underneath. Rows from waterY down sit
// behind the waves.
export function thanksgivingRoom({ w, h, waterY, boatAt, boatOnRight, text }) {
  const plan = planRoom({ w, waterY, boatAt, boatOnRight, text });
  const { win, picture } = plan;
  const canvas = newCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const fill = (color, x, y, cw = 1, ch = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cw, ch);
  };
  const rimTop = waterY - 12;

  // Wallpaper, darker toward the ceiling, with a pale stripe and a small diamond in each panel.
  for (let y = 0; y < h; y += 2) {
    const t = Math.min(1, Math.floor((y / rimTop) * 14) / 14);
    fill(rgbText(blend(ROOM.wallTop, ROOM.wallLow, t)), 0, y, w, 2);
  }
  for (let x = 0; x < w; x += 14) {
    fill('rgba(255,250,224,.09)', x, 0, 4, h);
    fill('rgba(46,56,30,.07)', x - 1, 0, 1, h);
    fill('rgba(46,56,30,.07)', x + 4, 0, 1, h);
    for (let y = 12; y < rimTop; y += 16) {
      fill('rgba(255,250,224,.11)', x + 9, y, 1, 3);
      fill('rgba(255,250,224,.11)', x + 8, y + 1, 3, 1);
    }
  }

  // Crown moulding along the ceiling.
  fill(ROOM.trimShade, 0, 0, w, 1);
  fill(ROOM.trim, 0, 1, w, 2);
  fill(ROOM.trimShade, 0, 3, w, 1);
  fill('rgba(30,36,18,.22)', 0, 4, w, 1);

  if (picture) {
    const { x, y } = picture;
    fill(ROOM.twine, x + 18, y - 7, 2, 1);
    for (let i = 1; i <= 7; i += 1) {
      fill(ROOM.twine, x + 18 - Math.round(i * 2.2), y - 7 + i);
      fill(ROOM.twine, x + 19 + Math.round(i * 2.2), y - 7 + i);
    }
    fill(ROOM.brassDark, x, y, 38, 28);
    fill(ROOM.brass, x + 1, y + 1, 36, 26);
    fill('#f0cd70', x + 1, y + 1, 36, 1);
    fill(ROOM.brassDark, x + 2, y + 2, 34, 24);
    fill('#2f4a36', x + 3, y + 3, 32, 22);
    fill('#3b5a42', x + 3, y + 3, 32, 8);
    stamp(ctx, GOLDFISH, FISH, x + 4, y + 6);
    ctx.drawImage(pilgrimHat(), x + 4 + HAT_AT.x, y + 6 + HAT_AT.y);
    fill('rgba(30,36,18,.25)', x + 1, y + 28, 38, 1);
  }

  if (win) {
    const { x, y, w: ww, h: wh } = win;
    // Glass: cleared for the view underneath, then the frame and its cross bars.
    ctx.clearRect(x + 3, y + 3, ww - 6, wh - 6);
    fill(ROOM.trimShade, x, y, ww, 3);
    fill(ROOM.trimShade, x, y + wh - 3, ww, 3);
    fill(ROOM.trimShade, x, y, 3, wh);
    fill(ROOM.trimShade, x + ww - 3, y, 3, wh);
    fill(ROOM.trim, x + 1, y + 1, ww - 2, 1);
    fill(ROOM.trim, x + 1, y + 1, 1, wh - 2);
    fill(ROOM.trim, x + ww - 2, y + 1, 1, wh - 2);
    const midX = x + Math.floor(ww / 2) - 1;
    const midY = y + 3 + Math.round((wh - 6) * 0.42);
    fill(ROOM.trim, midX, y + 3, 2, wh - 6);
    fill(ROOM.trim, x + 3, midY, ww - 6, 2);
    fill(ROOM.trimShade, midX + 1, y + 3, 1, wh - 6);
    // Sill.
    fill(ROOM.trim, x - 3, y + wh, ww + 6, 2);
    fill(ROOM.trimShade, x - 3, y + wh + 2, ww + 6, 1);
    fill('rgba(30,36,18,.25)', x - 2, y + wh + 3, ww + 4, 1);
    // Curtains gathered with brass ties, hanging from a rod.
    const rodY = y - 4;
    fill(ROOM.brassDark, x - 9, rodY, ww + 18, 2);
    fill(ROOM.brass, x - 9, rodY, ww + 18, 1);
    fill(ROOM.brass, x - 11, rodY - 1, 2, 4);
    fill(ROOM.brass, x + ww + 9, rodY - 1, 2, 4);
    const tieY = y + Math.round(wh * 0.56);
    const bottom = y + wh + 6;
    for (let row = rodY + 2; row < bottom; row += 1) {
      const into = row < tieY
        ? 8 - Math.round(((row - rodY) / (tieY - rodY)) * 9)
        : -1 + Math.round(((row - tieY) / (bottom - tieY)) * 4);
      const width = 8 + into;
      for (let i = 0; i < width; i += 1) {
        const fold = i % 3 === 0 ? ROOM.curtainDark : i % 3 === 1 ? ROOM.curtainLight : ROOM.curtain;
        fill(fold, x - 8 + i, row);
        fill(fold, x + ww + 7 - i, row);
      }
    }
    fill(ROOM.brass, x - 8, tieY, 7, 2);
    fill(ROOM.brass, x + ww + 1, tieY, 7, 2);
  }

  // A garland of leaves swagged between hooks under the moulding.
  const swags = Math.max(2, Math.round(w / 90));
  const leafRows = [LEAF_SHAPES[1], LEAF_SHAPES[2]];
  let n = 0;
  for (let s = 0; s < swags; s += 1) {
    const x0 = Math.round((s * w) / swags);
    const x1 = Math.round(((s + 1) * w) / swags);
    const half = (x1 - x0) / 2;
    let prev = null;
    const cord = (x) => Math.round(5 + 7 * (1 - ((x - x0 - half) / half) ** 2));
    for (let x = x0; x <= x1; x += 1) {
      const y = cord(x);
      fill(ROOM.twine, x, Math.min(y, prev ?? y), 1, Math.abs(y - (prev ?? y)) + 1);
      prev = y;
    }
    for (let x = x0 + 5; x < x1 - 3; x += 7, n += 1) {
      const rows = leafRows[n % 2];
      const [L, D] = LEAF_COLOURS[(n * 2) % LEAF_COLOURS.length];
      stamp(ctx, rows, { L, D }, x - Math.floor(rows[0].length / 2), cord(x));
    }
    stamp(ctx, ['R.R', '.R.', 'R.R'], { R: ROOM.curtainLight }, x0 - 1, 4);
  }

  const candles = dinnerTable(ctx, { w, rimTop, plan });

  // The back rim of the tank, with the wall showing through the glass below it.
  fill(ROOM.woodLight, 0, rimTop, w, 1);
  fill(ROOM.wood, 0, rimTop + 1, w, 2);
  fill(ROOM.woodDark, 0, rimTop + 3, w, 1);
  fill('rgba(127,231,220,.22)', 0, rimTop + 4, w, h - rimTop - 4);
  fill('rgba(240,255,250,.5)', 0, rimTop + 4, w, 1);

  return { canvas, candles, win };
}

// A turkey on the stern and two pumpkins on the bow, painted onto the boat's front layer.
export function dressBoatForThanksgiving({ front }) {
  const ctx = front.getContext('2d');
  const pumpkin = { O: '#ee8a26', d: '#c25f17', S: '#5d7a2b' };
  stamp(ctx, [
    '....S....',
    '..OOSOO..',
    '.OdOOOdO.',
    'OdOOdOOdO',
    'OdOOdOOdO',
    '.OdOOOdO.',
    '..OOOOO..',
  ], pumpkin, 13, 42);
  stamp(ctx, [
    '..S...',
    '.OOOO.',
    'OdOOdO',
    'OdOOdO',
    '.OOOO.',
  ], pumpkin, 22, 44);
  stamp(ctx, [
    '.........RORR.',
    '........ROYOOR',
    '........RYOYOR',
    '..HH....ROYYOR',
    '.HEHH...RYOYOR',
    'FHHHH..BROYOR.',
    '.wHHBBBBBRRR..',
    '.w.BBBbbbBB...',
    '...BBbbbbBB...',
    '....BBBBBB....',
    '.....F..F.....',
    '....FF.FF.....',
  ], {
    R: '#a8402a', O: '#e07b2c', Y: '#f2c14e', H: '#c2453a', E: '#1a0d08', F: '#e8a33a', w: '#d63a2e', B: '#7a4a26', b: '#56331a',
  }, BOAT.w - 26, 37);
}
