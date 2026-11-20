-- Name requests (Nov 2026): a player asks for a different name on the board from the leaderboard, and
-- it changes once the admin approves it (the dashboard, or node admin.mjs approve-name). One request
-- per player at a time; a new one replaces it.
--   name_request:    the name they asked for, or NULL
--   name_request_at: when they asked (ms)
--   name_request_no: 1 once the admin turned it down, so the game can tell them; a new request clears it
ALTER TABLE players ADD COLUMN name_request TEXT;
ALTER TABLE players ADD COLUMN name_request_at INTEGER;
ALTER TABLE players ADD COLUMN name_request_no INTEGER NOT NULL DEFAULT 0;
