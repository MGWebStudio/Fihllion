# Fihllion

A daily trivia dive. You get seven prompts and 25 seconds each. The rarer your answer, the deeper your goldfish sinks.

Play it at **https://mgwebstudio.github.io/Fihllion/**

Inspired by [Krillion](https://krillion.io). The art, prompts and answer lists here are original.

## How it runs

It's a plain static site with no build step, so GitHub Pages serves the files as they are. There's no server or database. Progress and stats stay in each player's browser.

## Adding prompts

Prompts live in `data/*.txt`, with one file per category. Each one looks like this:

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
node scripts/check-prompts.mjs
node scripts/build-schedule.mjs
```

The first catches mistakes. The second adds new daily dives from any prompts that aren't scheduled yet. Days already in the schedule never change. After the last scheduled day, the dives repeat from the start.

## Running it locally

Serve the folder with any static server, for example `python -m http.server 5680`. Opening `index.html` directly won't work, because browsers block the data files on `file://` pages.

On localhost, add `?today=2026-11-10` to the address to pretend it's another day.
