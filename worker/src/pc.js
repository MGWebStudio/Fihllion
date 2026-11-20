// The PC referee: the referee's model running on the admin's own computer with Ollama
// (pc-referee/pc-referee.mjs). The computer connects out to this server and keeps one WebSocket
// open; checks go down it and answers come back up it. Nothing on the computer is reachable from
// the internet. shared.js decides which checks try the PC first (PC_REFEREE).
//
// One Durable Object, named "pc", holds the connection. It uses the hibernation API, so while the
// PC sits idle the object sleeps and costs nothing, and the PC's pings get a pong without waking it.
//
//   GET /pc/connect   WebSocket upgrade from the PC. Its first message must be
//                     {"type": "hello", "key": PC_REFEREE_KEY, "model"}, or the connection is closed.
//   PC -> server      "ping" (answered "pong"), {"type": "pause"} / {"type": "resume"} (for gaming),
//                     {"type": "result", "id", "text", "ms"} or {"type": "result", "id", "error"}
//   server -> PC      {"type": "ready"}, {"type": "job", "id", "messages": [...]}
import { DurableObject } from 'cloudflare:workers';

const JOB_TIMEOUT_MS = 8000; // past this the check goes to Cloudflare's model instead
const SLOW_PAUSE_MS = 30000; // after a timeout, skip the PC this long
const SILENT_MS = 75000; // the PC pings every 30 seconds; this long without one means it's gone
const HELLO_MS = 15000; // a connection that hasn't said hello by then is dropped

export class PcLink extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.pending = new Map(); // job id -> { ws, resolve }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    // Connections that never said hello don't pile up.
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment();
      if (!state?.ok && Date.now() - (state?.at || 0) > HELLO_MS) ws.close(4002, 'No hello');
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ ok: false, at: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    let data = null;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      // Closed below.
    }
    if (!data || typeof data !== 'object') return ws.close(1003, 'Not JSON');
    const state = ws.deserializeAttachment() || {};
    if (!state.ok) {
      if (data.type !== 'hello' || !(await sameKey(data.key, this.env.PC_REFEREE_KEY))) return ws.close(4001, 'Wrong key');
      // One PC at a time: a new connection replaces an old one.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && other.deserializeAttachment()?.ok) other.close(4000, 'Replaced');
      }
      ws.serializeAttachment({ ok: true, paused: false, at: Date.now(), seen: Date.now(), model: String(data.model || '').slice(0, 60) });
      ws.send(JSON.stringify({ type: 'ready' }));
      return;
    }
    if (data.type === 'pause' || data.type === 'resume') {
      ws.serializeAttachment({ ...state, paused: data.type === 'pause', seen: Date.now() });
      ws.send(JSON.stringify({ type: data.type === 'pause' ? 'paused' : 'resumed' }));
      return;
    }
    if (data.type === 'result' && typeof data.id === 'string') {
      ws.serializeAttachment({ ...state, seen: Date.now(), slowUntil: 0 });
      const job = this.pending.get(data.id);
      if (!job) return; // too late: that check already went to Cloudflare
      this.pending.delete(data.id);
      job.resolve(typeof data.text === 'string'
        ? { text: data.text.slice(0, 4000), ms: Number(data.ms) || null }
        : { error: String(data.error || 'No answer').slice(0, 200) });
    }
  }

  async webSocketClose(ws, code) {
    this.dropJobs(ws, `PC disconnected (${code})`);
    try {
      ws.close(code, 'Closed');
    } catch {
      // Already closed.
    }
  }

  async webSocketError(ws) {
    this.dropJobs(ws, 'PC connection error');
  }

  dropJobs(ws, why) {
    for (const [id, job] of this.pending) {
      if (job.ws !== ws) continue;
      this.pending.delete(id);
      job.resolve({ error: why });
    }
  }

  // The connected PC, if it's there, not paused, and not just timed out.
  pc() {
    const now = Date.now();
    return this.ctx.getWebSockets().find((ws) => {
      const state = ws.deserializeAttachment();
      if (!state?.ok || state.paused || now < (state.slowUntil || 0)) return false;
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
      return now - Math.max(pinged, state.seen || 0) < SILENT_MS;
    });
  }

  // Called by the referee (shared.js). Resolves to { text, ms } with the model's reply,
  // { offline: true } when no PC can take it, or { error } when it failed or took too long.
  async ask(messages) {
    const ws = this.pc();
    if (!ws) return { offline: true };
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        try {
          ws.serializeAttachment({ ...ws.deserializeAttachment(), slowUntil: Date.now() + SLOW_PAUSE_MS });
        } catch {
          // The socket closed meanwhile.
        }
        resolve({ error: 'Timed out' });
      }, JOB_TIMEOUT_MS);
      this.pending.set(id, { ws, resolve: (value) => { clearTimeout(timer); resolve(value); } });
      try {
        ws.send(JSON.stringify({ type: 'job', id, messages }));
      } catch {
        this.pending.get(id)?.resolve({ error: 'Couldn’t send' });
        this.pending.delete(id);
      }
    });
  }

  // For checking from this PC's tests: is a PC connected, and is it paused?
  async status() {
    const ws = this.ctx.getWebSockets().find((socket) => socket.deserializeAttachment()?.ok);
    const state = ws?.deserializeAttachment();
    return { connected: Boolean(ws), ready: Boolean(this.pc()), paused: Boolean(state?.paused), model: state?.model || null };
  }
}

// Compares the key in constant time, so its length and contents can't be guessed from timing. A key
// shorter than the minimum never matches, so a missing or too-short secret locks everyone out.
// The dashboard (dashboard.js) checks its password with this too.
export async function sameKey(given, expected, minimum = 16) {
  if (typeof given !== 'string' || typeof expected !== 'string' || expected.trim().length < minimum) return false;
  const encode = (text) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim()));
  const [a, b] = await Promise.all([encode(given), encode(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}
