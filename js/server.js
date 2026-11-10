// Where the game's small server (worker/) lives: the answer counter and the AI referee. On this PC
// the game talks to a local copy started with `npm run dev` in worker/. Empty turns both off.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
export const SERVER = IS_LOCAL ? 'http://localhost:8787' : 'https://fihllion-counts.mgstudiogame.workers.dev';
