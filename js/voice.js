// Speech to text for the answer box, using the browser's own recognition (Chrome, Edge and Safari
// have it; Firefox doesn't, so the mic stays hidden there). The browser's speech service does the
// listening; nothing goes to Fihllion's server.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = Boolean(Recognition);

let current = null;

// Listens for one answer. onInterim gets the words so far, onFinal every version the browser
// heard (best guess first), onError a reason, and onEnd always runs last.
export function listen({ onInterim, onFinal, onError, onEnd }) {
  stopListening();
  const rec = new Recognition();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  rec.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const heard = [...result].map((alt) => alt.transcript.replace(/[.?!]+$/, '').trim()).filter(Boolean);
    if (result.isFinal) onFinal(heard);
    else if (heard[0]) onInterim(heard[0]);
  };
  rec.onerror = (event) => { if (event.error !== 'aborted') onError(event.error); };
  rec.onend = () => {
    if (current === rec) current = null;
    onEnd();
  };
  current = rec;
  try {
    rec.start();
  } catch {
    current = null;
    onError('start');
    onEnd();
  }
}

export function stopListening() {
  if (!current) return;
  const rec = current;
  current = null;
  rec.abort();
}

export const isListening = () => Boolean(current);
