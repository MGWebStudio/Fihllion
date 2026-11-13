// Hands every request straight to the fihllion-counts Worker over a service binding. This gives the
// game's server a second address on pages.dev for networks that block workers.dev (some school
// filters do). The Worker does all the checking, including the Origin check, so nothing happens here.
export function onRequest({ request, env, next }) {
  if (new URL(request.url).pathname === '/robots.txt') return next();
  return env.API.fetch(request);
}
