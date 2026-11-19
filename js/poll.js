// The poll players can vote in, shared by the game (js/main.js) and the server (worker/src/poll.js).
// One vote per nickname, or per browser for players without one, and it can be changed until the
// poll closes. Results: `node admin.mjs poll` in worker/. Set POLL to null when there's no poll.
export const POLL = {
  id: 'weekend-ranked',
  title: 'Weekend poll',
  question: 'Should ranked run on weekends too, or should weekends be a Daily just for fun, with no points?',
  options: [
    { id: 'ranked', label: 'Ranked every day', sub: 'Points and the leaderboard on weekends too' },
    { id: 'fun', label: 'Weekends just for fun', sub: 'Same Daily, but no points or leaderboard on Saturday and Sunday' },
  ],
  closes: '2026-11-20T23:00:00Z', // Friday 4 PM Mountain Time, after school
  closesSaid: 'Friday at 4 PM',
};

export const pollOpen = (poll = POLL, now = Date.now()) => Boolean(poll) && now < Date.parse(poll.closes);
