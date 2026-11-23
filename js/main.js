import { World } from './world.js';
import { audio } from './audio.js';
import {
  loadContent, TIERS, rankFor, LIMIT, COUNTDOWN, PROMPTS_PER_DIVE, METRES_PER_POINT, MAX_POINTS,
  mountainToday, mountainParts, withHiddenAnswer,
} from './content.js';
import { buildIndex, findAnswer } from './match.js';
import * as store from './store.js';
import { noteEndless, sendDaily, sendVisit } from './counts.js';
import { askReferee } from './referee.js';
import * as ranked from './ranked.js';
import { findServer, post } from './server.js';
import { activeTheme } from './theme.js';
import { CHANGELOG } from './changelog.js';
import { POLL, pollOpen } from './poll.js';
import { NOTE } from './note.js';
import { voiceSupported, listen, stopListening, isListening } from './voice.js';
import { drawLogo, paintIcon, iconURL, champion, goldfish } from './sprites.js';

const $ = (id) => document.getElementById(id);
const el = Object.fromEntries([
  'hud', 'hudDepth', 'hudScore', 'pips', 'bootMessage', 'title', 'logo', 'btnBegin', 'diveLabel',
  'btnHow', 'btnEndless', 'btnArchive', 'btnStats', 'btnFeedback', 'play', 'promptCard', 'promptNum', 'promptText', 'feedback',
  'answerForm', 'answer', 'clock', 'clockRing', 'clockNum', 'reveal', 'revealCard', 'revealIcon', 'revealTier',
  'revealAnswer', 'revealPts', 'revealLine', 'btnNext', 'results', 'sheet', 'sheetTitle', 'sheetBody', 'sheetClose',
  'btnMenu', 'btnSound', 'btnMic', 'promptPhoto', 'promptCredit', 'btnPhotoInfo',
  'hudMode', 'modeBanner', 'dailyTag', 'rankedLine',
].map((id) => [id, $(id)]));

const SITE_URL = 'https://mgwebstudio.github.io/Fihllion/';
const RING = 125.664;
const SCREENS = ['title', 'play', 'reveal', 'results'];
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
// ?today= pretends it's another day, which the ranked server won't go along with, so ranked sits out.
const PRETEND_DAY = IS_LOCAL && new URLSearchParams(location.search).has('today');

// The Daily is for computers. Phones and tablets get Endless only, so nobody can play today's
// prompts on their phone and then again, ranked, on a school computer. (Phones used to get
// yesterday's Daily, which looked like a bug that repeated it.) Chromebooks count as computers,
// touch screen or not. On this PC, ?device=phone or ?device=computer tries either.
const ON_PHONE = (() => {
  const forced = IS_LOCAL && new URLSearchParams(location.search).get('device');
  if (forced) return forced === 'phone';
  const ua = navigator.userAgent || '';
  if (/CrOS/.test(ua)) return false;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true; // iPads say they're Macs
  // A phone asking for the desktop site still has only a touch screen.
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches);
})();

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
  return mountainToday();
}

const shortDate = (day) => content.calendar.dateOf(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Time left until midnight Mountain Time, when the next Daily starts.
function untilMidnight() {
  const { hour, minute, second } = mountainParts();
  const total = Math.max(0, 86400 - (hour * 3600 + minute * 60 + second));
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// Screens --------------------------------------------------------------------------------
function setScreen(name) {
  if (name !== 'play') stopListening();
  if (name !== 'results') stopBoardPolling();
  if (name !== 'play') {
    clearTimeout(G.bannerTimer);
    el.modeBanner.hidden = true;
  }
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

// What kind of dive this is, said the same way on the banner, the HUD and the prompt card, so it's
// always clear whether a dive counts.
function modeOf(dive) {
  if (dive.mode === 'endless') return { key: 'endless', tag: 'Endless', long: 'Endless', note: 'Practice. Nothing here counts.' };
  if (dive.day !== G.today) return { key: 'archive', tag: `Archive #${dive.day}`, long: `Archive · Dive #${dive.day}`, note: 'A replay of a past day.' };
  if (dive.ranked) return { key: 'ranked', tag: `Ranked #${dive.day}`, long: `Ranked Daily · Dive #${dive.day}`, note: 'One try. This one counts.' };
  return {
    key: 'daily',
    tag: `Daily #${dive.day}`,
    long: `Today’s Daily · Dive #${dive.day}`,
    note: ranked.available ? 'Just for fun. Not on the leaderboard.' : 'The same seven prompts for everyone today.',
  };
}

function showModeBanner(dive) {
  const mode = modeOf(dive);
  el.modeBanner.className = `mode-banner mode-${mode.key}`;
  el.modeBanner.innerHTML = `<span class="mode-banner-tag">${esc(mode.long)}</span><span class="mode-banner-note">${esc(mode.note)}</span>`;
  el.modeBanner.hidden = false;
  replay(el.modeBanner);
  clearTimeout(G.bannerTimer);
  G.bannerUntil = Date.now() + 2200; // stays up a moment even when the dive loads instantly
}

function hideModeBanner() {
  clearTimeout(G.bannerTimer);
  G.bannerTimer = setTimeout(() => { el.modeBanner.hidden = true; }, Math.max(0, (G.bannerUntil || 0) - Date.now()));
}

const isRankedToday = (dive) => Boolean(dive.ranked) && dive.mode === 'daily' && dive.day === G.today;

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
  // Not even a returning prompt from today's Daily, so Endless can't preview the ranked dive.
  const todays = new Set(calendar.idsFor(G.today));
  for (const id of content.ids) {
    if (content.retired(id) || todays.has(id)) continue;
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
  if (!ON_PHONE) content.load(content.calendar.idsFor(G.today)).catch(() => {});
  const current = store.get('endless.current');
  if (current && !current.done) content.load(current.ids).catch(() => {});
  else queueEndless();
}

// Title ----------------------------------------------------------------------------------
function refreshTitle() {
  G.today = content.calendar.dayNumber(currentDate());
  const arrow = '<span aria-hidden="true">▼</span>';
  el.rankedLine.hidden = !ranked.available || PRETEND_DAY;
  // On a phone the big button is Endless, and the line under it says where the Daily went.
  el.dailyTag.classList.toggle('is-endless', ON_PHONE);
  el.btnEndless.hidden = ON_PHONE;
  const banned = Boolean(ranked.available && !PRETEND_DAY && ranked.player() && G.rankedStatus?.banned);
  if (ON_PHONE) {
    const current = store.get('endless.current');
    el.dailyTag.textContent = 'Endless · practice';
    el.dailyTag.classList.remove('is-ranked');
    el.btnBegin.innerHTML = `${current && !current.done && !isFresh(current) ? 'Keep diving' : 'Play Endless'} ${arrow}`;
    el.rankedLine.innerHTML = banned ? BANNED_LINE : '<span class="ranked-off">The Daily is on computers only</span> · Leaderboard';
    el.diveLabel.textContent = 'The Daily is on computers only';
    el.diveLabel.hidden = !el.rankedLine.hidden;
    prefetch();
    return;
  }
  const day = G.today;
  const dive = store.get(`daily.${day}`);
  const me = ranked.available && !PRETEND_DAY ? ranked.player() : null;
  const started = dive && !isFresh(dive);
  const isRanked = Boolean(dive?.ranked);
  // The big button is always the Daily, and the tag above it says which. Endless sits below it,
  // marked as practice.
  el.dailyTag.innerHTML = isRanked
    ? `<span aria-hidden="true">★</span> Ranked Daily · Dive #${day}`
    : `Today’s Daily · Dive #${day}`;
  el.dailyTag.classList.toggle('is-ranked', isRanked);
  if (dive?.done) {
    el.btnBegin.innerHTML = 'See today’s results';
    el.diveLabel.textContent = `Next Daily in ${untilMidnight()}`;
  } else if (started) {
    el.btnBegin.innerHTML = `Finish the Daily ${arrow}`;
    el.diveLabel.textContent = `Prompt ${Math.min(dive.rounds.length + 1, PROMPTS_PER_DIVE)} of ${PROMPTS_PER_DIVE} · ${shortDate(day)}`;
  } else {
    el.btnBegin.innerHTML = `Play the Daily ${arrow}`;
    el.diveLabel.textContent = shortDate(day);
  }
  // Before the dive starts, the tag above the button already says which dive it is.
  el.diveLabel.hidden = !started;
  if (banned) el.rankedLine.innerHTML = BANNED_LINE;
  else if (started && isRanked) el.rankedLine.innerHTML = `<span aria-hidden="true">★</span> Ranked as <b>${esc(me?.name || '')}</b> · Leaderboard`;
  else if (started) el.rankedLine.innerHTML = '<span class="ranked-off">Just for fun today</span> · Leaderboard';
  else if (me) el.rankedLine.innerHTML = `Playing as <b>${esc(me.name)}</b> · Leaderboard`;
  else el.rankedLine.innerHTML = '<span aria-hidden="true">★</span> Leaderboard · Add your name';
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
  // Settle on a way to the server while the boat goes in, so the first referee check doesn't wait
  // on it. On blocked networks that means trying both addresses and then the Google relay.
  findServer();
  G.token += 1;
  const token = G.token;
  G.dive = dive;
  G.phase = 'entering';
  saveDive(dive);
  world.setDive(depthOf(dive), anchorsOf(dive));
  renderHud();
  setScreen('play');
  showModeBanner(dive);
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

// One tap moves on, and taps after it do nothing. In ranked the next prompt comes from the server,
// which takes a couple of seconds through the Google relay, so the button shows it's on its way.
function nextFromReveal() {
  if (G.phase !== 'reveal') return;
  audio.click();
  if (isRankedToday(G.dive) && G.dive.rounds.length < PROMPTS_PER_DIVE) {
    el.btnNext.style.minWidth = `${el.btnNext.offsetWidth}px`; // the shorter label mustn't shrink it
    el.btnNext.classList.add('is-busy');
    el.btnNext.setAttribute('aria-disabled', 'true');
    el.btnNext.textContent = 'Sinking...'; // the pixel font has no "…"
  }
  advance();
}

function presentPrompt() {
  stopListening();
  const dive = G.dive;
  if (isRankedToday(dive)) {
    fetchRankedQuestion();
    return;
  }
  const prompt = content.byId.get(dive.ids[dive.rounds.length]);
  G.prompt = withHiddenAnswer(prompt, dive, content.calendar.firstDay(prompt.id));
  G.index = buildIndex(G.prompt);
  if (!dive.deadline) {
    dive.deadline = Date.now() + (COUNTDOWN + LIMIT) * 1000;
    saveDive(dive);
  }
  showPrompt();
}

// Ranked questions come from the server one at a time, and the server's clock is the one that counts.
async function fetchRankedQuestion() {
  const dive = G.dive;
  const token = G.token;
  G.phase = 'fetching';
  let q = null;
  let failure = null;
  try {
    q = await ranked.question(dive.day);
  } catch (error) {
    console.error(error);
    failure = error.name === 'Unreachable' ? 'unreachable' : null;
  }
  // A second reply for the same question would wipe whatever the player has typed since the first.
  if (token !== G.token || G.phase !== 'fetching') return;
  if (!q || q.error) {
    rankedTrouble(q?.error || failure, q);
    return;
  }
  syncRanked(dive, q.run);
  if (q.finished || dive.rounds.length >= PROMPTS_PER_DIVE) {
    surface();
    return;
  }
  G.prompt = { id: q.id, text: q.text, ranked: true, gem: null };
  // Today's answer lists are already loaded (they're public), so an answer on the list can start
  // sinking right away. The server still scores every answer, and its reply is what counts.
  const listed = content.byId.get(q.id);
  G.index = listed ? buildIndex(withHiddenAnswer(listed, { mode: 'daily', day: q.day }, content.calendar.firstDay(q.id))) : null;
  G.rankedRound = q.round;
  dive.deadline = Date.now() + Math.max(0, q.msLeft);
  saveDive(dive);
  showPrompt();
}

// The server's record wins. Questions it settled while this page wasn't looking (a reload, a lost
// connection, leaving the tab) are filled in here.
function syncRanked(dive, run) {
  if (!run || run.rounds.length <= dive.rounds.length) return;
  while (dive.rounds.length < run.rounds.length) {
    const entry = run.rounds[dive.rounds.length];
    dive.rounds.push({ id: dive.ids[dive.rounds.length], input: null, name: null, tier: entry.tier, pts: entry.pts, voided: Boolean(entry.flag) });
  }
  dive.deadline = null;
  saveDive(dive);
  renderHud();
}

// Some school Wi-Fi blocks the server. Shown when neither of its addresses answers.
const BLOCKED_NETWORK = 'Can’t reach the ranked server from this network. Some school Wi-Fi blocks it. Try another network, or play just for fun.';

function rankedTrouble(error, reply) {
  const midnight = error === 'day' && G.dive && reply?.today > G.dive.day;
  const messages = {
    unknown: 'The server doesn’t know your name anymore. Put it in again to play ranked.',
    banned: 'This name is banned from ranked, so today’s dive can’t be ranked.',
    day: midnight ? 'Midnight passed, so that ranked dive is over. Today’s is ready.'
      : 'Your device’s date doesn’t match today’s Daily, so ranked can’t start. Check the date and time.',
    unreachable: BLOCKED_NETWORK,
    paused: 'Ranked is paused for this name for now.', // mid-dive, so today's pick can't change
    rename: 'Pick a new name to keep playing ranked.',
    name: 'Put in your name, or go anonymous, to play ranked.',
  };
  const dive = G.dive;
  // Paused, asked to change name, or not through the name question yet: nothing answered yet, so
  // the choice reopens and says why.
  if (error === 'paused' || error === 'rename' || error === 'name') {
    G.rankedStatus = {
      paused: error === 'paused',
      rename: error === 'rename' ? 'forced' : G.rankedStatus?.rename || null,
      nameCheck: error === 'name' || Boolean(G.rankedStatus?.nameCheck),
    };
    if (dive && dive.mode === 'daily' && dive.day === G.today && isFresh(dive)) {
      delete dive.choice;
      dive.ranked = false;
      saveDive(dive);
      goHome();
      openDailyChoice();
      return;
    }
  }
  // Banned: the device keeps its name, so the player can appeal. Nothing answered yet, so the
  // choice reopens and says so.
  if (error === 'banned') {
    G.rankedStatus = { ...(G.rankedStatus || {}), banned: true };
    if (dive && dive.mode === 'daily' && dive.day === G.today && isFresh(dive)) {
      delete dive.choice;
      dive.ranked = false;
      saveDive(dive);
      goHome();
      openDailyChoice();
      return;
    }
  }
  if (error === 'unknown') {
    ranked.forget();
    // Nothing answered yet, so the choice reopens and they put in a name (or play for fun).
    if (dive && dive.mode === 'daily' && dive.day === G.today && isFresh(dive)) {
      delete dive.choice;
      dive.ranked = false;
      saveDive(dive);
      goHome();
      openDailyChoice('The server doesn’t know your name anymore. Put it in again to play ranked.');
      return;
    }
  }
  goHome();
  notice(messages[error] || 'Couldn’t reach the ranked server. Check your connection and tap Dive in to try again.');
}

function showPrompt() {
  const dive = G.dive;
  const mode = modeOf(dive);
  hideModeBanner();
  el.promptNum.innerHTML = `<span class="mode-chip mode-${mode.key}">${esc(mode.tag)}</span> Prompt ${dive.rounds.length + 1} of ${PROMPTS_PER_DIVE}`;
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
  const photo = prompt?.ranked ? null : portraits?.[prompt?.id]; // no photos in ranked
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
  if (isRankedToday(G.dive)) {
    submitRanked(raw);
    return;
  }
  const hit = findAnswer(raw, G.index);
  if (hit) lockIn(raw, hit);
  else checkWithReferee(raw);
}

// In ranked, every answer goes to the server, which scores it (asking the referee when it isn't on
// the list) and sends back how much time is left on its clock. An answer on this device's copy of
// the list starts sinking while that reply is on its way, which hides the wait on slow routes like
// the Google relay. The reveal still waits for the server's verdict.
async function submitRanked(raw, { final = false } = {}) {
  const { dive, prompt, token } = { dive: G.dive, prompt: G.prompt, token: G.token };
  const listed = raw && G.index ? findAnswer(raw, G.index) : null;
  const reply = ranked.guess(dive.day, G.rankedRound, raw, final).catch((error) => {
    console.error(error);
    return null;
  });
  if (listed) {
    el.answer.blur();
    G.phase = 'sinking';
    setScreen('sink');
    const [, res] = await Promise.all([world.drop({ name: listed.name, tier: listed.tier }), reply]);
    if (token !== G.token || G.dive !== dive || G.prompt !== prompt) return; // they left meanwhile
    settleRanked(raw, res, { final, dropped: true });
    return;
  }
  G.phase = 'checking';
  el.feedback.classList.remove('is-bad');
  // With the list on this device, a miss is known to need the referee straight away.
  const toReferee = Boolean(G.index) && raw.length >= 2;
  el.feedback.textContent = toReferee ? `Not on our list. Asking the referee about “${raw}”…` : raw ? 'Checking…' : '';
  el.play.classList.toggle('is-checking', toReferee);
  const slow = toReferee ? null : setTimeout(() => {
    if (G.phase === 'checking' && G.prompt === prompt) el.play.classList.add('is-checking');
  }, 700);
  const res = await reply;
  clearTimeout(slow);
  if (token !== G.token || G.dive !== dive || G.prompt !== prompt) return; // they left meanwhile
  el.play.classList.remove('is-checking');
  settleRanked(raw, res, { final });
}

// Acts on the server's verdict on a ranked answer. `dropped` means the answer already sank because
// it's on this device's list.
function settleRanked(raw, res, { final = false, dropped = false } = {}) {
  const dive = G.dive;
  if (res?.result === 'hit') {
    G.prompt.gem = { blurb: res.blurb };
    lockIn(raw, { name: res.name, tier: res.tier, checked: res.checked }, { dropped });
    return;
  }
  if (res?.result === 'stale') {
    syncRanked(dive, res.run);
    advance();
    return;
  }
  if (final || res?.settled || res?.result === 'late') {
    missRound(raw || null);
    return;
  }
  // The question is still open on the server. After a drop, that means this device's list and the
  // server's disagreed (an old copy of the list, say), so it's back to the question.
  if (dropped) {
    showPrompt();
    el.answer.value = raw;
  }
  G.phase = 'prompt';
  G.lastSecond = null;
  if (!res) {
    el.feedback.textContent = 'Couldn’t reach the server. Try again.';
    el.feedback.classList.add('is-bad');
    return;
  }
  dive.deadline = Date.now() + Math.max(0, res.msLeft);
  saveDive(dive);
  if (res.result === 'busy') {
    el.feedback.textContent = `The referee is swamped, so “${raw}” can’t be checked. Try another.`;
    el.feedback.classList.add('is-bad');
    return;
  }
  noBites(raw, res.reason);
}

// Ranked rule: leaving the tab or app during a question voids it. It scores 0 and is flagged.
function leaveRanked() {
  if (!G.dive || !isRankedToday(G.dive) || G.phase !== 'prompt') return;
  ranked.voidRound(G.dive.day, G.rankedRound);
  missRound(el.answer.value.trim() || null, { voided: true });
}

// A guess the referee found too vague gets told why, so the player knows what would count.
const TOO_VAGUE = {
  name: 'Just a name on its own doesn’t count. Try their full name.',
  repeat: 'That just repeats the prompt. Try a real example.',
};

function noBites(raw, reason = null) {
  el.feedback.textContent = TOO_VAGUE[reason] || `No bites on “${raw}”. Try again.`;
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
  if (verdict && !verdict.rejected) {
    // The referee scores listed answers by the file, so this dive's hidden answer is settled here.
    const listed = findAnswer(verdict.name, G.index);
    lockIn(raw, { ...verdict, tier: listed ? listed.tier : Math.min(verdict.tier, 4), checked: true });
  } else if (final) {
    missRound(raw);
  } else {
    G.phase = 'prompt';
    G.lastSecond = null;
    noBites(raw, verdict?.reason);
  }
}

function timeUp() {
  stopListening();
  const typed = el.answer.value.trim();
  if (isRankedToday(G.dive)) {
    submitRanked(typed, { final: true });
    return;
  }
  const hit = typed ? findAnswer(typed, G.index) : null;
  if (hit) lockIn(typed, hit);
  else if (typed) checkWithReferee(typed, { final: true });
  else missRound(null);
}

function missRound(typed, { voided = false } = {}) {
  stopListening();
  const dive = G.dive;
  const round = { id: G.prompt.id, input: typed || null, name: null, tier: -1, pts: 0 };
  if (voided) round.voided = true;
  dive.rounds.push(round);
  dive.deadline = null;
  saveDive(dive);
  el.answer.blur();
  audio.miss();
  world.say('what was the question?');
  showReveal(round);
}

// `dropped`: the answer already sank (a ranked answer on the list), so go straight to the reveal.
function lockIn(raw, hit, { dropped = false } = {}) {
  const dive = G.dive;
  const round = { id: G.prompt.id, input: raw, name: hit.name, tier: hit.tier, pts: TIERS[hit.tier].pts };
  if (hit.checked) round.checked = true;
  dive.rounds.push(round);
  dive.deadline = null;
  saveDive(dive);
  el.answer.blur();
  if (dropped) {
    showReveal(round);
    return;
  }
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
  el.revealTier.textContent = round.voided ? 'Left the game' : missed ? 'Nothing caught' : tier.name;
  el.revealTier.style.color = missed ? 'var(--muted)' : tier.color;
  el.revealAnswer.textContent = round.voided ? 'Question voided' : missed ? 'Time ran out' : `“${round.name}”`;
  el.revealPts.textContent = missed ? '+0 pts · stayed put' : `+${round.pts} pts · sank ${fmtDepth(round.pts * METRES_PER_POINT)}`;
  el.revealLine.textContent = round.voided
    ? 'You switched away during a ranked question, so it scores 0.'
    : missed ? 'What was the question again?'
    : round.tier === 5 ? (G.prompt.gem?.blurb || pick(tier.lines))
      : round.checked ? 'Not on our list, but the referee says it counts.' : pick(tier.lines);
  el.btnNext.innerHTML = last ? 'Surface <span aria-hidden="true">▲</span>' : 'Keep sinking <span aria-hidden="true">▼</span>';
  el.btnNext.classList.remove('is-busy');
  el.btnNext.removeAttribute('aria-disabled');
  el.btnNext.style.minWidth = '';
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
  const mode = modeOf(dive);
  el.hudMode.textContent = mode.tag;
  el.hudMode.className = `hud-mode mode-${mode.key}`;
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
    if (el.diveLabel.textContent.startsWith('Next Daily')) el.diveLabel.textContent = `Next Daily in ${untilMidnight()}`;
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

// Score curve ----------------------------------------------------------------------------
// Where a score lands among a day's ranked scores: how many divers scored what, with the player's
// score marked and everything below it shaded. The server sends only scores, never names.
const CURVE_MIN = 5;
let curveCount = 0;
let fishURL = null;

// The sentence and an empty box that drawCurves fills in once it's on the page. `mine` is the
// player's score, `onBoard` says whether it's one of `scores`.
function curveHTML(scores, { mine = null, onBoard = false, day = G.today } = {}) {
  const n = scores.length;
  if (n < CURVE_MIN) {
    return `<p class="curve-note">The curve shows up once ${CURVE_MIN} ranked divers have finished${n ? ` (${n} so far)` : ''}.</p>`;
  }
  const today = day === G.today;
  const divers = (other = '') => (today ? `today’s ${other}ranked divers` : `the ${other}ranked divers on Dive #${day}`);
  const others = onBoard ? n - 1 : n;
  const pct = mine === null ? null : Math.round((100 * scores.filter((s) => s < mine).length) / others);
  const lead = mine === null ? `How ${today ? `today’s ${n} ranked divers` : `the ${n} ranked divers on Dive #${day}`} scored.`
    : onBoard ? `Better than <b>${pct}%</b> of ${divers('other ')}.`
    : `Your ${mine} would beat <b>${pct}%</b> of ${divers()}.`;
  return `<p class="curve-lead">${lead}</p><div class="chart curve" data-scores="${scores.join(',')}" data-mine="${mine ?? ''}"></div>`;
}

function drawCurves(root) {
  root.querySelectorAll('.curve[data-scores]').forEach(renderCurve);
}

function renderCurve(box) {
  const scores = box.dataset.scores.split(',').map(Number);
  const mine = box.dataset.mine === '' ? null : Number(box.dataset.mine);
  const n = scores.length;
  const width = Math.round(box.clientWidth || 320);
  const height = 150;
  const m = { l: 8, r: 8, t: 40, b: 22 }; // room above the curve for your fish and its label
  const xMax = Math.max(100, Math.ceil((Math.max(...scores, mine ?? 0) + 25) / 100) * 100);
  const x = (v) => Math.round(m.l + (v / xMax) * (width - m.l - m.r));
  const base = height - m.b;
  // A smoothed count of scores, stepped like the pixel art around it.
  const mean = scores.reduce((sum, s) => sum + s, 0) / n;
  const sd = Math.sqrt(scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n) || 30;
  const band = Math.max(15, 1.06 * sd * n ** -0.2);
  const STEPS = 56;
  const step = xMax / STEPS;
  const density = Array.from({ length: STEPS }, (_, i) => {
    const at = (i + 0.5) * step;
    return scores.reduce((sum, s) => sum + Math.exp(-0.5 * ((at - s) / band) ** 2), 0);
  });
  const peak = Math.max(...density);
  const top = (d) => Math.round(base - (d / peak) * (base - m.t));
  // The curve's top edge gets a bright cap, like the podium blocks.
  let edge = `M${x(0)},${top(density[0])}`;
  density.forEach((d, i) => { edge += `${i ? `V${top(d)}` : ''}H${x((i + 1) * step)}`; });
  const area = `M${x(0)},${base}V${top(density[0])}${edge.slice(edge.indexOf('H'))}V${base}Z`;
  const tick = xMax <= 400 ? 100 : 200;
  let axis = `<line x1="${m.l}" x2="${width - m.r}" y1="${base + 1}" y2="${base + 1}" stroke="#1a4a66" stroke-width="2"/>`;
  for (let v = 0; v <= xMax; v += tick) {
    axis += `<text x="${x(v)}" y="${height - 6}" text-anchor="${v === 0 ? 'start' : v === xMax ? 'end' : 'middle'}">${v}</text>`;
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const quart = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const id = `curve${(curveCount += 1)}`;
  // Orange fades deeper toward the floor; with your score marked, everything above it is the sea.
  const gradient = (name, from, to) => `<linearGradient id="${id}${name}" gradientUnits="userSpaceOnUse" x1="0" y1="${m.t}" x2="0" y2="${base}">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
  let defs = gradient('o', '#ffb54a', '#e9650f');
  let shapes;
  let marker = '';
  if (mine === null) {
    shapes = `<path d="${area}" fill="url(#${id}o)"/><path class="curve-edge" d="${edge}"/>`;
  } else {
    const mx = clamp(x(mine), m.l, width - m.r);
    const at = top(density[clamp(Math.floor(mine / step), 0, STEPS - 1)]);
    defs += gradient('b', '#4d8db3', '#1d4862');
    defs += `<clipPath id="${id}c"><rect x="0" y="0" width="${mx}" height="${height}"/></clipPath>`;
    shapes = `<path d="${area}" fill="url(#${id}b)"/><path class="curve-edge is-rest" d="${edge}"/>
      <g clip-path="url(#${id}c)"><path d="${area}" fill="url(#${id}o)"/><path class="curve-edge" d="${edge}"/></g>`;
    // Your goldfish rides the curve at your score, on the highest step under it so it never sinks
    // into a slope, with a dotted line down to the floor.
    fishURL ||= goldfish().toDataURL();
    const fishX = clamp(mx - 15, 0, width - 30);
    const under = density.filter((_, i) => x((i + 1) * step) > fishX && x(i * step) < fishX + 30).map(top);
    const fishY = Math.min(at, ...under) - 19;
    const text = `YOU · ${mine}`;
    const chipW = 16 + text.length * 7;
    const chipX = clamp(mx - chipW / 2, 0, width - chipW);
    marker = `<line class="curve-mark" x1="${mx}" x2="${mx}" y1="${fishY + 19}" y2="${base}"/>
      <image class="curve-fish" href="${fishURL}" x="${fishX}" y="${fishY}" width="30" height="18"/>
      <rect class="curve-chip" x="${chipX}" y="${fishY - 18}" width="${chipW}" height="15"/>
      <text class="curve-you" x="${chipX + chipW / 2}" y="${fishY - 7}" text-anchor="middle">${text}</text>`;
  }
  const label = `How ${n} ranked divers scored. Most scored between ${quart(0.25)} and ${quart(0.75)}.${mine === null ? '' : ` Your ${mine} is marked.`}`;
  box.innerHTML = `<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(label)}">
      <defs>${defs}</defs>${shapes}${axis}${marker}
    </svg><div class="chart-tip" hidden></div>`;
  // Hovering or tapping a spot says how many scored around there. The box sits above the curve,
  // so it never covers your fish.
  const tip = box.querySelector('.chart-tip');
  const svg = box.querySelector('svg');
  const BIN = 50;
  const show = (event) => {
    const rect = svg.getBoundingClientRect();
    const at = ((event.clientX - rect.left) * (width / rect.width) - m.l) / (width - m.l - m.r) * xMax;
    const lo = clamp(Math.floor(at / BIN) * BIN, 0, xMax - BIN);
    const hi = lo + BIN - 5;
    const count = scores.filter((s) => s >= lo && s <= hi).length;
    const you = mine !== null && mine >= lo && mine <= hi;
    tip.innerHTML = `${count} ${count === 1 ? 'diver' : 'divers'}<small>scored ${lo} to ${hi}${you ? ', like you' : ''}</small>`;
    tip.hidden = false;
    const tipW = tip.offsetWidth;
    tip.style.left = `${clamp(((x(lo + BIN / 2)) / width) * rect.width - tipW / 2, 0, rect.width - tipW)}px`;
    tip.style.top = `${-tip.offsetHeight - 6}px`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
}

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
    : dive.day === G.today ? '<p class="results-next">Next dive in <b id="nextDiveCountdown"></b></p>' : '';
  const showBoard = ranked.available && dive.mode === 'daily' && dive.day === G.today;
  const unrankedNote = ranked.player() ? 'Pick Ranked tomorrow to get on the board.'
    : '<button id="resNick" class="link-btn" type="button">Add your name</button> and choose Ranked tomorrow to get on the board.';
  const boardBlock = showBoard ? `<section class="block">
        <div class="block-title"><h3>Leaderboard</h3><span>Updates as others finish</span></div>
        ${dive.ranked ? '' : `<p class="board-note">You played today’s just for fun, so it’s not on the board. ${unrankedNote}</p>`}
        <div id="resBoard"></div>
      </section>` : '';
  // Where this score lands among the day's ranked scores, for any Daily, today's or from the Archive.
  const curveBlock = ranked.available && dive.mode === 'daily' && !PRETEND_DAY ? `<section class="block">
        <div class="block-title"><h3>Where you landed</h3><span>${dive.day === G.today ? 'Today’s' : `Dive #${dive.day}’s`} ranked scores</span></div>
        <div id="resCurve"><p class="curve-note">Loading the scores…</p></div>
      </section>` : '';
  const primary = isEndless
    ? '<button id="resNext" class="btn btn-quiet" type="button">Next endless dive</button>'
    : '<button id="resEndless" class="btn btn-quiet" type="button">Play Endless · practice</button>';
  // Only the player's own answers. Listing the rest would give away the hidden answers for
  // anyone who meets the prompt again.
  const rounds = dive.rounds.map((round) => {
    const prompt = content.byId.get(round.id);
    const tier = TIERS[round.tier];
    return `<div class="round">
        <span class="round-prompt">${esc(prompt?.text || round.id)}</span>
        <span class="round-answer">${esc(round.name || 'Nothing caught')}</span>
        <span class="round-tier" style="color:${round.tier >= 0 ? tier.color : 'var(--muted)'}">${round.tier >= 0 ? esc(tier.name) : round.voided ? 'Left the game' : 'Time ran out'}</span>
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
      ${dive.ranked && showBoard ? '<p id="resPlace" class="results-place">Checking the board…</p>' : ''}
      <div class="results-actions">
        <button id="resCopy" class="btn btn-primary" type="button">Copy result</button>
        ${primary}
        <button id="resHome" class="btn btn-quiet" type="button">${G.fromArchive ? 'Back to archive' : 'Back to the boat'}</button>
      </div>
      ${nextLine}
      ${curveBlock}
      ${boardBlock}
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
  $('resNick')?.addEventListener('click', () => openNickname());
  const curveBox = $('resCurve');
  let curveShown = '';
  const fillCurve = (data) => {
    if (!curveBox?.isConnected || !Array.isArray(data?.daily?.scores)) return;
    const html = curveHTML(data.daily.scores, { mine: total, onBoard: Boolean(data.daily.me), day: dive.day });
    if (html === curveShown) return;
    curveShown = html;
    curveBox.innerHTML = html;
    drawCurves(curveBox);
  };
  if (showBoard) {
    const place = $('resPlace');
    const load = mountBoard($('resBoard'), {
      onLoad: (data) => {
        fillCurve(data);
        if (!place) return;
        const me = data.daily.me;
        place.textContent = me ? `#${me.rank} of ${data.daily.players} today` : 'Your score is on its way to the board.';
      },
    });
    startBoardPolling(load);
  } else if (curveBox) {
    ranked.board(dive.day).then(fillCurve, (error) => {
      console.error(error);
      if (curveBox.isConnected) curveBox.innerHTML = '<p class="curve-note">Couldn’t load the scores. Check your connection.</p>';
    });
  }
  $('resEndless')?.addEventListener('click', () => { G.fromArchive = false; startEndless(); });
  el.results.scrollTop = 0;
  el.results.focus({ preventScroll: true });
}

// Leaderboard ----------------------------------------------------------------------------
// Today's Daily and this week's total. Names and scores only, never answers.
const boardState = { tab: 'daily', data: null, timer: null };

// The player's own score for a board's day: from the board when they played it ranked, or from
// this device when they played it just for fun.
function myBoardScore(data) {
  if (data.daily.me) return { mine: data.daily.me.score, onBoard: true, day: data.day };
  const dive = store.get(`daily.${data.day}`);
  return { mine: dive?.done && !dive.ranked ? scoreOf(dive) : null, onBoard: false, day: data.day };
}

function boardHTML(data, tab, { curve = false } = {}) {
  const list = data[tab];
  if (!list.players) {
    return `<p class="empty">${tab === 'daily' ? 'Nobody’s finished today’s ranked dive yet.' : 'No ranked dives this week yet.'}</p>`;
  }
  const me = list.me;
  const isMe = (row) => me && row.rank === me.rank && row.name === me.name;
  const row = (r) => `<li${isMe(r) ? ' class="is-me"' : ''}><span class="board-rank">${r.rank}</span><span class="board-name">${esc(r.name)}</span><span class="board-score">${r.score}</span></li>`;
  const rest = list.top.slice(3);
  const outside = me && !list.top.some(isMe);
  const count = `${list.players} ${list.players === 1 ? 'player' : 'players'}${tab === 'weekly' ? ' · Monday to Sunday' : ''}`;
  const others = rest.length || outside
    ? `<ol class="board" start="4">${rest.map(row).join('')}${outside ? `<li class="board-gap" aria-hidden="true">···</li>${row(me)}` : ''}</ol>`
    : '';
  const curvePart = curve && tab === 'daily' && Array.isArray(list.scores) ? curveHTML(list.scores, myBoardScore(data)) : '';
  return `${curvePart}${podiumHTML(list.top, isMe)}${others}<p class="board-count">${count}</p>`;
}

// The top three stand on a podium, first in the middle. Ties share a rank, so the block's
// colour and height follow the rank: two players tied for first both get gold.
const MEDALS = ['gold', 'silver', 'bronze'];
const PLACES = ['1st', '2nd', '3rd'];
let championURL = null;

function podiumHTML(top, isMe) {
  const spots = [0, 1, 2].map((i) => {
    const r = top[i];
    const rank = r ? r.rank : i + 1;
    const block = `<span class="podium-block" aria-hidden="true">${rank}</span>`;
    if (!r) return `<li class="podium-spot is-open medal-${MEDALS[rank - 1]}" aria-hidden="true">${block}</li>`;
    championURL ||= champion().toDataURL();
    const crown = rank === 1 ? `<img class="podium-champ" src="${championURL}" alt="">` : '';
    const you = isMe(r) ? '<span class="podium-you">You</span>' : '';
    return `<li class="podium-spot medal-${MEDALS[rank - 1]}${isMe(r) ? ' is-me' : ''}">
      <span class="sr-only">${PLACES[rank - 1]} place:</span>${crown}
      <span class="podium-name">${esc(r.name)}</span>${you}
      <span class="podium-score">${r.score}</span>${block}</li>`;
  });
  return `<ol class="podium">${spots.join('')}</ol>`;
}

// Draws the board into a box and returns a function that reloads it.
function mountBoard(box, { onLoad, curve = false } = {}) {
  boardState.data = null;
  box.innerHTML = `<div class="board-tabs" role="group" aria-label="Which board">
      <button type="button" data-tab="daily">Today</button><button type="button" data-tab="weekly">This week</button>
    </div><div class="board-body"><p class="empty">Loading the board…</p></div>`;
  const body = box.querySelector('.board-body');
  // The podium rises when the board first shows and on a tab switch, not when a refresh
  // brings the same board back.
  let shown = '';
  const paint = (rise = false) => {
    box.querySelectorAll('[data-tab]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tab === boardState.tab)));
    if (!boardState.data) return;
    const html = boardHTML(boardState.data, boardState.tab, { curve });
    if (html === shown && !rise) return;
    shown = html;
    body.innerHTML = html;
    drawCurves(body);
    if (rise) risePodium(body.querySelector('.podium'));
  };
  box.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    audio.click();
    boardState.tab = button.dataset.tab;
    paint(true);
  }));
  const load = async () => {
    if (!box.isConnected) return;
    try {
      const first = !boardState.data;
      boardState.data = await ranked.board();
      if (!box.isConnected) return;
      paint(first);
      onLoad?.(boardState.data);
    } catch (error) {
      console.error(error);
      if (!boardState.data) {
        body.innerHTML = error.name === 'Unreachable'
          ? '<p class="empty">Can’t reach the leaderboard from this network. Some school Wi-Fi blocks it.</p>'
          : '<p class="empty">Couldn’t load the board. Check your connection.</p>';
      }
    }
  };
  paint();
  load();
  return load;
}

// Safari on iPhone can leave first place one step short of the floor when the stepped rise
// ends, hiding a third of its block. Dropping the animation once it's over puts it back.
function risePodium(podium) {
  if (!podium) return;
  podium.classList.add('is-rising');
  const settle = () => podium.classList.remove('is-rising');
  podium.addEventListener('animationend', (event) => {
    if (event.animationName === 'podium-rise' && event.target === podium.firstElementChild) settle();
  });
  setTimeout(settle, 1500);
}

// The board keeps updating as other players finish.
function startBoardPolling(load) {
  stopBoardPolling();
  boardState.timer = setInterval(() => {
    if (!document.hidden) load();
  }, 30000);
}

function stopBoardPolling() {
  clearInterval(boardState.timer);
  boardState.timer = null;
}

function openBoard() {
  const me = ranked.player();
  const request = G.rankedStatus?.request;
  const note = ON_PHONE ? '<p class="board-note">The Daily and ranked are on computers only. On a phone, play Endless.</p>'
    : me ? `<p class="board-note">Playing as <b>${esc(me.name)}</b>. ${request?.state === 'waiting'
      ? `You asked for <b>${esc(request.name)}</b>, waiting on approval. <button id="sheetRequest" class="link-btn" type="button">Change</button>`
      : '<button id="sheetRequest" class="link-btn" type="button">Request a new name</button>'}</p>`
    : '<p class="board-note"><button id="sheetNick" class="link-btn" type="button">Add your name</button> to get on the board.</p>';
  openSheet('Leaderboard', `${note}
    <div id="sheetBoard"></div>`);
  $('sheetNick')?.addEventListener('click', () => openNickname());
  $('sheetRequest')?.addEventListener('click', () => { audio.click(); openNameRequest(); });
  const load = mountBoard($('sheetBoard'), { curve: true });
  startBoardPolling(() => {
    if (el.sheet.open && $('sheetBoard')) load();
    else if (document.body.dataset.screen !== 'results') stopBoardPolling();
  });
}

const NICK_ERRORS = {
  invalid: 'Use 3 to 16 letters or numbers, no spaces.',
  blocked: 'Pick a different name.',
  taken: 'Someone already has that one. Add a letter or number.',
  anon: 'Names starting with “anon” are for anonymous players. Tap Go anonymous instead.',
  forced: 'Put in your name, or go anonymous, to keep playing ranked.',
  'not-offered': 'Your name doesn’t need to change.',
  same: 'That’s already your name.',
  'anon-request': 'Names starting with “anon” are kept for anonymous players. Pick a different name.',
  'can-rename': 'You can change your name yourself right now. Reopen the game to do it.',
  unreachable: BLOCKED_NETWORK,
};

// The board uses real names (from Nov 20, 2026): a first name, or a version of it people know.
// The admin changes anything else to an anonymous name (node admin.mjs anon).
const nickFormHTML = (submitLabel, label = 'Your name') => `<form id="nickForm" class="nick-form" novalidate>
      <label class="label" for="nickInput">${label}</label>
      <div class="nick-row">
        <input id="nickInput" type="text" maxlength="16" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="Your first name" enterkeyhint="go" data-1p-ignore data-lpignore="true">
        <button class="btn btn-primary" type="submit">${submitLabel}</button>
      </div>
      <p id="nickError" class="nick-error" role="alert"></p>
      <p class="nick-hint">First name is plenty, or a version people know, like SamR or Sammy7. Anything that isn’t your name gets changed to an anonymous one.</p>
    </form>`;

// Anonymous players show on the board as "anonymous" and a few numbers, like anonymous482.
const anonButtonHTML = (label) => `<button id="nickAnon" class="btn btn-quiet nick-alt" type="button">${label}</button>`;

// Saves the name from the form in the open sheet, or goes anonymous from its Go anonymous button,
// then runs `done` with the server's reply. `save` makes a new player by default, or renames this one.
function wireNickForm(done, save = ranked.join) {
  const form = $('nickForm');
  if (!form) return;
  const input = $('nickInput');
  const error = $('nickError');
  const buttons = [form.querySelector('button[type="submit"]'), $('nickAnon')].filter(Boolean);
  const attempt = async (name, options) => {
    buttons.forEach((button) => { button.disabled = true; });
    error.textContent = 'Saving…';
    let result = null;
    try {
      result = await save(name, options);
    } catch (problem) {
      console.error(problem);
      if (problem.name === 'Unreachable') result = { error: 'unreachable' };
    }
    buttons.forEach((button) => { button.disabled = false; });
    if (!result || result.error) {
      error.textContent = NICK_ERRORS[result?.error] || 'Couldn’t reach the server. Try again.';
      if (name) input.select();
      return;
    }
    done(result);
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!/^[A-Za-z0-9]{3,16}$/.test(name)) {
      error.textContent = NICK_ERRORS.invalid;
      return;
    }
    attempt(name);
  });
  $('nickAnon')?.addEventListener('click', () => {
    audio.click();
    attempt(null, { anonymous: true });
  });
}

const PAUSED = 'Ranked is paused for this name for now. You can still play today’s Daily just for fun.';

// What the server says about this device's name: banned, paused, asked to pick a new one, or not
// yet through the name question (real name or anonymous). Checked when the game opens and before
// each Daily. Also brings over a new name the admin gave it, like an anonymous one.
async function checkRanked() {
  if (!ranked.available || PRETEND_DAY || !ranked.player()) return null;
  try {
    const status = await ranked.status();
    if (!status || status.error) return null;
    if (status.banned) {
      G.rankedStatus = { banned: true, appeal: status.appeal || null };
      return G.rankedStatus;
    }
    const before = ranked.player()?.name;
    ranked.syncName(status.name);
    if (before && status.name && before !== status.name) notice(`Your name on the leaderboard is ${status.name} now.`);
    G.rankedStatus = { paused: Boolean(status.paused), rename: status.rename || null, nameCheck: Boolean(status.nameCheck), request: status.request || null };
    // A name request the admin turned down is said once. An approved one shows up as the new name above.
    const request = status.request;
    if (request?.state === 'no' && store.get('ranked.requestSaid') !== request.name) {
      store.set('ranked.requestSaid', request.name);
      notice(`Your request for ${request.name} wasn’t approved. You can ask for a different name from the leaderboard.`);
    }
    // A lifted ban is said once.
    if (status.appeal?.state === 'yes' && store.get('ranked.appealSaid') !== status.appeal.at) {
      store.set('ranked.appealSaid', status.appeal.at);
      notice('Your appeal went through. You’re back on the leaderboard.');
    }
    return G.rankedStatus;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Asks for this player's name on the board: the name question (real name or anonymous, asked every
// time the game opens until it's answered), or a change the admin offered (offer-rename, asked once
// a day) or requires (force-rename). The scores stay either way.
function openRename({ then } = {}) {
  const me = ranked.player();
  const status = G.rankedStatus || {};
  if (!me || !(status.rename || status.nameCheck)) return;
  const forced = status.rename === 'forced';
  const asking = Boolean(status.nameCheck) && !forced;
  if (status.rename === 'offer' && !asking) store.set('ranked.renameAsked', G.today);
  const name = esc(me.name);
  const [title, lead] = forced
    ? ['Pick a new name', `“${name}” can’t stay on the leaderboard. Put in your name, or go anonymous. Your scores stay.`]
    : asking
      ? ['Your name on the board', 'The leaderboard is switching to real names. Put in your name, or go anonymous and show up as “anonymous” and a few numbers. Your scores stay either way.']
      : ['New name?', `You can change “${name}” once. Put in your name, or go anonymous. Your scores stay.`];
  openSheet(title, `
    <p class="nick-lead">${lead}</p>
    ${nickFormHTML('Save')}
    ${forced ? '' : `<button id="keepName" class="btn btn-quiet nick-alt" type="button">${asking ? `Keep ${name}, it’s my name` : `Keep ${name}`}</button>`}
    ${anonButtonHTML('Go anonymous')}`);
  $('nickInput').focus();
  const finish = () => {
    G.rankedStatus.rename = null;
    G.rankedStatus.nameCheck = false;
    closeSheet();
    if (G.phase === 'title') refreshTitle();
  };
  wireNickForm((result) => {
    finish();
    notice(`You’re ${result.name} on the leaderboard now.`);
    then?.();
  }, ranked.rename);
  // Keeping it has to reach the server when it answers the name question, or ranked stays locked.
  $('keepName')?.addEventListener('click', async (event) => {
    audio.click();
    const button = event.currentTarget;
    const error = $('nickError');
    button.disabled = true;
    error.textContent = 'Saving…';
    let result = null;
    try {
      result = await ranked.keepName();
    } catch (problem) {
      console.error(problem);
      if (problem.name === 'Unreachable') result = { error: 'unreachable' };
    }
    button.disabled = false;
    if (!result || (result.error && result.error !== 'not-offered')) {
      error.textContent = NICK_ERRORS[result?.error] || 'Couldn’t reach the server. Try again.';
      return;
    }
    finish();
    if (asking) notice(`Got it. You’re staying ${me.name}.`);
    then?.();
  });
}

// A different name on the board, for a player who already has one, from the leaderboard. It changes
// once the admin approves it; until then they keep playing as they are. Players who can change it
// themselves right now (the name question, or an offered or forced change) get that sheet instead.
function openNameRequest() {
  const me = ranked.player();
  if (!me) return;
  const status = G.rankedStatus || {};
  if (status.rename || status.nameCheck) {
    openRename({ then: () => openBoard() });
    return;
  }
  const request = status.request;
  const waiting = request?.state === 'waiting';
  const lead = waiting ? `You asked for <b>${esc(request.name)}</b>. It changes once it’s approved. Put in a different name to change your request.`
    : request?.state === 'no' ? `<b>${esc(request.name)}</b> wasn’t approved. You can ask for a different name.`
    : 'Put in the name you want on the board. It changes once it’s approved, and your scores stay.';
  openSheet('Request a new name', `
    <p class="nick-lead">${lead}</p>
    ${nickFormHTML('Send', 'Name you want')}
    ${waiting ? '<button id="cancelRequest" class="btn btn-quiet nick-alt" type="button">Cancel my request</button>' : ''}`);
  $('nickInput').focus();
  const save = (result) => {
    G.rankedStatus = { ...(G.rankedStatus || {}), request: result.request };
    openBoard();
  };
  wireNickForm((result) => {
    save(result);
    notice(`Request sent. You’ll be ${result.request.name} once it’s approved.`);
  }, async (name) => {
    // This sheet has no Go anonymous button, so the usual "anon" message would point at nothing.
    const result = await ranked.requestName(name);
    return result?.error === 'anon' ? { error: 'anon-request' } : result;
  });
  $('cancelRequest')?.addEventListener('click', async (event) => {
    audio.click();
    const button = event.currentTarget;
    const error = $('nickError');
    button.disabled = true;
    error.textContent = 'Saving…';
    let result = null;
    try {
      result = await ranked.cancelRequest();
    } catch (problem) {
      console.error(problem);
      if (problem.name === 'Unreachable') result = { error: 'unreachable' };
    }
    button.disabled = false;
    if (!result || result.error) {
      error.textContent = NICK_ERRORS[result?.error] || 'Couldn’t reach the server. Try again.';
      return;
    }
    save(result);
    notice(`Request cancelled. You’re staying ${me.name}.`);
  });
}

const RANKED_RULES = '<p class="choice-rules">One try · No photos · Leaving the app mid-question scores 0</p>';

// Before each Daily: ranked, on the leaderboard, or just for fun with photos.
function openDailyChoice(problem = '') {
  const me = ranked.player();
  const banned = Boolean(me && G.rankedStatus?.banned);
  const paused = Boolean(me && !banned && G.rankedStatus?.paused);
  const forced = G.rankedStatus?.rename === 'forced';
  const mustRename = Boolean(me && !banned && !paused && (forced || G.rankedStatus?.nameCheck));
  const rankedPart = banned ? `<p class="choice-off" role="status">“${esc(me.name)}” is banned from ranked. You can still play today’s Daily just for fun.</p>
      <button id="choiceAppeal" class="btn btn-quiet choice-btn" type="button">${G.rankedStatus.appeal?.state === 'waiting' ? 'See your appeal' : 'Appeal the ban'}</button>`
    : paused ? `<p class="choice-off" role="status">${PAUSED}</p>`
    : mustRename ? `<p class="choice-off">${forced ? `“${esc(me.name)}” can’t stay on the leaderboard.`
      : 'The leaderboard uses real names now. Put in yours, or go anonymous, to play ranked.'}</p>
      <button id="choiceRename" class="btn btn-primary choice-btn" type="button">${forced ? 'Pick a new name' : 'Choose my name'}</button>`
    : me ? `<button id="choiceRanked" class="btn btn-primary choice-btn" type="button">Play ranked as ${esc(me.name)}</button>`
    : nickFormHTML('Play ranked', 'Your name for the board') + anonButtonHTML('Play ranked anonymously');
  openSheet('Today’s Daily', `
    <p class="choice-lead">Dive #${G.today}. How do you want to play it?</p>
    <section class="choice choice-ranked${paused || banned ? ' is-off' : ''}" aria-labelledby="choiceRankedTitle">
      <h3 id="choiceRankedTitle" class="choice-title"><span aria-hidden="true">★</span> Ranked</h3>
      <p class="choice-what">Your score goes on today’s leaderboard.</p>
      ${RANKED_RULES}
      ${rankedPart}
    </section>
    <section class="choice choice-normal" aria-labelledby="choiceNormalTitle">
      <h3 id="choiceNormalTitle" class="choice-title">Just for fun</h3>
      <p class="choice-what">Not on the leaderboard. Photos stay on.</p>
      <button id="choiceNormal" class="btn btn-quiet choice-btn" type="button">Play normally</button>
    </section>
    <p class="choice-note">Once you start, today’s pick stays. Endless and the Archive never count.</p>`);
  const choose = (choice) => {
    const dive = getDaily(G.today);
    if (!isFresh(dive)) return;
    dive.choice = choice;
    dive.ranked = choice === 'ranked';
    saveDive(dive);
    closeSheet();
    refreshTitle();
    startDaily();
  };
  $('choiceRanked')?.addEventListener('click', () => choose('ranked'));
  $('choiceNormal').addEventListener('click', () => choose('normal'));
  $('choiceRename')?.addEventListener('click', () => { audio.click(); openRename({ then: () => openDailyChoice() }); });
  $('choiceAppeal')?.addEventListener('click', () => { audio.click(); openBan(); });
  wireNickForm(() => choose('ranked'));
  if (problem && $('nickError')) $('nickError').textContent = problem;
  const section = el.sheet.querySelector('.choice-ranked');
  // The name may have been paused or asked to change since the game opened.
  if (me) {
    checkRanked().then((status) => {
      if (!status || !section.isConnected) return;
      const nowBanned = Boolean(status.banned);
      const nowPaused = !nowBanned && Boolean(status.paused);
      const nowRename = !nowBanned && !nowPaused && Boolean(status.rename === 'forced' || status.nameCheck);
      if (nowBanned !== banned || nowPaused !== paused || nowRename !== mustRename) openDailyChoice(problem);
    });
  }
  findServer().then((base) => {
    if (base || !section.isConnected) return;
    section.classList.add('is-off');
    const note = document.createElement('p');
    note.className = 'choice-off';
    note.setAttribute('role', 'status');
    note.textContent = BLOCKED_NETWORK;
    section.querySelector('#nickForm, #choiceRanked')?.replaceWith(note);
    section.querySelector('#nickAnon')?.remove();
  });
}

// Banned ---------------------------------------------------------------------------------
// A banned name is off the boards and can't play ranked, but keeps playing just for fun. The game
// says so when it opens (once a day, and again when an appeal is turned down), from the line under
// the big button, and from the Daily's choice, each time with a way to appeal. The admin answers
// on the dashboard, and the answer shows up here.
const BANNED_LINE = '<span class="ranked-off">Banned from ranked</span> · Appeal';
const APPEAL_MAX = 600;
const sentOn = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function openBan() {
  const me = ranked.player();
  const appeal = G.rankedStatus?.appeal;
  const waiting = appeal?.state === 'waiting';
  openSheet('Banned from ranked', `<div class="fb-form">
      <p class="nick-lead">“${esc(me?.name || '')}” is banned from ranked. It’s off the leaderboard and can’t play ranked Dailies. You can still play just for fun.</p>
      ${waiting ? `<p class="choice-off" role="status">Your appeal was sent ${esc(sentOn(appeal.at))}. The answer will show up here.</p>`
        : `${appeal?.state === 'no' ? '<p class="choice-off" role="status">Your appeal was turned down. You can send another.</p>' : ''}
          <p class="nick-lead">Think it’s a mistake? Send an appeal and it’ll be looked at.</p>
          <button id="banAppeal" class="btn btn-primary fb-send" type="button">Appeal</button>`}
      <button id="banDone" class="btn btn-quiet fb-send" type="button">${waiting ? 'OK' : 'Not now'}</button>
    </div>`);
  $('banAppeal')?.addEventListener('click', () => { audio.click(); openAppeal(); });
  $('banDone').addEventListener('click', () => { audio.click(); closeSheet(); });
}

function openAppeal() {
  openSheet('Appeal the ban', `<form id="appealForm" class="fb-form" novalidate>
      <p class="nick-lead">Why should the ban be lifted? Only the admin sees this.</p>
      <textarea id="appealText" maxlength="${APPEAL_MAX}" rows="5" aria-label="Your appeal" placeholder="Your appeal"></textarea>
      <p id="appealCount" class="fb-count" aria-hidden="true">0 / ${APPEAL_MAX}</p>
      <button class="btn btn-primary fb-send" type="submit">Send appeal</button>
      <p id="appealError" class="nick-error" role="alert"></p>
    </form>`);
  const form = $('appealForm');
  const text = $('appealText');
  const error = $('appealError');
  const submit = form.querySelector('button[type="submit"]');
  text.addEventListener('input', () => { $('appealCount').textContent = `${text.value.length} / ${APPEAL_MAX}`; });
  text.focus();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = text.value.trim();
    if (note.length < 2) {
      error.textContent = 'Write something first.';
      return;
    }
    submit.disabled = true;
    error.textContent = 'Sending…';
    let reply;
    try {
      reply = await ranked.appeal(note);
    } catch (problem) {
      console.error(problem);
      reply = { error: problem.name === 'Unreachable' ? 'unreachable' : 'failed' };
    }
    if (reply.appeal) {
      G.rankedStatus = { ...(G.rankedStatus || {}), banned: true, appeal: reply.appeal };
      audio.click();
      el.sheetBody.innerHTML = `<p class="nick-lead">Appeal sent. The answer will show up here when it’s been looked at.</p>
        <button id="appealDone" class="btn btn-primary fb-send" type="button">Done</button>`;
      $('appealDone').addEventListener('click', closeSheet);
      if (G.phase === 'title') refreshTitle();
      return;
    }
    if (reply.error === 'waiting') {
      G.rankedStatus = { ...(G.rankedStatus || {}), appeal: reply.appeal };
      openBan();
      return;
    }
    if (reply.error === 'not-banned') {
      G.rankedStatus = { ...(G.rankedStatus || {}), banned: false };
      closeSheet();
      notice('You’re not banned anymore. You can play ranked again.');
      if (G.phase === 'title') refreshTitle();
      return;
    }
    submit.disabled = false;
    error.textContent = reply.error === 'unreachable' ? 'Can’t reach the server from this network. Try again later.' : 'Couldn’t send it. Try again.';
  });
}

// The ban is said when the game opens, once a day, unless an appeal is waiting. A turned-down appeal
// is said the next time the game opens. Says whether it opened.
function sayBan(status) {
  const appeal = status.appeal;
  const turnedDown = appeal?.state === 'no' && store.get('ranked.appealSaid') !== appeal.at;
  if (!turnedDown && (appeal?.state === 'waiting' || store.get('ranked.banSaid') === G.today)) return false;
  store.set('ranked.banSaid', G.today);
  if (turnedDown) store.set('ranked.appealSaid', appeal.at);
  openBan();
  return true;
}

// For getting on the board outside the Daily: from the title, the board or results.
function openNickname() {
  openSheet('Get on the board', `
    <p class="nick-lead">Put in your name, then choose Ranked when you start a Daily. Everyone gets the same seven prompts, and the board fills up as people finish.</p>
    ${nickFormHTML('Save')}
    ${anonButtonHTML('Go anonymous')}
    <ul class="how-steps nick-rules">
      <li>The board shows names and scores, never answers.</li>
      <li>Your spot on the board lives in this browser. Clearing its data loses it.</li>
    </ul>`);
  $('nickInput').focus();
  wireNickForm(() => {
    closeSheet();
    if (G.phase === 'title') refreshTitle();
  });
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
  if (ON_PHONE) {
    startEndless(); // the big button on a phone, and anything else that asks for the Daily there
    return;
  }
  audio.unlock();
  audio.click();
  const dive = getDaily(G.today);
  // Before each Daily the player picks: ranked, on the leaderboard, or just for fun with photos.
  // The pick sticks for the day, since the prompts have been seen once the dive starts.
  if (ranked.available && !PRETEND_DAY && isFresh(dive) && !dive.choice) {
    openDailyChoice();
    return;
  }
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
  if (dive.ranked && !dive.done) dive.ranked = false;
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
      <li>One Daily a day. Endless is there for practice, and it never counts.</li>
      ${ON_PHONE ? '<li>The Daily is on computers only. On a phone or tablet, play Endless.</li>' : ''}
      ${ranked.available ? '<li>Before each Daily, pick Ranked to put your score on the leaderboard, or Just for fun. Ranked is one try, scored by the server, with no photos, and switching away during a question makes it score 0.</li>' : ''}
      <li>Not on our list? An AI referee checks it, so real deep cuts still count.</li>
      <li>Tap the mic to say your answer instead of typing it.</li>
      <li>Daily answers are counted anonymously to rank how rare each one is, and answers the referee checks are saved anonymously too. Ranked scores are tied to your name on the board, but your answers never show there.</li>
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
  const big = Boolean(latest.big);
  chip.classList.toggle('is-big', big);
  chip.innerHTML = big
    ? `<span class="news-star" aria-hidden="true">★</span><span class="news-what">${esc(latest.short)}</span><span class="news-when">${unseen ? 'New' : esc(when)}</span>`
    : `${unseen ? '<i class="news-dot" aria-hidden="true"></i>' : ''}<span class="news-when">New · ${esc(when)}</span><span class="news-what">${esc(latest.short)}</span>`;
  chip.setAttribute('aria-label', `What’s new: ${latest.title}, ${newsDate(latest)}`);
  chip.hidden = false;
}

const markNewsSeen = () => {
  if (CHANGELOG[0]) store.set('news.seen', newsId(CHANGELOG[0]));
  refreshNews();
};

function openNews() {
  const entries = CHANGELOG.map((entry, i) => `<li class="news-entry${entry.big ? ' is-big' : ''}">
      <p class="label news-stamp">${esc(newsDate(entry))} · ${esc(entry.time)} MT${i === 0 ? ' <span class="news-latest">Latest</span>' : ''}</p>
      <h3 class="news-title">${entry.big ? '<span aria-hidden="true">★</span> ' : ''}${esc(entry.title)}</h3>
      ${entry.lead ? `<p class="news-lead">${esc(entry.lead)}</p>` : ''}
      <ul class="news-items">${entry.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
    </li>`).join('');
  openSheet('What’s new', `<ol class="news-list">${entries}</ol>`);
  markNewsSeen();
}

// A big update pops up once, the first time the game opens after it ships.
function announce() {
  const latest = CHANGELOG[0];
  if (!latest?.big || store.get('news.seen') === newsId(latest)) return;
  const today = store.get(`daily.${G.today}`);
  const go = ON_PHONE ? 'Play Endless <span aria-hidden="true">▼</span>'
    : today?.done ? 'See the leaderboard' : 'Play today’s Daily <span aria-hidden="true">▼</span>';
  openSheet(latest.title, `<div class="announce">
      <p class="label announce-stamp">New · ${esc(newsDate(latest))}</p>
      <p class="announce-lead">${esc(latest.lead || '')}</p>
      <ul class="news-items">${latest.items.slice(0, 3).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      <button id="announceGo" class="btn btn-primary btn-big announce-go" type="button">${go}</button>
      <button id="announceLater" class="btn btn-quiet announce-later" type="button">Maybe later</button>
    </div>`);
  el.sheet.classList.add('is-announce');
  el.sheet.addEventListener('close', () => el.sheet.classList.remove('is-announce'), { once: true });
  markNewsSeen();
  $('announceGo').addEventListener('click', () => {
    closeSheet();
    if (ON_PHONE) startEndless();
    else if (today?.done) openBoard();
    else startDaily();
  });
  $('announceLater').addEventListener('click', () => { audio.click(); closeSheet(); });
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
    ON_PHONE ? null : ['Today’s Daily', 'menuDaily'],
    ['Endless · practice', 'menuEndless'],
    ranked.available ? ['Leaderboard', 'menuBoard'] : null,
    ranked.available && pollOpen() ? [POLL.title, 'menuPoll'] : null,
    ['Archive', 'menuArchive'],
    ['My stats', 'menuStats'],
    ['How to play', 'menuHow'],
    ['What’s new', 'menuNews'],
    ranked.available ? ['Send feedback', 'menuFeedback'] : null,
  ].filter(Boolean);
  const note = G.phase !== 'prompt' ? ''
    : isRankedToday(G.dive) ? '<p class="results-next">The ranked clock keeps running while this is open.</p>'
      : '<p class="results-next">Your dive is saved, but the clock keeps running.</p>';
  openSheet('Menu', `<ul class="sheet-list">${items.map(([label, id]) => `<li><button type="button" id="${id}"><span>${esc(label)}</span></button></li>`).join('')}</ul>${note}`);
  $('menuHome')?.addEventListener('click', () => { closeSheet(); goHome(); });
  $('menuDaily')?.addEventListener('click', () => {
    closeSheet();
    if (G.dive && G.dive.mode === 'daily' && G.dive.day === G.today) return;
    startDaily();
  });
  $('menuEndless').addEventListener('click', () => {
    if (G.dive?.mode === 'endless') { closeSheet(); return; }
    startEndless();
  });
  $('menuArchive').addEventListener('click', openArchive);
  $('menuBoard')?.addEventListener('click', () => openBoard());
  $('menuStats').addEventListener('click', openStats);
  $('menuHow').addEventListener('click', openHow);
  $('menuNews').addEventListener('click', openNews);
  $('menuFeedback')?.addEventListener('click', openFeedback);
  $('menuPoll')?.addEventListener('click', () => openPoll());
}

// Poll -----------------------------------------------------------------------------------
// The question lives in js/poll.js. It pops up once on the title screen, and stays in the menu
// until it closes. Players see the results once they've voted, and can change their vote.
const pollMemoryKey = () => `poll.${POLL.id}`;

// Players without a name on the board vote once per browser, under a random id kept here.
function pollBrowser() {
  let id = store.get('poll.browser');
  if (!/^[a-z0-9]{16,40}$/.test(id || '')) {
    id = [...crypto.getRandomValues(new Uint8Array(12))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    store.set('poll.browser', id);
  }
  return id;
}

async function pollRequest(choice) {
  const me = ranked.player();
  const res = await post('/poll', {
    poll: POLL.id,
    ...(choice ? { choice } : {}),
    ...(me ? { key: me.key } : {}),
    browser: pollBrowser(),
    device: ON_PHONE ? 'phone' : 'computer',
  }, { timeout: 12000 });
  if (!res.ok) throw Object.assign(new Error(`poll: ${res.status}`), { status: res.status });
  return res.json();
}

// The message in js/note.js, once per browser. Says whether it opened.
function showNote() {
  if (!NOTE || store.get(`note.${NOTE.id}`)) return false;
  store.set(`note.${NOTE.id}`, true);
  openSheet(NOTE.title, `<div class="note">
      ${NOTE.paragraphs.map((text) => `<p class="note-text">${esc(text)}</p>`).join('')}
      ${ranked.available ? '<button id="noteFeedback" class="btn btn-primary btn-big announce-go" type="button">Send feedback</button>' : ''}
      <button id="noteDone" class="btn btn-quiet announce-later" type="button">Got it</button>
    </div>`);
  $('noteFeedback')?.addEventListener('click', () => {
    audio.click();
    closeSheet();
    openFeedback();
  });
  $('noteDone').addEventListener('click', () => { audio.click(); closeSheet(); });
  return true;
}

function askPoll() {
  if (!ranked.available || !pollOpen()) return;
  const memory = store.get(pollMemoryKey(), {});
  if (memory.vote || memory.asked) return;
  store.set(pollMemoryKey(), { ...memory, asked: true });
  openPoll({ popup: true });
}

function openPoll({ popup = false } = {}) {
  const me = ranked.player();
  const memory = store.get(pollMemoryKey(), {});
  openSheet(POLL.title, `<div class="poll">
      <p class="nick-lead">${esc(POLL.question)}</p>
      <div class="poll-options" role="group" aria-label="${esc(POLL.title)}">
        ${POLL.options.map((option) => `<button class="poll-option" type="button" data-choice="${esc(option.id)}" aria-pressed="false">
          <span class="poll-fill" aria-hidden="true"></span>
          <span class="poll-text"><b>${esc(option.label)}</b><small>${esc(option.sub)}</small><small class="poll-yours" hidden>Your vote</small></span>
          <span class="poll-pct"></span>
        </button>`).join('')}
      </div>
      <p id="pollStatus" class="poll-status" role="status"></p>
      <p class="fb-note">${me ? `One vote per player, so this counts for ${esc(me.name)}.` : 'One vote per device.'} You can change it until ${esc(POLL.closesSaid)}.</p>
      ${popup ? '<button id="pollLater" class="btn btn-quiet announce-later" type="button">Not now</button>' : ''}
    </div>`);
  const box = el.sheetBody.querySelector('.poll');
  const buttons = [...box.querySelectorAll('.poll-option')];
  const status = $('pollStatus');
  let busy = false;
  let mine = null;

  const paint = (result) => {
    mine = result.mine;
    const total = POLL.options.reduce((sum, option) => sum + (result.counts[option.id] || 0), 0);
    for (const button of buttons) {
      const n = result.counts[button.dataset.choice] || 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      const picked = mine === button.dataset.choice;
      button.classList.add('is-counted');
      button.classList.toggle('is-mine', picked);
      button.setAttribute('aria-pressed', String(picked));
      button.style.setProperty('--pct', `${pct}%`);
      button.querySelector('.poll-pct').textContent = `${pct}%`;
      button.querySelector('.poll-yours').hidden = !picked;
    }
    store.set(pollMemoryKey(), { ...store.get(pollMemoryKey(), {}), vote: mine });
    const later = $('pollLater');
    if (later && mine) later.textContent = 'Done';
  };
  const totalSaid = (result) => {
    const total = Object.values(result.counts).reduce((sum, n) => sum + n, 0);
    return `${total} ${total === 1 ? 'vote' : 'votes'} so far.`;
  };
  const problem = (error) => (error.status === 409 ? 'The poll has closed.'
    : error.status === 429 ? 'The poll is full.'
      : error.name === 'Unreachable' ? 'Can’t reach the server from this network. Try again later.'
        : 'Couldn’t send your vote. Try again.');

  // Someone who already voted (here, or with this name somewhere else) sees the results.
  if (memory.vote || me) {
    if (memory.vote) status.textContent = 'Loading the results…';
    pollRequest().then((result) => {
      if (!box.isConnected || busy || !result.mine) {
        if (box.isConnected && !busy && memory.vote) status.textContent = '';
        return;
      }
      paint(result);
      status.textContent = `${totalSaid(result)} Tap the other one to change your vote.`;
    }).catch((error) => {
      console.error(error);
      if (box.isConnected && !busy && memory.vote) status.textContent = problem(error);
    });
  }

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      const choice = button.dataset.choice;
      if (busy || choice === mine) return;
      busy = true;
      buttons.forEach((b) => { b.disabled = true; });
      status.textContent = 'Sending…';
      try {
        const result = await pollRequest(choice);
        if (!box.isConnected) return;
        audio.click();
        const changed = Boolean(mine);
        paint(result);
        status.textContent = `${changed ? 'Vote changed.' : 'Thanks for voting!'} ${totalSaid(result)}`;
      } catch (error) {
        console.error(error);
        if (box.isConnected) status.textContent = problem(error);
      } finally {
        busy = false;
        buttons.forEach((b) => { b.disabled = false; });
      }
    });
  }
  $('pollLater')?.addEventListener('click', () => { audio.click(); closeSheet(); });
}

// Feedback -------------------------------------------------------------------------------
// A note to whoever runs the game, read with `node admin.mjs feedback` in worker/. It says where
// in the game it was sent from, and carries the name only when the player ticks the box.
const FEEDBACK_MAX = 600;
const FEEDBACK_WAIT_MS = 30000; // between notes from one device

function feedbackPlace() {
  const screen = document.body.dataset.screen;
  const dive = G.dive;
  const which = !dive ? '' : dive.mode === 'daily' ? `Dive #${dive.day}` : 'Endless';
  if ((screen === 'play' || screen === 'reveal') && G.prompt) return `${which}: ${G.prompt.text}`;
  return [screen, which].filter(Boolean).join(', ');
}

function openFeedback() {
  const me = ranked.player();
  const place = feedbackPlace();
  const onPrompt = /: /.test(place);
  openSheet('Send feedback', `<form id="fbForm" class="fb-form" novalidate>
      <p class="nick-lead">Found a bug, or an answer that should’ve counted? Got an idea? Write it here.</p>
      <textarea id="fbText" maxlength="${FEEDBACK_MAX}" rows="5" aria-label="Your feedback" placeholder="Your feedback"></textarea>
      <p id="fbCount" class="fb-count" aria-hidden="true">0 / ${FEEDBACK_MAX}</p>
      ${onPrompt ? `<p class="fb-note">The prompt you’re on gets sent with it: “${esc(G.prompt.text)}”</p>` : ''}
      ${me ? `<label class="fb-sign"><input id="fbSign" type="checkbox"> Add my name, ${esc(me.name)}</label>` : ''}
      <button class="btn btn-primary fb-send" type="submit">Send</button>
      <p id="fbError" class="nick-error" role="alert"></p>
    </form>`);
  const form = $('fbForm');
  const text = $('fbText');
  const error = $('fbError');
  const submit = form.querySelector('button[type="submit"]');
  text.addEventListener('input', () => { $('fbCount').textContent = `${text.value.length} / ${FEEDBACK_MAX}`; });
  text.focus();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = text.value.trim();
    if (note.length < 2) {
      error.textContent = 'Write something first.';
      return;
    }
    const wait = FEEDBACK_WAIT_MS - (Date.now() - store.get('feedback.sent', 0));
    if (wait > 0) {
      error.textContent = `You just sent one. Try again in ${Math.ceil(wait / 1000)} seconds.`;
      return;
    }
    submit.disabled = true;
    error.textContent = 'Sending…';
    let status = 0;
    try {
      const res = await post('/feedback', {
        text: note,
        ...($('fbSign')?.checked ? { key: me.key } : {}),
        device: ON_PHONE ? 'phone' : 'computer',
        place,
      });
      status = res.status;
    } catch (problem) {
      console.error(problem);
      status = problem.name === 'Unreachable' ? -1 : 0;
    }
    if (status === 204) {
      store.set('feedback.sent', Date.now());
      audio.click();
      el.sheetBody.innerHTML = `<p class="nick-lead">Sent. Thanks!</p>
        <button id="fbDone" class="btn btn-primary fb-send" type="button">Done</button>`;
      $('fbDone').addEventListener('click', closeSheet);
      return;
    }
    submit.disabled = false;
    error.textContent = status === 429 ? 'The feedback box is full for today. Try again tomorrow.'
      : status === -1 ? 'Can’t reach the server from this network. Try again later.'
        : 'Couldn’t send it. Try again.';
  });
}

// Boot -----------------------------------------------------------------------------------
function wire() {
  el.btnBegin.addEventListener('click', startDaily);
  el.btnEndless.addEventListener('click', startEndless);
  el.rankedLine.addEventListener('click', () => {
    audio.unlock();
    audio.click();
    if (ranked.player() && G.rankedStatus?.banned) openBan();
    else if (ranked.player() || ON_PHONE) openBoard(); // phones can't play ranked, so no name here
    else openNickname();
  });
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
  // The feedback box needs the server, like the menu's Send feedback.
  el.btnFeedback.hidden = !ranked.available;
  el.btnFeedback.addEventListener('click', () => { audio.unlock(); audio.click(); openFeedback(); });
  el.btnMenu.addEventListener('click', () => { audio.unlock(); audio.click(); openMenu(); });
  el.btnNext.addEventListener('click', nextFromReveal);
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
    if (document.hidden) leaveRanked();
    if (!document.hidden && G.phase === 'title') refreshTitle();
  });
  addEventListener('pagehide', leaveRanked);
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
  sendVisit(G.today, ON_PHONE);
  wire();
  let shift = 0;
  setInterval(() => {
    if (document.body.dataset.screen !== 'title') return;
    shift = shift ? 0 : 1;
    drawLogo(el.logo, shift);
  }, 800);
  refreshTitle();
  refreshNews();
  announce();
  // A dive that finished while the counter was unreachable gets another try.
  for (const day of [G.today - 1, G.today]) {
    const rec = store.get(`daily.${day}`);
    if (rec) sendDaily(rec, content.calendar);
  }
  G.phase = 'title';
  setScreen('title');
  // The name question (real name or anonymous) is asked every time until it's answered. A name the
  // admin offered a change, or requires one, is asked too; an offer asks once a day.
  // Otherwise the note in js/note.js pops up once, and after that an open poll the player hasn't seen.
  checkRanked().then((status) => {
    if (G.phase === 'title') refreshTitle();
    if (G.phase !== 'title' || el.sheet.open) return;
    if (status?.banned) {
      sayBan(status);
      return;
    }
    const renameDue = status?.nameCheck || (status?.rename && !(status.rename === 'offer' && store.get('ranked.renameAsked') === G.today));
    if (renameDue) openRename();
    else if (!showNote()) askPoll();
  });
  requestAnimationFrame(tick);
  document.fonts?.ready.then(() => { world.captionLayout = null; });
  if (IS_LOCAL) window.fihllion = { world, G, content, store };
}

boot();
