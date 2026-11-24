-- Messages from the admin to one player, sent from the dashboard's player panel. The game shows the
-- ones not seen yet when it opens and marks them seen; the panel shows when each one was seen.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  player INTEGER NOT NULL, -- players.id
  text TEXT NOT NULL,
  at INTEGER NOT NULL,     -- when it was sent (ms)
  seen_at INTEGER          -- when it popped up in their game (ms), NULL until then
);
CREATE INDEX messages_by_player ON messages (player, seen_at);

-- A run's score before the admin first changed it from the dashboard, so the change can be undone.
ALTER TABLE runs ADD COLUMN score_was INTEGER;
