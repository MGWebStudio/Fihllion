-- A note from the admin with a lifted appeal: the player sees it once, the next time the game opens
-- (sayAppealReply in js/main.js). NULL when there's none. A new appeal or a new ban clears it.
ALTER TABLE players ADD COLUMN appeal_reply TEXT;
