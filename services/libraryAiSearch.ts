import { SavedOffer } from '../types';
import { API_BASE } from './api';
import { isMistralConfigured } from './mistralService';

/** Läuft über den Server-Proxy — kein Schlüssel im Browser. */
const CHAT_URL = `${API_BASE}/ai/chat`;

type IdRow = { id: string; title: string; category: string; topic: string; goals: string; text: string };

function summarize(o: SavedOffer): IdRow {
  const goals = (o.goals || []).slice(0, 4).join(' · ');
  const stepBits = (o.steps || [])
    .slice(0, 3)
    .map((s) => s.instruction)
    .join(' ');
  const kam = (o.kamishibaiScenes || [])
    .slice(0, 2)
    .map((s) => s.storyText)
    .join(' ');
  const text = [o.preparation, stepBits, kam].filter(Boolean).join(' ').slice(0, 450);
  return {
    id: o.id,
    title: o.title,
    category: o.input?.category ?? '',
    topic: o.input?.topic || '',
    goals,
    text,
  };
}

/** Natürliche Sprache → passende Angebots-IDs (Reihenfolge = Relevanz). */
export async function semanticLibraryRank(
  userQuery: string,
  offers: SavedOffer[],
): Promise<string[]> {
  const q = userQuery.trim();
  if (!q || !isMistralConfigured() || offers.length === 0) {
    return offers.map((o) => o.id);
  }

  const max = 52;
  const rows = offers.slice(0, max).map(summarize);

  const payload = {
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Du hilfst bei der Suche in einer Kita-Angebots-Bibliothek. Antworte NUR mit gültigem JSON: {"ids":["…"]} — eine Liste der passenden Angebots-IDs in absteigender Relevanz. Nur IDs aus der Tabelle verwenden. Wenn nichts passt: leeres ids-Array.',
      },
      {
        role: 'user',
        content: `Suchanfrage (Deutsch): ${q}\n\nAngebote (JSON):\n${JSON.stringify(rows)}`,
      },
    ],
  };

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    console.warn('semanticLibraryRank Mistral error', resp.status, await resp.text());
    return offers.map((o) => o.id);
  }
  const data = (await resp.json()) as { choices?: [{ message?: { content?: string } }] };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return offers.map((o) => o.id);
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  let parsed: { ids?: unknown };
  try {
    parsed = JSON.parse(t) as { ids?: unknown };
  } catch {
    return offers.map((o) => o.id);
  }
  const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((x): x is string => typeof x === 'string') : [];
  const allowed = new Set(offers.map((o) => o.id));
  const ordered = ids.filter((id) => allowed.has(id));
  const rest = offers.map((o) => o.id).filter((id) => !ordered.includes(id));
  return [...ordered, ...rest];
}

export function orderOffersByIdList(offers: SavedOffer[], idsInOrder: string[]): SavedOffer[] {
  const map = new Map(offers.map((o) => [o.id, o] as const));
  const out: SavedOffer[] = [];
  for (const id of idsInOrder) {
    const o = map.get(id);
    if (o) out.push(o);
  }
  return out;
}
