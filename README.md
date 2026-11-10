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
