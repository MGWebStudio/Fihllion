// Seasonal looks. Each one runs between two dates (month, day) every year and switches itself off
// afterward, so nothing has to be undone by hand. Adding ?theme=thanksgiving or ?theme=none to the
// address overrides the date, for testing.
const THEMES = [
  { name: 'thanksgiving', from: [11, 10], to: [11, 30], note: 'Happy Thanksgiving from the bowl' },
];

export function activeTheme(date) {
  const forced = new URLSearchParams(location.search).get('theme');
  if (forced) return THEMES.find((theme) => theme.name === forced) || null;
  const today = (date.getMonth() + 1) * 100 + date.getDate();
  return THEMES.find(({ from, to }) => today >= from[0] * 100 + from[1] && today <= to[0] * 100 + to[1]) || null;
}
