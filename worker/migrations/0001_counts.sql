-- Running totals only. Nothing here can be traced back to a player.

-- Finished Daily dives sent in, per day.
CREATE TABLE dives (day INTEGER PRIMARY KEY, n INTEGER NOT NULL);

-- Players who met a prompt for the first time in its Daily, answered or not.
CREATE TABLE plays (prompt TEXT PRIMARY KEY, n INTEGER NOT NULL);

-- How many of them gave each answer in the bank.
CREATE TABLE picks (prompt TEXT NOT NULL, answer TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (prompt, answer));

-- What they typed when nothing in the bank matched, to find answers the bank is missing.
CREATE TABLE misses (prompt TEXT NOT NULL, typed TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (prompt, typed));
