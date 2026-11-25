// Spelling rules the game checks itself, for prompts where an answer has to be spelled a certain way.
// The AI referee can't count letters: it said no to "mirror" and "espresso" for the same letter three
// times and to "were" and "typo" for the top row of a keyboard, and yes to "logo" for a double O
// (rulings saved up to Nov 24, 2026). So a guess that breaks its rule is turned down without asking
// the referee, and for the word prompts the referee is only asked whether the word is real.
// The Worker and scripts/check-prompts.mjs use this; the game itself only needs its lists.

// Just the letters, lowercase and without accents: "Tut-tut" is tuttut, "Ma'am" is maam.
export const letters = (text) => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

// What the referee is asked instead of the prompt. The lists count names as words (Mississippi,
// Brooklyn, Roomba), so it does too.
const REAL_WORD = 'Name a real English word in any form (plurals, past tenses, -ing forms and contractions all count), or the name of a real place, person, brand or thing';
const REAL_PHRASE = 'Name a real English word in any form, or a phrase people really say';

const sameLetterThrice = (w) => [...new Set(w)].some((c) => w.split(c).length - 1 >= 3);
const reversed = (w) => [...w].reverse().join('');

// fits(letters) says whether the spelling works; `ask` replaces the prompt for the referee. The
// country and animal prompts keep their own question: the referee does fine on those.
const RULES = {
  'word-with-the-same-letter-three-times-in-it': { fits: sameLetterThrice, ask: REAL_WORD, says: 'It needs the same letter three times.' },
  'word-you-can-type-using-only-the-top-row-of-a-keyboard': { fits: (w) => /^[qwertyuiop]+$/.test(w), ask: REAL_WORD, says: 'Only Q W E R T Y U I O P allowed.' },
  'word-with-a-z-in-it': { fits: (w) => w.includes('z'), ask: REAL_WORD, says: 'It needs a Z.' },
  'word-with-a-double-o-in-it': { fits: (w) => w.includes('oo'), ask: REAL_WORD, says: 'It needs two O’s in a row.' },
  'word-that-starts-with-x': { fits: (w) => w.startsWith('x'), ask: REAL_WORD, says: 'It has to start with X.' },
  'word-that-starts-with-q': { fits: (w) => w.startsWith('q'), ask: REAL_WORD, says: 'It has to start with Q.' },
  'word-or-phrase-that-starts-with-fire': { fits: (w) => w.startsWith('fire'), ask: REAL_PHRASE, says: 'It has to start with “fire.”' },
  'word-that-ends-in-ough': { fits: (w) => w.endsWith('ough'), ask: REAL_WORD, says: 'It has to end in “ough.”' },
  'palindrome': { fits: (w) => w.length > 1 && w === reversed(w), ask: 'Name a real English word, name, phrase or sentence', says: 'It has to read the same backwards.' },
  'word-with-no-a-e-i-o-or-u': { fits: (w) => w.length > 1 && !/[aeiou]/.test(w), ask: REAL_WORD, says: 'No A, E, I, O or U allowed.' },
  'word-that-has-all-five-vowels-in-it': { fits: (w) => [...'aeiou'].every((v) => w.includes(v)), ask: REAL_WORD, says: 'It needs A, E, I, O and U.' },
  'compound-word-that-starts-with-sun': { fits: (w) => w.startsWith('sun') && w.length > 3, ask: 'Name a real English compound word', says: 'It has to start with “sun.”' },
  'country-that-starts-and-ends-with-the-same-letter': { fits: (w) => w.length > 1 && w[0] === w[w.length - 1], says: 'It has to start and end with the same letter.' },
  'country-with-only-four-letters-in-its-name': { fits: (w) => w.length === 4, says: 'It needs exactly four letters.' },
  'country-whose-name-ends-in-stan': { fits: (w) => w.endsWith('stan'), says: 'It has to end in “stan.”' },
  'country-that-starts-with-s': { fits: (w) => w.startsWith('s'), says: 'It has to start with S.' },
  'animal-that-starts-with-p': { fits: (w) => w.startsWith('p'), says: 'It has to start with P.' },
};

export const ruleFor = (prompt) => RULES[prompt.id] || null;
export const ruleIds = () => Object.keys(RULES);

// True when the text can't be an answer to this prompt however real it is. Prompts without a rule
// never break one.
export function breaksRule(prompt, text) {
  const rule = ruleFor(prompt);
  return Boolean(rule) && !rule.fits(letters(text));
}
