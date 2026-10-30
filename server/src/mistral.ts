import { Router, type Request, type Response } from 'express';

/**
 * Serverseitiger Proxy für die Mistral-API.
 *
 * Früher lag der API-Schlüssel im Browser (in index.html injiziert) — jeder Besucher
 * konnte ihn aus dem Quelltext lesen und auf Tims Kosten nutzen. Jetzt spricht nur noch
 * der Server mit Mistral; der Schlüssel verlässt den Container nicht.
 */

const KEY = (process.env.MISTRAL_API_KEY || '').trim();
const BASE = (process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai').trim().replace(/\/$/, '');

const TEXT_MODEL = (process.env.MISTRAL_TEXT_MODEL || 'mistral-large-latest').trim();
const IMAGE_MODEL = (process.env.MISTRAL_IMAGE_CONVERSATION_MODEL || 'mistral-medium-latest').trim();

/** Deckel gegen Missbrauch, falls die Adresse öffentlich erreichbar ist. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = parseInt(process.env.AI_RATE_LIMIT_PER_HOUR || '120', 10) || 120;
const hits = new Map<string, { count: number; first: number }>();

function takeToken(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    hits.set(ip, { count: 1, first: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

// Aufräumen, damit die Map bei langer Laufzeit nicht wächst
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now - e.first > WINDOW_MS) hits.delete(ip);
}, 10 * 60 * 1000).unref();

function guard(req: Request, res: Response): boolean {
  if (!KEY) {
    res.status(503).json({
      error:
        'MISTRAL_API_KEY fehlt auf dem Server. In der .env setzen und den Container neu starten.',
    });
    return false;
  }
  const ip = (req.ip || 'unknown').toString();
  if (!takeToken(ip)) {
    res.status(429).json({ error: 'Zu viele Anfragen — bitte in einer Stunde erneut' });
    return false;
  }
  return true;
}

/** Antwort von Mistral unverändert weitergeben, Fehler gekürzt (kein Schlüssel im Log). */
async function forward(
  res: Response,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number },
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const upstream = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${KEY}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });

    const raw = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') || 'application/json';
    if (!upstream.ok) {
      const text = raw.toString('utf8').slice(0, 600).replace(/Bearer\s+\S+/gi, 'Bearer ***');
      console.error(`[mistral] ${path} -> ${upstream.status}: ${text.slice(0, 200)}`);
      res
        .status(upstream.status >= 500 ? 502 : upstream.status)
        .json({ error: `Mistral: ${upstream.status}`, detail: text });
      return;
    }
    res.status(200).type(type).send(raw);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error('[mistral]', path, aborted ? 'Timeout' : err);
    res
      .status(aborted ? 504 : 502)
      .json({ error: aborted ? 'Mistral hat nicht rechtzeitig geantwortet' : 'Mistral nicht erreichbar' });
  } finally {
    clearTimeout(timer);
  }
}

export const mistralRouter = Router();

mistralRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

mistralRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: Boolean(KEY),
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
    rateLimitPerHour: MAX_PER_WINDOW,
  });
});

mistralRouter.post('/chat', (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const body = { ...(req.body as Record<string, unknown>) };
  if (!body.model) body.model = TEXT_MODEL;
  void forward(res, '/v1/chat/completions', { method: 'POST', body, timeoutMs: 180_000 });
});

mistralRouter.post('/conversations', (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const body = { ...(req.body as Record<string, unknown>) };
  if (!body.model) body.model = IMAGE_MODEL;
  void forward(res, '/v1/conversations', { method: 'POST', body, timeoutMs: 240_000 });
});

mistralRouter.get('/files/:id/content', (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const id = String(req.params.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) {
    res.status(400).json({ error: 'Ungültige Datei-ID' });
    return;
  }
  void forward(res, `/v1/files/${encodeURIComponent(id)}/content`, {
    method: 'GET',
    timeoutMs: 60_000,
  });
});
