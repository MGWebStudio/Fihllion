-- Moderation that keeps a player's nickname and scores.
--   paused:       off the boards and out of ranked for now (node admin.mjs pause / unpause)
--   rename_offer: 1 when the player is offered a one-time nickname change (offer-rename),
--                 2 when they must pick a new one (force-rename); until they do, it's off the boards
ALTER TABLE players ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN rename_offer INTEGER NOT NULL DEFAULT 0;
