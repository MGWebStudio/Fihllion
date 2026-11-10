-- The AI referee's rulings on answers that aren't on a prompt's list, so every guess is only ever
-- sent to the model once. n is how often it's been typed, which shows what to add to the lists.
CREATE TABLE verdicts (
  prompt TEXT NOT NULL,
  typed TEXT NOT NULL,
  valid INTEGER NOT NULL,
  name TEXT,
  tier INTEGER,
  n INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (prompt, typed)
);

-- Model calls per day, checked against AI_DAILY_CAP to stay inside the free allowance.
CREATE TABLE ai_calls (day INTEGER PRIMARY KEY, n INTEGER NOT NULL);
