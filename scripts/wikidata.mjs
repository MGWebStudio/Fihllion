// Shared Wikidata pieces for scripts/add-aliases.mjs and scripts/add-answers.mjs: what kind of
// thing each prompt's answers are, and a polite SPARQL client. Wikidata is public domain (CC0).
export const USER_AGENT = 'FihllionWikidata/1.0 (https://github.com/MGWebStudio/Fihllion)';

export const values = (variable, list) => `VALUES ?${variable} { ${list.join(' ')} }`;
export const ids = (list) => list.map((id) => `wd:${id}`);
// Many well-known items keep their name as a "mul" (all languages) label instead of an English one,
// so a lookup by name has to try both.
export const texts = (list) => list.flatMap((text) => [`${JSON.stringify(text)}@en`, `${JSON.stringify(text)}@mul`]);
// An instance or subclass of one of these classes.
export const kind = (...classes) => `?item (wdt:P31/wdt:P279*)|wdt:P279+ ?class . ${values('class', ids(classes))}`;
export const kindNamed = (...labels) => `?item (wdt:P31/wdt:P279*)|wdt:P279+ ?class . ?class rdfs:label ?classLabel . ${values('classLabel', texts(labels))}`;
export const job = (...jobs) => `?item wdt:P31 wd:Q5 ; wdt:P106/wdt:P279* ?job . ${values('job', ids(jobs))}`;
export const taxon = (...groups) => `?item wdt:P171+ ?group . ${values('group', ids(groups))}`;
export const inWork = (...titles) => `?item (wdt:P1080|wdt:P1441|wdt:P8345) ?work . ?work rdfs:label ?workLabel . ${values('workLabel', texts(titles))}`;
export const country = (continent) => `?item wdt:P31 wd:Q3624078 ${continent ? `; wdt:P30 wd:${continent}` : ''} .`;

// Prompt id -> what its answers are. Prompts with letter, rhyme or title rules aren't listed,
// because another name for the right answer can break the rule.

export const SOURCES = {
  bird: taxon('Q5113'),
  'dog-breed': '?item wdt:P31 wd:Q39367 .',
  'cat-breed': kindNamed('cat breed'),
  dinosaur: taxon('Q430'),
  'kind-of-fish': taxon('Q127282', 'Q25371'),
  'insect-or-bug': taxon('Q1390', 'Q1358'),
  snake: taxon('Q2102'),
  'wild-cat': taxon('Q25265'),
  'horse-breed': kindNamed('horse breed'),

  'us-state-capital': '?state wdt:P31 wd:Q35657 ; wdt:P36 ?item .',
  'european-capital': `?state wdt:P31 wd:Q3624078 ; wdt:P30 wd:Q46 ; wdt:P36 ?item .`,
  river: kind('Q4022'),
  mountain: kind('Q8502'),
  island: kind('Q23442'),
  'african-country': country('Q15'),
  'asian-country': country('Q48'),
  'us-national-park': '?item wdt:P31 wd:Q34918903 .',
  lake: kind('Q23397'),
  'us-state': '?item wdt:P31 wd:Q35657 .',
  'city-in-italy': '?item wdt:P17 wd:Q38 ; wdt:P31/wdt:P279* wd:Q486972 .',
  desert: kind('Q8514'),
  'city-that-has-hosted-the-summer-olympics': kind('Q515'),
  'famous-bridge': kind('Q12280'),
  'landlocked-country': country(),

  'chemical-element': '?item wdt:P31 wd:Q11344 .',
  'bone-in-the-human-body': kind('Q265868'),
  'planet-or-moon': kindNamed('planet', 'natural satellite', 'dwarf planet'),
  constellation: '?item wdt:P31 wd:Q8928 .',
  'organ-in-the-human-body': kind('Q712378'),
  'unit-of-measurement': kind('Q47574'),
  'famous-scientist': job('Q901'),
  'rock-or-mineral': kind('Q8063', 'Q7946'),
  gemstone: kind('Q83437'),
  phobia: kind('Q175854'),
  muscle: kindNamed('muscle', 'skeletal muscle'),
  spacecraft: kind('Q40218'),

  'us-president': '?item wdt:P39 wd:Q11696 .',
  'roman-emperor': '?item wdt:P39 wd:Q842606 .',
  'famous-explorer': job('Q11900058'),
  war: kind('Q198'),
  'king-or-queen-from-history': '?item wdt:P31 wd:Q5 . { ?item wdt:P39/wdt:P279* wd:Q116 } UNION { ?item wdt:P106/wdt:P279* wd:Q116 }',
  'founding-father': '?item wdt:P31 wd:Q5 ; wdt:P27 wd:Q30 .',
  'us-first-lady': '?item wdt:P39 ?position . ?position rdfs:label "First Lady of the United States"@en .',
  philosopher: job('Q4964182'),
  'figure-from-the-wild-west': '?item wdt:P31 wd:Q5 .',
  'nobel-peace-prize-winner': '?item wdt:P166 wd:Q35637 .',
  'civil-rights-leader-or-activist': '?item wdt:P31 wd:Q5 .',
  'famous-battle': kind('Q178561'),
  'famous-ship': kind('Q11446'),

  language: kind('Q34770'),
  'greek-letter': '?item wdt:P361 wd:Q8216 .',
  'punctuation-mark': kindNamed('punctuation mark'),

  'pixar-movie': '?item wdt:P272 wd:Q127552 .',
  'disney-animated-movie': '?item wdt:P272 wd:Q1047410 .',
  'tom-hanks-movie': '?item wdt:P161|wdt:P725 wd:Q2263 .',
  'best-picture-winner': '?item wdt:P166 wd:Q102427 ; wdt:P31/wdt:P279* wd:Q11424 .',
  'star-wars-character': inWork('Star Wars'),
  'harry-potter-character': inWork('Harry Potter', 'Wizarding World'),
  'simpsons-character': '?item wdt:P1441|wdt:P1080 wd:Q886 .',
  'character-from-the-office': inWork('The Office'),
  superhero: kind('Q188784'),
  sitcom: '{ ?item wdt:P136 wd:Q170238 } UNION { ?item wdt:P31/wdt:P279* wd:Q170238 }',
  'cartoon-series': kind('Q581714'),
  'james-bond-movie': '?item wdt:P179 ?series . ?series rdfs:label ?seriesLabel . FILTER(CONTAINS(STR(?seriesLabel), "James Bond"))',
  'horror-movie': '?item wdt:P136/wdt:P279* wd:Q200092 .',
  'steven-spielberg-movie': '?item wdt:P57 wd:Q8877 .',
  'lord-of-the-rings-character': inWork('The Lord of the Rings', 'Middle-earth', 'The Hobbit'),

  'rock-band': '{ ?item wdt:P31 wd:Q5741069 } UNION { ?item wdt:P31/wdt:P279* wd:Q215380 ; wdt:P136/wdt:P279* wd:Q11399 }',
  'beatles-song': '?item wdt:P175 wd:Q1299 .',
  'musical-instrument': kind('Q34379'),
  'broadway-musical': kind('Q2743'),
  'classical-composer': job('Q36834'),
  rapper: job('Q2252262'),
  'taylor-swift-song': '?item wdt:P175 wd:Q26876 .',
  'michael-jackson-song': '?item wdt:P175 wd:Q2831 .',
  'music-genre': kind('Q188451'),
  'elvis-song': '?item wdt:P175 wd:Q303 .',
  'female-pop-star': '?item wdt:P31 wd:Q5 ; wdt:P21 wd:Q6581072 .',
  'boy-band-or-girl-group': kind('Q216337', 'Q641066'),
  'christmas-song': `{ ?item wdt:P136 ?genre } UNION { ?item wdt:P31 ?genre } ?genre rdfs:label ?genreLabel . ${values('genreLabel', texts(['Christmas song', 'Christmas music', 'Christmas carol']))}`,

  'greek-god-or-goddess': '?item wdt:P31/wdt:P279* wd:Q22989102 .',
  'shakespeare-play': '?item wdt:P50 wd:Q692 .',
  'shakespeare-character': '?item wdt:P1441 ?work . ?work wdt:P50 wd:Q692 .',
  'dr-seuss-book': '?item wdt:P50 wd:Q298685 .',
  'fairy-tale': '{ ?item wdt:P136/wdt:P279* wd:Q699 } UNION { ?item wdt:P31/wdt:P279* wd:Q699 }',
  'charles-dickens-character': '?item wdt:P1441 ?work . ?work wdt:P50 wd:Q5686 .',
  'stephen-king-book': '?item wdt:P50 wd:Q39829 .',
  'mythical-creature': kind('Q2239243'),
  'classic-novel': kind('Q8261'),
  'famous-author': job('Q36180'),
  'nursery-rhyme': kindNamed('nursery rhyme'),
  'book-of-the-bible': kindNamed('book of the Bible'),
  'fictional-detective': '{ ?item wdt:P106/wdt:P279* ?role . ?role rdfs:label "detective"@en } UNION { ?item wdt:P31/wdt:P279* ?class . ?class rdfs:label "fictional detective"@en }',

  'olympic-sport': kind('Q349'),
  'nfl-team-past-or-present': '?item wdt:P118 wd:Q1215884 .',
  'nba-team-past-or-present': '?item wdt:P118 wd:Q155223 .',
  'mlb-team-past-or-present': '?item wdt:P118 wd:Q1163715 .',
  'nhl-team-past-or-present': '?item wdt:P118 wd:Q1215892 .',
  'soccer-club': kind('Q476028'),
  'tennis-player': job('Q10833314'),
  'basketball-player': job('Q3665646'),
  'soccer-player': job('Q937857'),
  'martial-art': kind('Q11417'),
  'sport-played-with-a-ball': kind('Q349'),
  'sport-played-on-ice-or-snow': kind('Q349'),
  'yoga-pose': kindNamed('asana'),

  'board-game': kind('Q131436'),
  'card-game': kind('Q142714'),
  'video-game-console': kind('Q8076'),
  'mario-character': '?item (wdt:P1080|wdt:P1441|wdt:P8345) ?work . ?work rdfs:label ?workLabel . FILTER(CONTAINS(STR(?workLabel), "Mario"))',
  'original-151-pok-mon': kindNamed('Pokémon species'),
  'video-game': kind('Q7889'),
  'arcade-game': kind('Q7889'),

  'car-brand': kindNamed('automobile manufacturer', 'automobile marque', 'car brand'),
  'fast-food-chain': kindNamed('fast food restaurant chain', 'restaurant chain'),
  soda: kind('Q147538'),
  airline: kind('Q46970'),
  'kitchen-utensil': kindNamed('kitchen utensil', 'kitchenware'),
  'hand-tool': kindNamed('hand tool', 'tool'),
  'kind-of-hat': kind('Q80151'),
  'kind-of-shoe': kind('Q22676'),
  fabric: kindNamed('textile', 'fabric'),
  currency: kind('Q8142'),
  'household-appliance': kindNamed('home appliance', 'household appliance'),
  'kind-of-boat': kind('Q35872'),
  'piece-of-furniture': kind('Q14745'),

  'famous-painter': job('Q1028181'),
  'art-movement': kind('Q968159'),
  holiday: kindNamed('holiday', 'public holiday', 'observance'),
  color: kind('Q1075'),
  'shade-of-blue': kind('Q1075'),
  'style-of-dance': kind('Q11639'),
  hairstyle: kindNamed('hairstyle'),
  'famous-painting': kind('Q3305213'),
  university: kind('Q3918'),
  'tv-network-or-channel': kindNamed('television channel', 'television network', 'television station', 'cable channel'),

  'pasta-shape': kind('Q178'),
  cheese: kind('Q10943'),
  fruit: kind('Q1364', 'Q3314483'),
  vegetable: kind('Q11004'),
  'spice-or-herb': kind('Q42527', 'Q207123'),
  'condiment-or-sauce': kindNamed('condiment', 'sauce'),
  'type-of-bread': kind('Q7802'),
  dessert: kind('Q182940'),
  sandwich: kind('Q28803'),
  cocktail: kind('Q134768'),
  'candy-or-chocolate-bar': kindNamed('candy', 'confectionery', 'chocolate bar'),
  'breakfast-cereal': kindNamed('breakfast cereal'),
  'soup-or-stew': kindNamed('soup', 'stew'),
  'rice-dish': kindNamed('rice dish'),
  'mexican-dish': '?item wdt:P495 wd:Q96 .',

  'frog-or-toad': taxon('Q53636'),
  'butterfly-or-moth': taxon('Q28319'),
  'famous-castle-or-palace': kind('Q23413', 'Q16560'),
  'will-smith-movie': '?item wdt:P161 wd:Q40096 .',
  'elton-john-song': '?item wdt:P175 wd:Q2808 .',
  'billy-joel-song': '?item wdt:P175 wd:Q194333 .',
  'famous-poet': job('Q49757'),
  'famous-drummer': job('Q386854'),
  'pro-wrestler': job('Q13474373'),
};

// Prompts whose answers are people, where a new name can be a birth name or pen name that shares no
// word with the answer.
export const PEOPLE = new Set(['rapper', 'basketball-player', 'famous-author', 'classical-composer', 'famous-painter',
  'famous-scientist', 'philosopher', 'famous-explorer', 'tennis-player', 'soccer-player', 'us-president', 'roman-emperor',
  'king-or-queen-from-history', 'founding-father', 'us-first-lady', 'nobel-peace-prize-winner', 'figure-from-the-wild-west',
  'civil-rights-leader-or-activist', 'female-pop-star', 'famous-poet', 'famous-drummer', 'pro-wrestler']);

// Prompts whose Wikidata kind is exact enough to supply whole new answers, not just other names.
// Kinds that only approximate the prompt (any person, any city, any Mexican thing) aren't here.
export const CATALOGS = new Set([
  'us-state', 'us-state-capital', 'european-capital', 'african-country', 'asian-country', 'chemical-element',
  'constellation', 'us-president', 'roman-emperor', 'nobel-peace-prize-winner', 'us-first-lady',
  'best-picture-winner', 'nfl-team-past-or-present', 'nba-team-past-or-present', 'mlb-team-past-or-present',
  'nhl-team-past-or-present', 'dog-breed', 'cat-breed', 'horse-breed', 'simpsons-character',
  'star-wars-character', 'harry-potter-character', 'lord-of-the-rings-character', 'shakespeare-character',
  'charles-dickens-character', 'greek-god-or-goddess', 'classical-composer', 'famous-painter',
  'famous-scientist', 'philosopher', 'famous-explorer', 'rapper', 'tennis-player', 'basketball-player',
  'soccer-player', 'famous-author', 'gemstone', 'phobia', 'musical-instrument', 'cheese', 'cocktail',
  'river', 'mountain', 'lake', 'island', 'desert', 'spacecraft', 'soccer-club', 'video-game-console',
  'board-game', 'card-game', 'airline', 'broadway-musical', 'martial-art', 'superhero', 'sitcom',
  'cartoon-series', 'art-movement', 'famous-painting', 'famous-castle-or-palace', 'famous-poet',
  'famous-drummer', 'pro-wrestler',
]);

// A query that times out once will time out again, so only rate limits get more than one retry.
export async function sparql(query) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(75_000),
    });
    if (res.ok) return (await res.json()).results.bindings;
    if (res.status !== 429 && (res.status < 500 || attempt > 0)) throw new Error(`Wikidata answered ${res.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * Number(res.headers.get('retry-after') || 5)));
  }
  throw new Error('Wikidata kept refusing');
}

