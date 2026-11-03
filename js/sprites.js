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

export function sun() {
  const size = 72;
  const canvas = newCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const rings = [[36, 'rgba(255,240,190,.28)'], [29, 'rgba(255,236,170,.42)'], [23, '#ffe88f'], [18, '#fff2b5']];
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
