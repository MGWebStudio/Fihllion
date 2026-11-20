-- How many different people open the game each day, for the admin's dashboard (/admin). Each device
-- sends a random id once a day (js/counts.js). Only a scrambled copy tied to that day is kept, so one
-- day's visitors can't be matched with another day's, and copies older than a couple of days are
-- cleared. visit_days keeps the totals: people, how many were on a phone, and how many were new.
CREATE TABLE visits (day INTEGER NOT NULL, who TEXT NOT NULL, PRIMARY KEY (day, who)) WITHOUT ROWID;
CREATE TABLE visit_days (
  day INTEGER PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  phone INTEGER NOT NULL DEFAULT 0,
  fresh INTEGER NOT NULL DEFAULT 0
);

-- Wrong dashboard passwords per hour, so guessing stops after a few.
CREATE TABLE admin_tries (hour INTEGER PRIMARY KEY, n INTEGER NOT NULL);
