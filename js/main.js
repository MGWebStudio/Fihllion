import { World } from './world.js';
import { audio } from './audio.js';
import {
  loadContent, TIERS, rankFor, LIMIT, COUNTDOWN, PROMPTS_PER_DIVE, METRES_PER_POINT, MAX_POINTS,
} from './content.js';
import { buildIndex, findAnswer } from './match.js';
import * as store from './store.js';
import { noteEndless, sendDaily } from './counts.js';
import { askReferee } from './referee.js';
import { activeTheme } from './theme.js';
import { CHANGELOG } from './changelog.js';
import { voiceSupported, listen, stopListening, isListening } from './voice.js';
import { drawLogo, paintIcon, iconURL } from './sprites.js';

const $ = (id) => document.getElementById(id);
const el = Object.fromEntries([
  'hud', 'hudDepth', 'hudScore', 'pips', 'bootMessage', 'title', 'logo', 'btnBegin', 'diveLabel',
  'btnHow', 'btnEndless', 'btnArchive', 'btnStats', 'play', 'promptCard', 'promptNum', 'promptText', 'feedback',
  'answerForm', 'answer', 'clock', 'clockRing', 'clockNum', 'reveal', 'revealCard', 'revealIcon', 'revealTier',
  'revealAnswer', 'revealPts', 'revealLine', 'btnNext', 'results', 'sheet', 'sheetTitle', 'sheetBody', 'sheetClose',
  'btnMenu', 'btnSound', 'btnMic', 'promptPhoto', 'promptCredit', 'btnPhotoInfo',
].map((id) => [id, $(id)]));

const SITE_URL = 'https://mgwebstudio.github.io/Fihllion/';
const RING = 125.664;
const SCREENS = ['title', 'play', 'reveal', 'results'];
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

const G = { phase: 'loading', dive: null, prompt: null, index: null, today: 1, token: 0, lastSecond: null, shownDepth: null, resultsDive: null, fromArchive: false, loading: false, noticeTimer: null };
let content = null;
let world = null;

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDepth = (m) => `${Math.round(m).toLocaleString('en-US')} m`;
const scoreOf = (dive) => dive.rounds.reduce((sum, round) => sum + round.pts, 0);
const depthOf = (dive) => scoreOf(dive) * METRES_PER_POINT;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function currentDate() {
  const forced = IS_LOCAL && new URLSearchParams(location.search).get('today');
  if (forced) {
    const [y, m, d] = forced.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  return new Date();
}

const shortDate = (day) => content.calendar.dateOf(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function untilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const total = Math.max(0, Math.floor((next - now) / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// Screens --------------------------------------------------------------------------------
function setScreen(name) {
  if (name !== 'play') stopListening();
  document.body.dataset.screen = name;
  for (const screen of SCREENS) el[screen].hidden = screen !== name;
  el.hud.hidden = !['play', 'sink', 'reveal'].includes(name);
  el.bootMessage.hidden = true;
  if (name === 'title') fitTitleLogo();
}

function replay(node) {
  node.style.animation = 'none';
  void node.offsetWidth;
  node.style.animation = '';
}

function fitLogo(canvas, maxWidth, maxHeight = Infinity) {
  const { artW, artH } = drawLogo(canvas);
  const scale = Math.max(2, Math.floor(Math.min(maxWidth / artW, maxHeight / artH)));
  canvas.style.width = `${artW * scale}px`;
  canvas.style.height = `${artH * scale}px`;
}

function syncViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement.style;
  root.setProperty('--vv-h', `${vv ? vv.height : innerHeight}px`);
  root.setProperty('--vv-top', `${vv ? vv.offsetTop : 0}px`);
}

// Dive records ---------------------------------------------------------------------------
function makeDive(mode, day, ids) {
  return { mode, day, ids, rounds: [], deadline: null, done: false, onTime: mode === 'daily' && day === G.today };
}

const diveKey = (dive) => (dive.mode === 'endless' ? 'endless.current' : `daily.${dive.day}`);
const saveDive = (dive) => store.set(diveKey(dive), dive);
const getDaily = (day) => store.get(`daily.${day}`) || makeDive('daily', day, content.calendar.idsFor(day));
const isFresh = (dive) => dive.rounds.length === 0 && !dive.deadline;

function anchorsOf(dive) {
  let m = 0;
  const anchors = [];
  for (const round of dive.rounds) {
    m += round.pts * METRES_PER_POINT;
    if (round.tier >= 0) anchors.push({ name: round.name, tier: round.tier, m });
  }
  return anchors;
}

// Endless never shows a daily prompt before its day: it plays past dailies and prompts that
// aren't scheduled. Only if those can't fill one dive does it borrow the dailies furthest away,
// and never one due within a week.
const ENDLESS_MIN = PROMPTS_PER_DIVE;

function endlessPool() {
  const { calendar } = content;
  const safe = [];
  const later = [];
  for (const id of content.ids) {
    const first = calendar.firstDay(id);
    if (first === null || first < G.today) safe.push(id);
    else if (first >= G.today + 7) later.push(id);
  }
  if (safe.length >= ENDLESS_MIN) return safe;
  later.sort((a, b) => calendar.firstDay(b) - calendar.firstDay(a));
  return safe.concat(later.slice(0, ENDLESS_MIN - safe.length));
}

const endlessState = () => store.get('endless.state', { seen: [], next: null, run: 0, best: 0, played: 0 });

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Seven prompts the player hasn't had in Endless yet, from seven categories when the pool allows.
// Prompts they've already met in a daily dive go last. Once they've played the whole pool, it starts over.
function drawEndless(state, pool) {
  const seen = new Set(state.seen || []);
  let fresh = pool.filter((id) => !seen.has(id));
  if (fresh.length < PROMPTS_PER_DIVE) {
    seen.clear();
    fresh = [...pool];
  }
  const met = new Set(store.keysWith('daily.').flatMap((key) => (store.get(key)?.rounds || []).map((round) => round.id)));
  fresh = [...shuffle(fresh.filter((id) => !met.has(id))), ...shuffle(fresh.filter((id) => met.has(id)))];
  const ids = [];
  const categories = new Set();
  for (const id of fresh) {
    if (ids.length < PROMPTS_PER_DIVE && !categories.has(content.categoryOf(id))) {
      categories.add(content.categoryOf(id));
      ids.push(id);
    }
  }
  for (const id of fresh) if (ids.length < PROMPTS_PER_DIVE && !ids.includes(id)) ids.push(id);
  ids.forEach((id) => seen.add(id));
  state.seen = [...seen];
  return ids;
}

// The next endless dive is picked ahead of time, so its prompts can load before anyone asks for it.
function queueEndless() {
  const state = endlessState();
  const pool = endlessPool();
  if (!state.next || !state.next.every((id) => pool.includes(id))) {
    state.next = drawEndless(state, pool);
    store.set('endless.state', state);
  }
  content.load(state.next).catch(() => {});
  return state;
}

// Today's dive and the next endless one load in the background, so starting either is instant.
function prefetch() {
  content.load(content.calendar.idsFor(G.today)).catch(() => {});
  const current = store.get('endless.current');
  if (current && !current.done) content.load(current.ids).catch(() => {});
  else queueEndless();
}

// Title ----------------------------------------------------------------------------------
function refreshTitle() {
  G.today = content.calendar.dayNumber(currentDate());
  const dive = store.get(`daily.${G.today}`);
  const arrow = '<span aria-hidden="true">▼</span>';
  if (dive?.done) {
    el.btnBegin.innerHTML = 'See today’s dive';
    el.diveLabel.textContent = `Next dive in ${untilMidnight()}`;
  } else if (dive && !isFresh(dive)) {
    el.btnBegin.innerHTML = `Keep diving ${arrow}`;
    el.diveLabel.textContent = `Dive #${G.today} · prompt ${Math.min(dive.rounds.length + 1, PROMPTS_PER_DIVE)} of ${PROMPTS_PER_DIVE}`;
  } else {
    el.btnBegin.innerHTML = `Dive in ${arrow}`;
    el.diveLabel.textContent = `Dive #${G.today} · ${shortDate(G.today)}`;
  }
  prefetch();
}

function goHome() {
  G.token += 1;
  G.phase = 'title';
  G.dive = null;
  world.clearDive();
  setScreen('title');
  refreshTitle();
}

// Dive flow ------------------------------------------------------------------------------
function beginDive(dive, { jump = false } = {}) {
  audio.unlock();
  G.token += 1;
  const token = G.token;
  G.dive = dive;
  G.phase = 'entering';
  saveDive(dive);
  world.setDive(depthOf(dive), anchorsOf(dive));
  renderHud();
  setScreen('play');
  el.play.classList.add('is-waiting');
  el.answer.value = '';
  el.feedback.textContent = '';
  // Focus inside the tap so phones open the keyboard.
  el.answer.focus({ preventScroll: true });
  world.enterWater({ jump }).then(() => {
    if (token === G.token) advance();
  });
}

function advance() {
  if (G.dive.rounds.length >= PROMPTS_PER_DIVE) surface();
  else presentPrompt();
}

function presentPrompt() {
  stopListening();
  const dive = G.dive;
  const number = dive.rounds.length + 1;
  G.prompt = content.byId.get(dive.ids[dive.rounds.length]);
  G.index = buildIndex(G.prompt);
  if (!dive.deadline) {
    dive.deadline = Date.now() + (COUNTDOWN + LIMIT) * 1000;
    saveDive(dive);
  }
  el.promptNum.textContent = `${dive.mode === 'endless' ? 'Endless · prompt' : 'Prompt'} ${number} of ${PROMPTS_PER_DIVE}`;
  el.promptText.textContent = G.prompt.text;
  showPromptPhoto();
  el.answer.value = '';
  el.feedback.textContent = '';
  el.feedback.classList.remove('is-bad');
  G.lastSecond = null;
  G.phase = 'prompt';
  setScreen('play');
  el.play.classList.remove('is-waiting');
  replay(el.promptCard);
  el.answer.focus({ preventScroll: true });
  world.restLine = null;
  world.view('play');
  world.setFishMode('idle');
  renderHud();
  updateClock();
}

function updateClock() {
  const msLeft = G.dive.deadline - Date.now();
  if (msLeft <= 0) {
    timeUp();
    return;
  }
  const seconds = msLeft / 1000;
  if (seconds > LIMIT) {
    el.clock.className = 'is-waiting';
    el.clockNum.textContent = LIMIT;
    el.clockRing.style.strokeDashoffset = 0;
    if (!el.feedback.classList.contains('is-bad')) el.feedback.textContent = `Clock starts in ${Math.ceil(seconds - LIMIT)}`;
    return;
  }
  const whole = Math.ceil(seconds);
  el.clock.className = seconds <= 5 ? 'is-danger' : seconds <= 10 ? 'is-warn' : '';
  el.clockNum.textContent = whole;
  el.clockRing.style.strokeDashoffset = RING * (1 - seconds / LIMIT);
  if (G.lastSecond === null && !el.feedback.classList.contains('is-bad')) el.feedback.textContent = '';
  if (whole !== G.lastSecond) {
    if (whole <= 5 && G.lastSecond !== null) audio.tick();
    G.lastSecond = whole;
  }
}

const VOICE_ERRORS = {
  'not-allowed': 'The microphone is blocked. Allow it in your browser’s settings for this site.',
  'service-not-allowed': 'The microphone is blocked. Allow it in your browser’s settings for this site.',
  'no-speech': 'Didn’t catch that. Tap the mic and try again.',
  'audio-capture': 'No microphone found.',
  network: 'Voice needs an internet connection.',
};

// The mic fills the answer box with what the player says. When the browser heard a few versions,
// the first one that's on the list wins. The player still taps Drop, in case it misheard.
function toggleVoice() {
  if (G.phase !== 'prompt') return;
  if (isListening()) {
    stopListening();
    return;
  }
  const prompt = G.prompt;
  el.btnMic.classList.add('is-listening');
  el.btnMic.setAttribute('aria-pressed', 'true');
  el.feedback.classList.remove('is-bad');
  el.feedback.textContent = 'Listening… say your answer.';
  listen({
    onInterim: (text) => {
      if (G.prompt === prompt && G.phase === 'prompt') el.answer.value = text.slice(0, 60);
    },
    onFinal: (heard) => {
      if (G.prompt !== prompt || G.phase !== 'prompt' || !heard.length) return;
      const best = heard.find((text) => findAnswer(text, G.index)) || heard[0];
      el.answer.value = best.slice(0, 60);
      el.feedback.textContent = `Heard “${best}”. Tap Drop to send it.`;
    },
    onError: (reason) => {
      if (G.prompt !== prompt) return;
      el.feedback.classList.add('is-bad');
      el.feedback.textContent = VOICE_ERRORS[reason] || 'Voice didn’t work this time. Try typing it.';
    },
    onEnd: () => {
      el.btnMic.classList.remove('is-listening');
      el.btnMic.setAttribute('aria-pressed', 'false');
    },
  });
}

// Prompt photos --------------------------------------------------------------------------
// A prompt about a person or band shows their photo beside the question ("Name a Michael Jackson
// song"). data/portraits.json is built by scripts/build-portraits.mjs from Wikimedia Commons.
let portraits = null;
let portraitsLoading = null;
function loadPortraits() {
  portraitsLoading ||= fetch('data/portraits.json')
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => { portraits = data; })
    .catch(() => { portraitsLoading = null; });
  return portraitsLoading;
}

function showPromptPhoto() {
  const prompt = G.prompt;
  const photo = portraits?.[prompt?.id];
  el.promptCard.classList.toggle('has-photo', Boolean(photo));
  el.promptPhoto.hidden = !photo;
  showPhotoCredit(false);
  if (photo) {
    let img = el.promptPhoto.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.referrerPolicy = 'no-referrer';
      el.promptPhoto.prepend(img);
    }
    img.src = photo.img;
    img.alt = photo.name;
    el.promptCredit.innerHTML = `Photo: <a href="${esc(photo.page)}" target="_blank" rel="noopener">${esc(photo.credit)}</a>`;
  }
  if (!portraits) loadPortraits()?.then(() => { if (G.prompt === prompt) showPromptPhoto(); });
}

// The credit stays tucked away until the player taps the "i" on the photo.
function showPhotoCredit(open) {
  el.promptCredit.hidden = !open;
  el.btnPhotoInfo.setAttribute('aria-expanded', String(open));
  el.btnPhotoInfo.classList.toggle('is-open', open);
}

function onSubmit(event) {
  event.preventDefault();
  if (G.phase !== 'prompt') return;
  stopListening();
  const raw = el.answer.value.trim();
  if (!raw) {
    el.answer.focus({ preventScroll: true });
    return;
  }
  const hit = findAnswer(raw, G.index);
  if (hit) lockIn(raw, hit);
  else checkWithReferee(raw);
}

function noBites(raw) {
  el.feedback.textContent = `No bites on “${raw}”. Try again.`;
  el.feedback.classList.add('is-bad');
  el.answerForm.classList.remove('is-shaking');
  void el.answerForm.offsetWidth;
  el.answerForm.classList.add('is-shaking');
  audio.wrong();
  el.answer.select();
}

// An answer that isn't on the list goes to the AI referee. The clock stops while it decides, so
// the wait never costs the player time. When time has already run out (final), a ruling against it
// or no ruling at all ends the round as a miss.
async function checkWithReferee(raw, { final = false } = {}) {
  const { dive, prompt, token } = { dive: G.dive, prompt: G.prompt, token: G.token };
  const started = Date.now();
  G.phase = 'checking';
  el.feedback.classList.remove('is-bad');
  el.feedback.textContent = `Not on our list. Asking the referee about “${raw}”…`;
  el.play.classList.add('is-checking');
  const verdict = await askReferee(prompt.id, raw);
  if (token !== G.token || G.dive !== dive || G.prompt !== prompt) return; // they left meanwhile
  el.play.classList.remove('is-checking');
  if (!final) {
    dive.deadline += Date.now() - started;
    saveDive(dive);
  }
  if (verdict) {
    lockIn(raw, { ...verdict, checked: true });
  } else if (final) {
    missRound(raw);
  } else {
    G.phase = 'prompt';
    G.lastSecond = null;
    noBites(raw);
  }
}

function timeUp() {
  stopListening();
  const typed = el.answer.value.trim();
  const hit = typed ? findAnswer(typed, G.index) : null;
  if (hit) lockIn(typed, hit);
  else if (typed) checkWithReferee(typed, { final: true });
  else missRound(null);
}

function missRound(typed) {
  const dive = G.dive;
  const round = { id: G.prompt.id, input: typed || null, name: null, tier: -1, pts: 0 };
  dive.rounds.push(round);
  dive.deadline = null;
  saveDive(dive);
  el.answer.blur();
  audio.miss();
  world.say('what was the question?');
  showReveal(round);
}

function lockIn(raw, hit) {
  const dive = G.dive;
  const round = { id: G.prompt.id, input: raw, name: hit.name, tier: hit.tier, pts: TIERS[hit.tier].pts };
  if (hit.checked) round.checked = true;
  dive.rounds.push(round);
  dive.deadline = null;
  saveDive(dive);
  el.answer.blur();
  G.phase = 'sinking';
  const token = G.token;
  setScreen('sink');
  world.drop({ name: hit.name, tier: hit.tier }).then(() => {
    if (token === G.token) showReveal(round);
  });
}

function showReveal(round) {
  G.phase = 'reveal';
  const last = G.dive.rounds.length >= PROMPTS_PER_DIVE;
  const missed = round.tier < 0;
  const tier = TIERS[round.tier];
  paintIcon(el.revealIcon, missed ? 'iconMiss' : tier.icon);
  el.revealTier.textContent = missed ? 'Nothing caught' : tier.name;
  el.revealTier.style.color = missed ? 'var(--muted)' : tier.color;
  el.revealAnswer.textContent = missed ? 'Time ran out' : `“${round.name}”`;
  el.revealPts.textContent = missed ? '+0 pts · stayed put' : `+${round.pts} pts · sank ${fmtDepth(round.pts * METRES_PER_POINT)}`;
  el.revealLine.textContent = missed
    ? 'What was the question again?'
    : round.tier === 5 ? (G.prompt.gem?.blurb || pick(tier.lines))
      : round.checked ? 'Not on our list, but the referee says it counts.' : pick(tier.lines);
  el.btnNext.innerHTML = last ? 'Surface <span aria-hidden="true">▲</span>' : 'Keep sinking <span aria-hidden="true">▼</span>';
  setScreen('reveal');
  replay(el.revealCard);
  renderHud();
  world.view('reveal');
  el.btnNext.focus({ preventScroll: true });
}

function surface() {
  const dive = G.dive;
  dive.done = true;
  dive.deadline = null;
  saveDive(dive);
  if (dive.mode === 'daily') sendDaily(dive, content.calendar);
  if (dive.mode === 'endless') {
    const state = endlessState();
    state.best = Math.max(state.best || 0, scoreOf(dive));
    state.played = (state.played || 0) + 1;
    store.set('endless.state', state);
  }
  G.phase = 'surfacing';
  const token = G.token;
  setScreen('sink');
  el.hud.hidden = true;
  world.ascend().then(() => {
    if (token === G.token) showResults(dive);
  });
}

// HUD ------------------------------------------------------------------------------------
function renderPips() {
  const dive = G.dive;
  el.pips.innerHTML = Array.from({ length: PROMPTS_PER_DIVE }, (_, i) => {
    const round = dive.rounds[i];
    if (round) {
      // Deeper answers fill more of the pip, so the tier doesn't rely on color alone.
      if (round.tier < 0) return '<i class="is-missed"></i>';
      const { color } = TIERS[round.tier];
      return `<i style="background:linear-gradient(${color},${color}) top/100% ${Math.round(((round.tier + 1) / TIERS.length) * 100)}% no-repeat"></i>`;
    }
    return i === dive.rounds.length && G.phase === 'prompt' ? '<i class="is-current"></i>' : '<i></i>';
  }).join('');
}

function renderHud() {
  const dive = G.dive;
  if (!dive) return;
  el.hudScore.textContent = scoreOf(dive);
  renderPips();
}

function tick() {
  requestAnimationFrame(tick);
  if (G.phase === 'prompt') updateClock();
  if (!el.hud.hidden) {
    const depth = Math.round(world.shownDepth());
    if (depth !== G.shownDepth) {
      G.shownDepth = depth;
      el.hudDepth.textContent = fmtDepth(depth);
    }
  }
}

setInterval(() => {
  if (!content) return;
  if (G.phase === 'title' && document.body.dataset.screen === 'title') {
    if (el.diveLabel.textContent.startsWith('Next dive')) el.diveLabel.textContent = `Next dive in ${untilMidnight()}`;
    if (content.calendar.dayNumber(currentDate()) !== G.today) refreshTitle();
  }
  const countdown = $('nextDiveCountdown');
  if (countdown) countdown.textContent = untilMidnight();
}, 1000);

// Stats ----------------------------------------------------------------------------------
function computeStats() {
  const records = store.keysWith('daily.').map((key) => store.get(key)).filter((rec) => rec && rec.done);
  const onTimeDays = records.filter((rec) => rec.onTime).map((rec) => rec.day).sort((a, b) => a - b);
  const played = new Set(onTimeDays);
  let streak = 0;
  let cursor = played.has(G.today) ? G.today : G.today - 1;
  while (played.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  let bestStreak = 0;
  let run = 0;
  let previous = null;
  for (const day of onTimeDays) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = day;
  }
  const scores = records.map(scoreOf);
  const buckets = Array(7).fill(0);
  for (const score of scores) buckets[Math.min(6, Math.floor(score / 100))] += 1;
  return {
    dives: records.length,
    streak,
    bestStreak,
    best: scores.length ? Math.max(...scores) : 0,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    gems: records.reduce((sum, rec) => sum + rec.rounds.filter((round) => round.tier === 5).length, 0),
    buckets,
  };
}

function statsHTML(highlightScore = null) {
  const s = computeStats();
  if (!s.dives) return '<p class="empty">Finish a daily dive to start your record.</p>';
  const biggest = Math.max(...s.buckets, 1);
  const nowBucket = highlightScore === null ? -1 : Math.min(6, Math.floor(highlightScore / 100));
  const rows = s.buckets.map((count, i) => {
    const label = i === 6 ? '600–700' : `${i * 100}–${i * 100 + 99}`;
    const width = count ? Math.max(3, (count / biggest) * 78) : 0;
    return `<div class="hist-row${i === nowBucket ? ' is-now' : ''}" title="${count} ${count === 1 ? 'dive' : 'dives'} scored ${label}">
      <span>${label}</span>
      <span class="hist-track"><span class="hist-bar" style="width:${width}%"></span><span>${count || ''}${i === nowBucket ? ' · this dive' : ''}</span></span>
    </div>`;
  }).join('');
  return `<div class="stats">
      <div class="stat"><b>${s.streak}</b><span>Day streak</span></div>
      <div class="stat"><b>${s.best}</b><span>Best dive</span></div>
      <div class="stat"><b>${s.average}</b><span>Average</span></div>
      <div class="stat"><b>${s.dives}</b><span>Dives</span></div>
    </div>
    <div class="hist" role="img" aria-label="Your dives by score">${rows}</div>
    <p class="results-next">Longest streak: <b>${s.bestStreak}</b> · hidden answers found: <b>${s.gems}</b></p>`;
}

// Results --------------------------------------------------------------------------------
function shareText(dive) {
  const total = scoreOf(dive);
  const title = dive.mode === 'endless' ? `Fihllion Endless #${dive.day}` : `Fihllion #${dive.day}`;
  const row = dive.rounds.map((round) => (round.tier < 0 ? '⬛' : TIERS[round.tier].emoji)).join('');
  return `${title} 🐠\n${total}/${MAX_POINTS} · ${fmtDepth(total * METRES_PER_POINT)}\n${row}\n${SITE_URL}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function renderChart(box, dive) {
  const width = box.clientWidth || 320;
  const height = 190;
  const m = { l: 52, r: 18, t: 10, b: 24 };
  const depths = [0];
  for (const round of dive.rounds) depths.push(depths[depths.length - 1] + round.pts * METRES_PER_POINT);
  const final = depths[depths.length - 1];
  // Leaves room under the last point for its label; the line always arrives from above.
  let floor = Math.max(1000, (Math.floor(final / 1000) + 1) * 1000);
  if (floor - final < floor * 0.12) floor += 1000;
  floor = Math.min(7000, floor);
  const step = floor <= 2000 ? 500 : 1000;
  const x = (i) => m.l + (i * (width - m.l - m.r)) / PROMPTS_PER_DIVE;
  const y = (depth) => m.t + (depth / floor) * (height - m.t - m.b);
  let grid = '';
  for (let d = 0; d <= floor; d += step) {
    grid += `<line x1="${m.l}" x2="${width - m.r}" y1="${y(d)}" y2="${y(d)}" stroke="#1a4a66" stroke-width="1"/>`;
    grid += `<text x="${m.l - 7}" y="${y(d) + 3}" text-anchor="end">${d.toLocaleString('en-US')}</text>`;
  }
  let xLabels = '';
  for (let i = 1; i <= PROMPTS_PER_DIVE; i += 1) xLabels += `<text x="${x(i)}" y="${height - 6}" text-anchor="middle">${i}</text>`;
  const points = depths.map((depth, i) => `${x(i)},${y(depth)}`).join(' ');
  const markers = depths.slice(1).map((depth, i) => `<rect x="${x(i + 1) - 4}" y="${y(depth) - 4}" width="8" height="8" fill="#ff8a1e" stroke="#06182a" stroke-width="2" paint-order="stroke"/>`).join('');
  const labelBelow = y(final) + 22 < height - m.b;
  box.innerHTML = `<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="Depth after each prompt, ending at ${fmtDepth(final)}">
      ${grid}${xLabels}
      <polyline points="${points}" fill="none" stroke="#ff8a1e" stroke-width="2"/>
      ${markers}
      <text class="final-label" x="${x(PROMPTS_PER_DIVE) - (labelBelow ? 0 : 12)}" y="${y(final) + (labelBelow ? 22 : 5)}" text-anchor="end">${fmtDepth(final)}</text>
    </svg><div class="chart-tip" hidden></div>`;
  const tip = box.querySelector('.chart-tip');
  const svg = box.querySelector('svg');
  const show = (event) => {
    const rect = svg.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const i = clamp(Math.round(((px - m.l) / (width - m.l - m.r)) * PROMPTS_PER_DIVE), 1, PROMPTS_PER_DIVE);
    const round = dive.rounds[i - 1];
    if (!round) return;
    const prompt = content.byId.get(round.id);
    const tierName = round.tier >= 0 ? TIERS[round.tier].name : 'Nothing caught';
    tip.innerHTML = `${esc(round.name || 'Nothing caught')}<small>${esc(prompt?.text || '')}</small><small>${esc(tierName)} · ${fmtDepth(depths[i])}</small>`;
    tip.hidden = false;
    const tipW = tip.offsetWidth;
    tip.style.left = `${clamp(x(i) - tipW / 2, 0, width - tipW)}px`;
    tip.style.top = `${Math.max(0, y(depths[i]) - tip.offsetHeight - 10)}px`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function showResults(dive) {
  G.phase = 'results';
  G.resultsDive = dive;
  G.dive = null;
  G.token += 1;
  world.clearDive();
  setScreen('results');
  const total = scoreOf(dive);
  const rank = rankFor(total);
  const isEndless = dive.mode === 'endless';
  const heading = isEndless ? `Endless dive #${dive.day}` : `Dive #${dive.day} · ${shortDate(dive.day)}`;
  const nextLine = isEndless
    ? `<p class="results-next">Best endless dive: <b>${store.get('endless.state', {}).best || total}</b></p>`
    : dive.day === G.today ? `<p class="results-next">Next dive in <b id="nextDiveCountdown"></b></p>
      <p class="results-soon label">Ranked leaderboard · coming soon</p>` : '';
  const primary = isEndless
    ? '<button id="resNext" class="btn btn-quiet" type="button">Next endless dive</button>'
    : '<button id="resEndless" class="btn btn-quiet" type="button">Play endless</button>';
  // Only the player's own answers. Listing the rest would give away the hidden answers for
  // anyone who meets the prompt again.
  const rounds = dive.rounds.map((round) => {
    const prompt = content.byId.get(round.id);
    const tier = TIERS[round.tier];
    return `<div class="round">
        <span class="round-prompt">${esc(prompt?.text || round.id)}</span>
        <span class="round-answer">${esc(round.name || 'Nothing caught')}</span>
        <span class="round-tier" style="color:${round.tier >= 0 ? tier.color : 'var(--muted)'}">${round.tier >= 0 ? esc(tier.name) : 'Time ran out'}</span>
        <span class="round-pts">${round.pts}</span>
      </div>`;
  }).join('');
  el.results.innerHTML = `<div class="results-inner">
      <div class="results-head">
        <canvas id="resLogo" role="img" aria-label="Fihllion"></canvas>
        <span class="label">${esc(heading)}</span>
      </div>
      <div class="results-score">
        <span class="results-total">${total}</span><span class="results-of">/ ${MAX_POINTS}</span><span class="results-depth">${fmtDepth(total * METRES_PER_POINT)}</span>
      </div>
      <p class="results-rank">${esc(rank.name)}</p>
      <p class="results-joke">${esc(rank.joke)}</p>
      <div class="results-actions">
        <button id="resCopy" class="btn btn-primary" type="button">Copy result</button>
        ${primary}
        <button id="resHome" class="btn btn-quiet" type="button">${G.fromArchive ? 'Back to archive' : 'Back to the boat'}</button>
      </div>
      ${nextLine}
      <section class="block">
        <div class="block-title"><h3>Dive log</h3><span>Depth after each prompt</span></div>
        <div id="resChart" class="chart"></div>
      </section>
      <section class="block">
        <div class="block-title"><h3>Your catches</h3></div>
        <div class="rounds">${rounds}</div>
      </section>
      ${isEndless ? '' : `<section class="block">
        <div class="block-title"><h3>Your record</h3></div>
        ${statsHTML(total)}
      </section>`}
      <p class="credit-line">Fihllion is a fan take inspired by <a href="https://krillion.io" target="_blank" rel="noopener">Krillion</a>.</p>
    </div>`;
  fitLogo($('resLogo'), 200);
  renderChart($('resChart'), dive);
  const countdown = $('nextDiveCountdown');
  if (countdown) countdown.textContent = untilMidnight();
  const copy = $('resCopy');
  copy.addEventListener('click', async () => {
    audio.unlock();
    audio.click();
    const text = shareText(dive);
    const ok = await copyText(text);
    copy.textContent = ok ? 'Copied' : 'Copy it below';
    setTimeout(() => { copy.textContent = 'Copy result'; }, 2000);
    if (!ok && !$('resManual')) {
      const area = document.createElement('textarea');
      area.id = 'resManual';
      area.className = 'manual-copy';
      area.readOnly = true;
      area.rows = 4;
      area.value = text;
      area.setAttribute('aria-label', 'Your result, to copy by hand');
      copy.parentElement.after(area);
      area.select();
    }
  });
  $('resHome').addEventListener('click', () => {
    audio.click();
    const backToArchive = G.fromArchive;
    G.fromArchive = false;
    goHome();
    if (backToArchive) openArchive();
  });
  $('resNext')?.addEventListener('click', () => startEndless());
  $('resEndless')?.addEventListener('click', () => { G.fromArchive = false; startEndless(); });
  el.results.scrollTop = 0;
  el.results.focus({ preventScroll: true });
}

// Modes ----------------------------------------------------------------------------------
function notice(text) {
  el.bootMessage.textContent = text;
  el.bootMessage.classList.add('is-notice');
  el.bootMessage.hidden = false;
  clearTimeout(G.noticeTimer);
  G.noticeTimer = setTimeout(() => { el.bootMessage.hidden = true; }, 5000);
}

// Runs `then` once these prompts have loaded. When they already have, it runs straight away,
// still inside the tap, which phones need before they'll open the keyboard.
function whenLoaded(ids, then) {
  if (content.has(ids)) {
    then();
    return;
  }
  if (G.loading) return;
  G.loading = true;
  content.load(ids)
    .then(() => then(), (error) => {
      console.error(error);
      notice('Couldn’t load that dive. Check your connection and try again.');
    })
    .finally(() => { G.loading = false; });
}

function startDaily() {
  audio.unlock();
  audio.click();
  const dive = getDaily(G.today);
  whenLoaded(dive.ids, () => {
    G.fromArchive = false;
    if (dive.done) showResults(dive);
    else beginDive(dive, { jump: isFresh(dive) });
  });
}

function startEndless() {
  audio.unlock();
  audio.click();
  closeSheet();
  const current = store.get('endless.current');
  if (current && !current.done) {
    whenLoaded(current.ids, () => beginDive(current, { jump: isFresh(current) }));
    return;
  }
  const state = queueEndless();
  whenLoaded(state.next, () => {
    const ids = state.next;
    state.next = null;
    state.run += 1;
    store.set('endless.state', state);
    noteEndless(ids);
    beginDive(makeDive('endless', state.run, ids), { jump: true });
    queueEndless();
  });
}

function openDay(day) {
  closeSheet();
  const dive = getDaily(day);
  whenLoaded(dive.ids, () => {
    G.fromArchive = true;
    if (dive.done) showResults(dive);
    else beginDive(dive, { jump: isFresh(dive) });
  });
}

// Sheets ---------------------------------------------------------------------------------
function openSheet(title, html) {
  el.sheetTitle.textContent = title;
  el.sheetBody.innerHTML = html;
  if (!el.sheet.open) el.sheet.showModal();
  el.sheet.scrollTop = 0;
}

function closeSheet() {
  if (el.sheet.open) el.sheet.close();
}

function openHow() {
  const tiers = TIERS.map((tier) => `<div class="tier-row">
      <img class="pixel" src="${iconURL(tier.icon)}" alt="">
      <span style="color:${tier.color}">${esc(tier.name)}<em>${esc(tier.blurb)}</em></span>
      <b>${tier.pts}</b>
    </div>`).join('');
  openSheet('How to play', `<ul class="how-steps">
      <li>Seven new prompts every day, the same for everyone.</li>
      <li>You get 25 seconds to name one thing. Close spellings count, and a wrong answer only costs you time.</li>
      <li>The answers everyone thinks of barely get you wet. The rare ones pull you down.</li>
      <li>Every point sinks you 10 metres. A perfect 700 reaches 7,000 m.</li>
      <li>One dive a day. Endless mode is there if you want more.</li>
      <li>Not on our list? An AI referee checks it, so real deep cuts still count.</li>
      <li>Tap the mic to say your answer instead of typing it.</li>
      <li>Daily answers are counted anonymously to rank how rare each one is, and answers the referee checks are saved anonymously too.</li>
    </ul>
    <div class="tier-table">${tiers}</div>`);
}

// What's new -----------------------------------------------------------------------------
const newsId = (entry) => `${entry.date} ${entry.time}`;
const newsDate = (entry) => {
  const [y, m, d] = entry.date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// The title screen names the latest update, with a dot until the player has opened the list.
function refreshNews() {
  const latest = CHANGELOG[0];
  const chip = $('btnNews');
  if (!latest || !chip) return;
  const unseen = store.get('news.seen') !== newsId(latest);
  const [, m, d] = latest.date.split('-').map(Number);
  const when = new Date(2000, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  chip.innerHTML = `${unseen ? '<i class="news-dot" aria-hidden="true"></i>' : ''}<span class="news-when">New · ${esc(when)}</span><span class="news-what">${esc(latest.short)}</span>`;
  chip.setAttribute('aria-label', `What’s new: ${latest.title}, ${newsDate(latest)}`);
  chip.hidden = false;
}

function openNews() {
  const entries = CHANGELOG.map((entry, i) => `<li class="news-entry">
      <p class="label news-stamp">${esc(newsDate(entry))} · ${esc(entry.time)} MT${i === 0 ? ' <span class="news-latest">Latest</span>' : ''}</p>
      <h3 class="news-title">${esc(entry.title)}</h3>
      <ul class="news-items">${entry.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
    </li>`).join('');
  openSheet('What’s new', `<ol class="news-list">${entries}</ol>`);
  if (CHANGELOG[0]) store.set('news.seen', newsId(CHANGELOG[0]));
  refreshNews();
}

function openStats() {
  const best = store.get('endless.state', {}).best;
  openSheet('My stats', `${statsHTML()}${best ? `<p class="results-next">Best endless dive: <b>${best}</b></p>` : ''}`);
}

function openArchive() {
  const rows = [];
  for (let day = G.today - 1; day >= 1; day -= 1) {
    const rec = store.get(`daily.${day}`);
    const status = rec?.done ? `${scoreOf(rec)} / ${MAX_POINTS}` : rec && !isFresh(rec) ? 'Keep diving' : 'Play';
    rows.push(`<li><button type="button" data-day="${day}"><span>Dive #${day} · ${esc(shortDate(day))}</span><small>${esc(status)}</small></button></li>`);
  }
  openSheet('Archive', rows.length ? `<ul class="sheet-list">${rows.join('')}</ul>` : '<p class="empty">Past dives land here. The first one shows up tomorrow.</p>');
  el.sheetBody.querySelectorAll('button[data-day]').forEach((button) => {
    button.addEventListener('click', () => openDay(Number(button.dataset.day)));
  });
}

function openMenu() {
  const inDive = Boolean(G.dive);
  const items = [
    inDive ? ['Back to the boat', 'menuHome'] : null,
    ['Today’s dive', 'menuDaily'],
    ['Endless', 'menuEndless'],
    ['Archive', 'menuArchive'],
    ['My stats', 'menuStats'],
    ['How to play', 'menuHow'],
    ['What’s new', 'menuNews'],
  ].filter(Boolean);
  const note = G.phase === 'prompt' ? '<p class="results-next">Your dive is saved, but the clock keeps running.</p>' : '';
  openSheet('Menu', `<ul class="sheet-list">${items.map(([label, id]) => `<li><button type="button" id="${id}"><span>${esc(label)}</span></button></li>`).join('')}</ul>${note}`);
  $('menuHome')?.addEventListener('click', () => { closeSheet(); goHome(); });
  $('menuDaily').addEventListener('click', () => {
    closeSheet();
    if (G.dive && G.dive.mode === 'daily' && G.dive.day === G.today) return;
    startDaily();
  });
  $('menuEndless').addEventListener('click', () => {
    if (G.dive?.mode === 'endless') { closeSheet(); return; }
    startEndless();
  });
  $('menuArchive').addEventListener('click', openArchive);
  $('menuStats').addEventListener('click', openStats);
  $('menuHow').addEventListener('click', openHow);
  $('menuNews').addEventListener('click', openNews);
}

// Boot -----------------------------------------------------------------------------------
function wire() {
  el.btnBegin.addEventListener('click', startDaily);
  el.btnEndless.addEventListener('click', startEndless);
  $('btnNews').addEventListener('click', () => { audio.click(); openNews(); });
  if (voiceSupported) {
    el.btnMic.hidden = false;
    el.btnMic.addEventListener('click', toggleVoice);
  }
  loadPortraits();
  // Tapping the "i" mustn't pull focus from the answer box, or a phone's keyboard would close.
  el.btnPhotoInfo.addEventListener('pointerdown', (event) => event.preventDefault());
  el.btnPhotoInfo.addEventListener('click', () => showPhotoCredit(el.promptCredit.hidden));
  el.btnHow.addEventListener('click', () => { audio.unlock(); audio.click(); openHow(); });
  el.btnArchive.addEventListener('click', () => { audio.unlock(); audio.click(); openArchive(); });
  el.btnStats.addEventListener('click', () => { audio.unlock(); audio.click(); openStats(); });
  el.btnMenu.addEventListener('click', () => { audio.unlock(); audio.click(); openMenu(); });
  el.btnNext.addEventListener('click', () => { audio.click(); advance(); });
  el.answerForm.addEventListener('submit', onSubmit);
  el.answerForm.addEventListener('animationend', () => el.answerForm.classList.remove('is-shaking'));
  el.sheetClose.addEventListener('click', closeSheet);
  el.sheet.addEventListener('click', (event) => { if (event.target === el.sheet) closeSheet(); });
  el.sheet.addEventListener('close', () => { if (G.phase === 'prompt') el.answer.focus({ preventScroll: true }); });
  el.answer.addEventListener('input', () => {
    if (el.feedback.classList.contains('is-bad')) {
      el.feedback.classList.remove('is-bad');
      el.feedback.textContent = '';
    }
  });
  el.btnSound.addEventListener('click', () => {
    const muted = !audio.muted;
    audio.setMuted(muted);
    store.set('muted', muted);
    el.btnSound.setAttribute('aria-pressed', String(!muted));
    if (!muted) { audio.unlock(); audio.click(); }
  });
  addEventListener('resize', () => {
    syncViewport();
    fitTitleLogo();
    const chart = $('resChart');
    if (chart && G.resultsDive && document.body.dataset.screen === 'results') renderChart(chart, G.resultsDive);
  });
  document.fonts?.ready.then(() => fitTitleLogo());
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  el.answer.addEventListener('focus', () => window.scrollTo(0, 0));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && G.phase === 'title') refreshTitle();
  });
}

// Tries the full layout, then a compact one, then drops the tagline, so nothing lands on the bowl.
function fitTitleLogo() {
  if (el.title.hidden) return;
  const sky = el.title.querySelector('.title-sky');
  const tagline = el.title.querySelector('.tagline');
  const limit = world.titleTextLimit();
  const clashes = () => tagline.getBoundingClientRect().bottom > limit;
  sky.classList.remove('is-compact');
  tagline.hidden = false;
  fitLogo(el.logo, Math.min(innerWidth - 32, 620), innerHeight * 0.24);
  if (clashes()) {
    sky.classList.add('is-compact');
    fitLogo(el.logo, Math.min(innerWidth - 120, 620), innerHeight * 0.2);
    if (clashes()) tagline.hidden = true;
  }
  // The Thanksgiving dinner table is laid out around the text, line by line.
  const boxes = [...sky.children].filter((node) => !node.hidden).flatMap((node) => {
    if (node.tagName !== 'P') return [node.getBoundingClientRect()];
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].filter((rect) => rect.width > 0);
  });
  world.setTitleText(boxes);
}

async function boot() {
  syncViewport();
  const theme = activeTheme(currentDate());
  world = new World($('world'), { theme });
  if (theme) {
    document.documentElement.dataset.theme = theme.name;
    $('themeNote').textContent = theme.note;
    $('themeNote').hidden = false;
  }
  const muted = store.get('muted', false);
  audio.setMuted(muted);
  el.btnSound.setAttribute('aria-pressed', String(!muted));
  try {
    content = await loadContent();
  } catch (error) {
    el.bootMessage.textContent = 'Couldn’t load today’s dive. Check your connection and reload the page.';
    console.error(error);
    return;
  }
  G.today = content.calendar.dayNumber(currentDate());
  wire();
  let shift = 0;
  setInterval(() => {
    if (document.body.dataset.screen !== 'title') return;
    shift = shift ? 0 : 1;
    drawLogo(el.logo, shift);
  }, 800);
  refreshTitle();
  refreshNews();
  // A dive that finished while the counter was unreachable gets another try.
  for (const day of [G.today - 1, G.today]) {
    const rec = store.get(`daily.${day}`);
    if (rec) sendDaily(rec, content.calendar);
  }
  G.phase = 'title';
  setScreen('title');
  requestAnimationFrame(tick);
  document.fonts?.ready.then(() => { world.captionLayout = null; });
  if (IS_LOCAL) window.fihllion = { world, G, content, store };
}

boot();
