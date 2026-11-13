-- Ranked mode. A player is a nickname and the hash of a secret key kept on their device. There are
-- no emails, accounts or IP addresses. Answers aren't stored, only each round's tier and points.

CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,                    -- as the player typed it, shown on the boards
  name_key TEXT NOT NULL UNIQUE,         -- lowercased, so "Fish" and "fish" can't both exist
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 of the device's secret key
  created INTEGER NOT NULL,              -- day number
  banned INTEGER NOT NULL DEFAULT 0      -- set by the admin; hidden from boards, can't play ranked
);

-- One ranked Daily per player per day. The server serves one question at a time and keeps the clock.
CREATE TABLE runs (
  player INTEGER NOT NULL,
  day INTEGER NOT NULL,
  rounds TEXT NOT NULL DEFAULT '[]',     -- JSON, one entry per finished question: {"tier": 3, "pts": 60}
  served INTEGER,                        -- when the current question was sent (ms), null between questions
  deadline INTEGER,                      -- when it stops taking answers (ms), pushed back while the referee thinks
  guesses INTEGER NOT NULL DEFAULT 0,    -- guesses on the current question
  score INTEGER NOT NULL DEFAULT 0,
  flags INTEGER NOT NULL DEFAULT 0,      -- questions voided for leaving the tab
  finished INTEGER,                      -- when the seventh question was settled (ms)
  PRIMARY KEY (player, day)
);
CREATE INDEX runs_by_day ON runs (day, finished, score);
