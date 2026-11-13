# Fihllion

A daily trivia dive. You get seven prompts and 25 seconds each. The rarer your answer, the deeper your goldfish sinks.

Play it at **https://mgwebstudio.github.io/Fihllion/**

Inspired by [Krillion](https://krillion.io). The art, prompts and answer lists here are original.

## How it runs

It's a plain static site with no build step, so GitHub Pages serves the files as they are. There's no server or database. Progress and stats stay in each player's browser.

## Adding prompts

Prompts live in `.txt` files under `data/`. A file's name is its category, minus any batch number, so `data/food.txt` and `data/pool/food-0002.txt` are both food. Each prompt looks like this:

```
? Name a pasta shape
~drop pasta,noodles
10: Spaghetti, Penne, Lasagna|Lasagne
15: Orzo
30: Rigatoni
60: Pappardelle
85: Bucatini
100: Strozzapreti :: The line shown when this hidden answer is revealed.
```

- The number is the points that answer scores. 15 is the "Too Clever" tier: answers that sound obscure but aren't.
- Each prompt has exactly one `100:` answer, with its fun fact after `::`.
- `|` adds another accepted spelling, and `\,` puts a real comma in an answer.
- `~drop word` ignores that word in what the player types, so "penne pasta" counts as Penne.
- `~last` accepts a person's last name on its own.
- `~exact` turns off spelling forgiveness, for rhymes and word puzzles.

Then run these and push:

```
node scripts/build-index.mjs
node scripts/build-schedule.mjs
node scripts/check-prompts.mjs
```

The first updates `data/index.json`, which tells the game which file holds each prompt so it only downloads the files a dive needs. The second adds new daily dives from any prompts that aren't scheduled yet. Days already in the schedule never change, and after the last scheduled day the dives repeat from the start. The third catches mistakes.

Endless never shows a daily prompt before its day. It plays past dailies and prompts that aren't scheduled, saving the ones a player already met in a daily for last. Only if there aren't enough for a single dive does it borrow the dailies furthest away, never one due within a week. The results screen shows only the player's own answers, so the hidden answers stay hidden.

## Growing the lists from Wikidata

Two scripts fill gaps in the hand-made lists from Wikidata (public domain). Both read `scripts/wikidata.mjs`, which says what kind of thing each prompt's answers are. Both show what they'd change unless given `--write`, and both should be followed by `check-prompts` and a read of the diff.

- `node scripts/add-aliases.mjs` adds other names for answers already on a list ("Doberman Pinscher" for Doberman, "Space Shuttle Discovery" for Discovery), up to three each. A name is only taken from the one item that clearly matches the answer, and is skipped if it's shorter than four letters (codes like "ME"), names a company, or, except for people, shares no word with the answer (which keeps out "Lady" for Jane Austen and "Miami FC" style mix-ups).
- `node scripts/add-answers.mjs [prompt-id ...]` adds answers a list is missing, only for prompts in `CATALOGS`, where the kind is exact (every US state, every Pixar film) rather than approximate. An item needs at least four Wikipedia language editions, and the kind has to fit at least half the answers already on the list. A new answer scores 30, 60 or 85 points by how widely it's covered compared with the list's own 30- and 60-point answers, and anything spelled close to an existing answer is skipped so a typo of a common answer can't land on a rare one.

## Voice and photos

The mic button (`js/voice.js`) uses the browser's own speech recognition, so it's hidden where there isn't any (Firefox). It fills the answer box with what the player says; when the browser heard several versions, the first one on the prompt's list wins. The player still taps Drop.

A prompt about a person or band shows their photo beside the question ("Name an Elton John song" shows Elton John). The photo's credit (photographer, license and a link to its Commons page) appears when the player taps the "i" on its corner. The subjects are listed by hand in `scripts/build-portraits.mjs`. Running it rebuilds `data/portraits.json` from each subject's Wikidata photo, which always lives on Wikimedia Commons under a free license, and prints which Wikidata item it matched so a wrong match is easy to spot. Add a line there when a new prompt names someone.

## Running it locally

Serve the folder with any static server, for example `python -m http.server 5680`. Opening `index.html` directly won't work, because browsers block the data files on `file://` pages.

On localhost, add `?today=2026-11-10` to the address to pretend it's another day.

## Answer counts

`worker/` is a small Cloudflare Worker with a D1 database that counts Daily answers anonymously, so rarity can come from what players actually say instead of hand-set tiers. When a player finishes a Daily on its own day, `js/counts.js` sends it once: for each prompt they hadn't met before (not in an earlier Daily or in Endless), either the bank answer it matched or what they typed if nothing matched. The database keeps running totals only (`dives`, `plays`, `picks`, `misses`). There are no IP addresses, player IDs or timestamps. Archive replays and Endless are never sent. The game works the same if the counter is down.

The Worker only accepts dives from the game's own site, for a day within one of today, and only prompts that belong to that day. It runs on Cloudflare's free plan, so going over the limits just makes it stop answering until the next day.

Testing locally (`worker/.dev.vars` points the Worker at the local game and allows any day):

```
cd worker
npm install
npm run migrate:local
npm run dev
```

With the Worker on port 8787, the game on localhost sends there instead of to the live counter.

Reading the live totals:

```
cd worker
npx wrangler d1 execute fihllion --remote --command "SELECT prompt, answer, n FROM picks ORDER BY prompt, n DESC"
npx wrangler d1 execute fihllion --remote --command "SELECT prompt, typed, n FROM misses ORDER BY n DESC LIMIT 50"
```

A pick's share is its `n` divided by the prompt's `plays.n`.

## AI referee

When a typed answer isn't on a prompt's list, the game asks the Worker's `/check` before saying "No bites" (`js/referee.js`). This happens in every mode. The Worker first re-checks the list, then looks for a saved ruling, and only then asks a free Workers AI model (`@cf/qwen/qwen3-30b-a3b-fp8`). The model gets the prompt, a few of its commonest answers, any words players may leave off, and the top Wikipedia search results for the answer as evidence. The hidden answer is never shown to it. The clock stops while it decides, which usually takes under a second.

An accepted answer scores by how well known the model says it is (30, 60 or 85 points), unless the model's name for it turns out to be on the list, in which case the list's tier applies. Every ruling, yes or no, is saved in the `verdicts` table with how often it's been typed, so the same guess gets the same answer for everyone and only costs one model call. Model calls are capped at `AI_DAILY_CAP` a day (3,000, about 7,500 of the 10,000 free daily units). Past the cap, or if the model fails, the answer simply doesn't count.

In a test of 180 rulings, it accepted about 80% of real niche answers, rejected every wrong answer from a different subject, and let through one wrong answer from the same subject (a drummer named as a guitarist).

Reviewing rulings, and fixing a wrong one (the next player to type it gets a fresh ruling):

```
cd worker
npx wrangler d1 execute fihllion --remote --command "SELECT prompt, typed, valid, name, tier, n FROM verdicts ORDER BY n DESC LIMIT 100"
npx wrangler d1 execute fihllion --remote --command "DELETE FROM verdicts WHERE prompt = 'game-show' AND typed = 'the cube'"
```

Answers the referee accepts often belong on the prompt's list. Add them to the `.txt` file like any other answer.

## Ranked mode

A player who picks a nickname plays their Daily as a ranked run: one try a day, on a board everyone can see. Days are Mountain Time for everyone, and so is the normal Daily. The code is `worker/src/ranked.js` on the server and `js/ranked.js` in the game.

- **Nicknames.** 3 to 16 letters or numbers, unique ignoring case, with a filter for crude words. There are no accounts or emails. The server makes a secret key, the game keeps it in the browser, and the database stores only its SHA-256 hash. Clearing the browser's data loses the nickname.
- **The server runs the dive.** It sends one question at a time with `/ranked/question` and keeps its own clock: 3 + 25 seconds plus 2.5 seconds for the network, pushed back while the referee thinks. Every answer goes to `/ranked/guess`, which scores it with the same lists, hidden-answer rule and referee as the game. A question whose time runs out scores 0, even if the player never comes back.
- **Leaving the tab** during a question sends `/ranked/void`: that question scores 0 and is flagged. A web page can't block other apps, so this is as strict as it gets.
- **No photos** in ranked dives. The mic still works.
- **Boards.** `/ranked/board` gives today's and this week's (Monday to Sunday) top 100 plus the player's own rank. Nicknames and scores only, never answers. A finished run shows at once. A run quit halfway still counts once its day is over, so quitting can't hide a bad score.
- **Storage.** `players` (nickname, key hash, banned flag) and `runs` (day, each question's tier and points, score, flags). No answers, IP addresses or emails.

Admin, from `worker/` with the Wrangler login:

```
node admin.mjs board          # today's board, with how many questions each player voided
node admin.mjs board 12       # day 12
node admin.mjs ban Somename   # hide from every board and stop playing ranked
node admin.mjs unban Somename
```

Add `--local` to use the test database. The live tables need `npm run migrate:live` once before the Worker that uses them is deployed.

## Second address (relay/)

Some networks, school Wi-Fi filters mostly, block `workers.dev`, which stops ranked, the referee and the counter there. `relay/` is a Cloudflare Pages project (`fihllion-api.pages.dev`) whose only job is to hand every request to the same Worker over a service binding, so it's the same server, database and rules at a second address. `js/server.js` asks both addresses' `/health` at once and uses whichever answers first. If neither does, ranked says the network is blocking it instead of failing on the nickname.

Deploying it (only needed when `relay/` changes; Worker updates reach it automatically):

```
cd relay
npx wrangler pages deploy --branch main
```

Testing it locally: run the Worker (`npm run dev` in `worker/`), then `npx wrangler pages dev public --port 8788` in `relay/`, and point the local address list in `js/server.js` at port 8788.

## Google relay

The school's filter (Securly) blocks both of the server's addresses, `workers.dev` and `pages.dev`, by category, but lets Google through. `relay/google-apps-script.js` is a Google Apps Script web app that passes the game's requests along to the Worker. The game tries the server's own addresses first and only uses the relay when neither answers, since it's slower (about a second each way) and Apps Script has daily limits (20,000 fetches a day on a personal account).

- The relay sends `X-Fihllion-Relay: apps-script` instead of an Origin header, and the Worker accepts that.
- Ranked answers that come through it get 4 more seconds before they count as late, for the extra hop.
- The relay always answers 200 with `{"s": status, "b": body}`, and `js/server.js` unwraps it.

Setting it up, in a personal Google account (not a school one):

1. At script.google.com, make a new project called "Fihllion relay".
2. Replace everything in `Code.gs` with `relay/google-apps-script.js` and save.
3. Deploy, then New deployment, then the gear, then Web app. Execute as: Me. Who has access: Anyone. Deploy.
4. Authorize it. Google warns the app isn't verified, because it's your own script, so choose Advanced, then Go to Fihllion relay, then Allow. The only permission it asks for is connecting to an external service.
5. Copy the web app URL (it ends in `/exec`) into `GOOGLE_RELAY` in `js/server.js`. Opening that URL should show `ok`.

After changing the script, use Deploy, then Manage deployments, then edit the deployment and pick a new version, so the URL stays the same.
