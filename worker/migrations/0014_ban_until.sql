-- Timed bans: when a ban ends by itself (milliseconds since 1970), or NULL for a ban that lasts
-- until it's lifted. An expired ban counts as lifted everywhere, and is cleared the next time the
-- player's game talks to the server (playerFor in src/ranked.js).
ALTER TABLE players ADD COLUMN banned_until INTEGER;
