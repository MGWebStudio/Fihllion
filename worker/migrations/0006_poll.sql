-- Votes in the game's poll (js/poll.js). One row per voter: a nickname ("p:" + player id) or, for
-- players without one, a random id the game keeps in that browser ("b:" + id). Changing a vote
-- updates the row. `named` is 1 for nickname votes; `device` is phone or computer.
CREATE TABLE poll_votes (
  poll TEXT NOT NULL,
  voter TEXT NOT NULL,
  choice TEXT NOT NULL,
  named INTEGER NOT NULL DEFAULT 0,
  device TEXT,
  at INTEGER NOT NULL,
  PRIMARY KEY (poll, voter)
);
