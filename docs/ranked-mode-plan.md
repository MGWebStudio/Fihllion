# Ranked mode plan

Status: built 2026-11-12, waiting to go live. How it works now is in the README under "Ranked mode".

## How it works

1. **Opt-in nickname.** Tap "Ranked" and pick a nickname (3–16 letters or numbers). Crude names are filtered, and any name can be removed by the admin. There are no accounts and no emails: the device keeps a secret key that owns the nickname.
2. **Your Daily is your ranked run.** Once you have a nickname, the Daily counts. That's one try a day. Archive replays and Endless never count.
3. **The server runs the dive.** It sends one question at a time, keeps its own 25-second clock, and scores answers itself with the answer lists and the AI referee. Faked scores fail, and so do answers sent after the clock runs out.
4. **Leaving the tab voids that question.** Switch apps or tabs during a question and that round scores 0 and is flagged.
5. **No photos in ranked.** The voice mic stays, since it's just typing by voice.
6. **The board shows as soon as you finish.** Finish your ranked Daily and you see the day's board right away, with your rank, and it keeps updating as others finish. It shows nicknames and scores, never answers. There's a weekly board too.
7. **Privacy.** Ranked scores are tied to a nickname, so How to Play will say so. The normal game stays anonymous.
8. **Cost.** Free, on the same Cloudflare plan as the answer counter and referee.

## Notes for the build

- A LockDown Browser isn't possible on a website. Rule 4 (leaving the tab voids the round) is the closest a web game can get.
- The server holds the clock and does the scoring, so editing the page can't change a score.
- Days are Mountain Time. The normal Daily switched to Mountain Time too, so both change over together.
- Needs: a nickname table, a ranked-run table and a board query on the existing Worker and D1 database, plus a nickname filter and an admin delete.
