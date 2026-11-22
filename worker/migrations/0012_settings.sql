-- Switches the admin flips from the dashboard (/admin), so they apply without a redeploy.
--   pc_referee  which checks try the PC referee first (refereeMode in src/shared.js); with no row,
--               PC_REFEREE in wrangler.jsonc decides
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER NOT NULL) WITHOUT ROWID;
