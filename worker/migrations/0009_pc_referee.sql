-- The PC referee (src/pc.js): checks the admin's own computer answered, and the ones it failed
-- or was too slow for (those went to Cloudflare's model instead). n and units stay Cloudflare's.
ALTER TABLE ai_calls ADD COLUMN pc INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_calls ADD COLUMN pc_failed INTEGER NOT NULL DEFAULT 0;
