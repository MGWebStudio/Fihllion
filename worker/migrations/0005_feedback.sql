-- What players send from the feedback box in the game's menu. Read it with `node admin.mjs feedback`.
-- The player is set only when they ticked "Add my nickname", and comes from their key, so nobody
-- can sign as someone else.
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,      -- when it arrived (ms)
  text TEXT NOT NULL,
  player INTEGER,           -- players.id
  device TEXT,              -- 'phone' or 'computer'
  place TEXT                -- where in the game they were, with the prompt if one was up
);
CREATE INDEX feedback_by_time ON feedback (at);
