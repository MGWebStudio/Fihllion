-- Real names on the leaderboard (Nov 2026). Every player answers once: their own name, or anonymous
-- (shown as Anon and four numbers). Until they answer, they can't start a ranked Daily.
--   name_kind:   NULL until they answer; 'own' (says it's their name) or 'anon'
--   name_before: the nickname they had when they first answered, so the admin can compare
--   name_at:     when they answered, or when the admin last changed it (ms)
ALTER TABLE players ADD COLUMN name_kind TEXT;
ALTER TABLE players ADD COLUMN name_before TEXT;
ALTER TABLE players ADD COLUMN name_at INTEGER;
