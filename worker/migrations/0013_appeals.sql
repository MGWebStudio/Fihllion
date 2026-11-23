-- Ban appeals: a banned player can ask for the ban to be lifted, from the game, and the admin
-- answers on the dashboard. One appeal at a time per player.
--   appeal        what they wrote
--   appeal_at     when they sent it
--   appeal_state  'waiting', 'no' (turned down; they can send another) or 'yes' (ban lifted)
ALTER TABLE players ADD COLUMN appeal TEXT;
ALTER TABLE players ADD COLUMN appeal_at INTEGER;
ALTER TABLE players ADD COLUMN appeal_state TEXT;
