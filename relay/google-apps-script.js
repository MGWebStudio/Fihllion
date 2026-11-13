// Fihllion's Google relay, a Google Apps Script web app. Some school filters (Securly, at least)
// block the game's server at workers.dev and pages.dev but let Google through, so the game can send
// its requests here and this passes them along to the server. Setup is in the README ("Google relay").
//
// Paste this whole file into Code.gs of an Apps Script project, then deploy it as a web app that
// runs as you and that anyone can open. Nothing is stored here.
//
//   GET  .../exec               -> "ok" when the server answers (the game checks this first)
//   POST .../exec?path=/ranked/join  (body passed through) -> {"s": status, "b": "server's reply"}
//
// Apps Script always answers 200, so the server's real status travels inside the reply.
const SERVER = 'https://fihllion-counts.mgstudiogame.workers.dev';
const PATHS = /^\/(dive|check|ranked\/(join|status|question|guess|void|board))$/;
const MAX_BODY = 4096;

function doGet() {
  try {
    const res = UrlFetchApp.fetch(`${SERVER}/health`, {
      headers: { 'X-Fihllion-Relay': 'apps-script' },
      muteHttpExceptions: true,
    });
    return text(res.getResponseCode() === 200 ? res.getContentText() : `server said ${res.getResponseCode()}`);
  } catch (error) {
    return text(`relay couldn't reach the server: ${error.message}`);
  }
}

function doPost(e) {
  const path = (e && e.parameter && e.parameter.path) || '';
  if (!PATHS.test(path)) return json({ s: 404, b: 'Not found' });
  const body = (e.postData && e.postData.contents) || '{}';
  if (body.length > MAX_BODY) return json({ s: 413, b: 'Too big' });
  try {
    const res = UrlFetchApp.fetch(SERVER + path, {
      method: 'post',
      contentType: 'text/plain',
      payload: body,
      headers: { 'X-Fihllion-Relay': 'apps-script' },
      muteHttpExceptions: true,
      followRedirects: false,
    });
    return json({ s: res.getResponseCode(), b: res.getContentText() });
  } catch (error) {
    return json({ s: 502, b: 'The relay couldn’t reach the server' });
  }
}

function text(message) {
  return ContentService.createTextOutput(message);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
