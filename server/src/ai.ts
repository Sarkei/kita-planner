import { Router, type Request, type Response } from 'express';

/**
 * KI-Proxy: Text und Bilder laufen über den eigenen Server, nie über den Browser.
 *
 * Text kann von DeepSeek (OpenAI-kompatibel) oder Mistral kommen — gewählt über
 * `AI_TEXT_PROVIDER`, bei `auto` gewinnt der Schlüssel, der gesetzt ist (DeepSeek
 * zuerst, weil deutlich günstiger). Bilder kann nur Mistral: die App nutzt dort die
 * Conversations-API mit dem Tool `image_generation`. Fehlt der Mistral-Schlüssel,
 * bleibt das Bild einfach weg, der Text funktioniert weiter.
 */

const pick = (v: string | undefined, fallback = ''): string => (v || fallback).trim();

const DS_KEY = pick(process.env.DEEPSEEK_API_KEY);
const DS_BASE = pick(process.env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com/v1').replace(/\/$/, '');
const DS_MODEL = pick(process.env.DEEPSEEK_TEXT_MODEL, 'deepseek-chat');

const MI_KEY = pick(process.env.MISTRAL_API_KEY);
const MI_BASE = pick(process.env.MISTRAL_BASE_URL, 'https://api.mistral.ai').replace(/\/$/, '');
const MI_TEXT_MODEL = pick(process.env.MISTRAL_TEXT_MODEL, 'mistral-large-latest');
const MI_IMAGE_MODEL = pick(process.env.MISTRAL_IMAGE_CONVERSATION_MODEL, 'mistral-medium-latest');

const PROVIDER_SETTING = pick(process.env.AI_TEXT_PROVIDER, 'auto').toLowerCase();

function resolveTextProvider(): 'deepseek' | 'mistral' | null {
  if (PROVIDER_SETTING === 'deepseek') return DS_KEY ? 'deepseek' : null;
  if (PROVIDER_SETTING === 'mistral') return MI_KEY ? 'mistral' : null;
  if (DS_KEY) return 'deepseek';
  if (MI_KEY) return 'mistral';
  return null;
}

const TEXT_PROVIDER = resolveTextProvider();
const TEXT_BASE = TEXT_PROVIDER === 'mistral' ? `${MI_BASE}/v1` : `${DS_BASE}`;
const TEXT_KEY = TEXT_PROVIDER === 'mistral' ? MI_KEY : DS_KEY;
const TEXT_MODEL = TEXT_PROVIDER === 'mistral' ? MI_TEXT_MODEL : DS_MODEL;

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

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now - e.first > WINDOW_MS) hits.delete(ip);
}, 10 * 60 * 1000).unref();

function limit(req: Request, res: Response): boolean {
  const ip = (req.ip || 'unknown').toString();
  if (!takeToken(ip)) {
    res.status(429).json({ error: 'Zu viele Anfragen — bitte in einer Stunde erneut' });
    return false;
  }
  return true;
}

/** Antwort unverändert weitergeben, Fehler gekürzt und ohne Schlüssel im Log. */
async function forward(
  res: Response,
  url: string,
  key: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number },
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const upstream = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });

    const raw = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') || 'application/json';
    if (!upstream.ok) {
      const text = raw.toString('utf8').slice(0, 600).replace(/Bearer\s+\S+/gi, 'Bearer ***');
      console.error(`[ai] ${init.method} ${url.replace(/\?.*$/, '')} -> ${upstream.status}: ${text.slice(0, 200)}`);
      res
        .status(upstream.status >= 500 ? 502 : upstream.status)
        .json({ error: `KI-Dienst: ${upstream.status}`, detail: text });
      return;
    }
    res.status(200).type(type).send(raw);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error('[ai]', url.replace(/\?.*$/, ''), aborted ? 'Timeout' : err);
    res
      .status(aborted ? 504 : 502)
      .json({ error: aborted ? 'Der KI-Dienst hat nicht rechtzeitig geantwortet' : 'KI-Dienst nicht erreichbar' });
  } finally {
    clearTimeout(timer);
  }
}

export const aiRouter = Router();

aiRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

aiRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: Boolean(TEXT_PROVIDER),
    textProvider: TEXT_PROVIDER,
    textModel: TEXT_MODEL,
    imageConfigured: Boolean(MI_KEY),
    imageModel: MI_IMAGE_MODEL,
    rateLimitPerHour: MAX_PER_WINDOW,
  });
});

aiRouter.post('/chat', (req: Request, res: Response) => {
  if (!TEXT_PROVIDER || !TEXT_KEY) {
    res.status(503).json({
      error:
        'Kein Schlüssel für die Textgenerierung auf dem Server. In der .env DEEPSEEK_API_KEY (oder MISTRAL_API_KEY) setzen und den Container neu starten.',
    });
    return;
  }
  if (!limit(req, res)) return;

  const body = { ...(req.body as Record<string, unknown>) };
  if (!body.model) body.model = TEXT_MODEL;
  // DeepSeek mag kein `max_tokens` über dem Modell-Limit; 8000 aus der App ist okay,
  // aber ein explizit gesetztes Feld bleibt unangetastet.
  void forward(res, `${TEXT_BASE}/chat/completions`, TEXT_KEY, {
    method: 'POST',
    body,
    timeoutMs: 180_000,
  });
});

aiRouter.post('/conversations', (req: Request, res: Response) => {
  if (!MI_KEY) {
    res.status(503).json({
      error:
        'Bildgenerierung braucht einen Mistral-Schlüssel (MISTRAL_API_KEY) — DeepSeek kann keine Bilder. Der Text funktioniert ohne.',
    });
    return;
  }
  if (!limit(req, res)) return;

  const body = { ...(req.body as Record<string, unknown>) };
  if (!body.model) body.model = MI_IMAGE_MODEL;
  void forward(res, `${MI_BASE}/v1/conversations`, MI_KEY, {
    method: 'POST',
    body,
    timeoutMs: 240_000,
  });
});

aiRouter.get('/files/:id/content', (req: Request, res: Response) => {
  if (!MI_KEY) {
    res.status(503).json({ error: 'Dateien liegen bei Mistral — kein Mistral-Schlüssel gesetzt.' });
    return;
  }
  if (!limit(req, res)) return;

  const id = String(req.params.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) {
    res.status(400).json({ error: 'Ungültige Datei-ID' });
    return;
  }
  void forward(res, `${MI_BASE}/v1/files/${encodeURIComponent(id)}/content`, MI_KEY, {
    method: 'GET',
    timeoutMs: 60_000,
  });
});
