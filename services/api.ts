import { SavedOffer } from '../types';

/** Relatives `/api`: Dev (Vite-Proxy) + Docker-Nginx; sonst `VITE_API_URL` setzen. */
const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_URL = (raw?.replace(/\/$/, '') || '/api') as string;

/** Basis für alle API-Aufrufe — auch der KI-Proxy hängt hierunter. */
export const API_BASE = API_URL;

/** Während Container-Start: kurze 503-Retries (Backend sollte keinen Dauer-503 mehr senden). */
const SOFT_RETRY_MAX = 10;
const SOFT_RETRY_DELAY_MS = 400;
/** Transiente 502/504 (Proxy/Cloudflare/Backend-Neustart). */
const BAD_GATEWAY_MAX_ATTEMPTS = 5;
const BAD_GATEWAY_DELAY_MS = 1500;

async function fetchUntilReady(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let g = 0; g < BAD_GATEWAY_MAX_ATTEMPTS; g++) {
    let last: Response | null = null;
    for (let a = 0; a < SOFT_RETRY_MAX; a++) {
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const res = await fetch(input, init);
      last = res;
      if (res.status === 503) {
        await new Promise((r) => setTimeout(r, SOFT_RETRY_DELAY_MS));
        continue;
      }
      if (res.status === 502 || res.status === 504) {
        break;
      }
      return res;
    }
    if (!last || (last.status !== 502 && last.status !== 504)) {
      return last ?? new Response(null, { status: 503, statusText: 'Service Unavailable' });
    }
    await new Promise((r) => setTimeout(r, BAD_GATEWAY_DELAY_MS));
  }
  return new Response(null, { status: 502, statusText: 'Bad Gateway' });
}

async function parseJsonOrThrow(response: Response, label: string): Promise<unknown> {
  const body = await response.text();
  const detail = body.slice(0, 480);
  if (!response.ok) {
    throw new Error(
      `${label}: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`,
    );
  }
  const t = body.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`${label}: Ungültige JSON-Antwort — ${t.slice(0, 200)}`);
  }
}

export type OffersFilters = {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  period?: string;
};

let metaCache: { data: OffersMeta; ts: number } | null = null;
const META_TTL_MS = 15_000;

export type OffersMeta = { total: number; periods: string[] };

export const api = {
  getOffersMeta: async (): Promise<OffersMeta> => {
    if (metaCache && Date.now() - metaCache.ts < META_TTL_MS) return metaCache.data;
    const response = await fetchUntilReady(`${API_URL}/offers/meta`);
    const data = (await parseJsonOrThrow(response, 'offers meta')) as OffersMeta;
    metaCache = { data, ts: Date.now() };
    return data;
  },

  invalidateMetaCache: () => {
    metaCache = null;
  },

  getOffers: async (
    opts: OffersFilters = {},
  ): Promise<{ offers: SavedOffer[]; total: number; page: number; totalPages: number }> => {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 24;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const qq = (opts.q || '').trim();
    if (qq) params.set('q', qq);
    if (opts.category && opts.category !== 'all') params.set('category', opts.category);
    if (opts.period && opts.period !== 'all') params.set('period', opts.period);

    const response = await fetchUntilReady(`${API_URL}/offers?${params.toString()}`);
    return (await parseJsonOrThrow(response, 'offers')) as {
      offers: SavedOffer[];
      total: number;
      page: number;
      totalPages: number;
    };
  },

  saveOffer: async (offer: SavedOffer, signal?: AbortSignal): Promise<SavedOffer> => {
    const response = await fetchUntilReady(`${API_URL}/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(offer),
      signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save offer: ${response.status} ${response.statusText} - ${errorText}`);
    }
    api.invalidateMetaCache();
    const data = await response.json();
    return data as SavedOffer;
  },

  deleteOffer: async (id: string): Promise<void> => {
    const response = await fetchUntilReady(`${API_URL}/offers/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete offer');
    api.invalidateMetaCache();
  },
};
