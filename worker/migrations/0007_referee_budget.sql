-- The referee's daily budget is counted in Cloudflare's AI units ("neurons") now, not calls, with
-- part of it kept for ranked. Each day also notes when practice and ranked ran out, and how many
-- model calls failed; ai_failures keeps the first couple hundred failures a day to show why.
ALTER TABLE ai_calls ADD COLUMN units REAL NOT NULL DEFAULT 0;
ALTER TABLE ai_calls ADD COLUMN failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_calls ADD COLUMN practice_out_at INTEGER;
ALTER TABLE ai_calls ADD COLUMN ranked_out_at INTEGER;
-- Days before this counted calls only. A call measured 2.3-2.8 units, so earlier days get 2.6 each,
-- which keeps a day already in progress from looking unspent.
UPDATE ai_calls SET units = n * 2.6;

CREATE TABLE ai_failures (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT);
CREATE INDEX ai_failures_by_time ON ai_failures (at);
