import { OfferInput, OfferCategory, OfferData } from '../types';
import { normalizeAiPreparation } from '../utils/preparationFormat';
import { API_BASE } from './api';

/**
 * Alle KI-Aufrufe laufen über den eigenen Server (`/api/ai/*`). Der Mistral-Schlüssel
 * liegt ausschließlich im Container — im Browser ist er weder sichtbar noch nutzbar.
 * Die Modellnamen setzt der Server aus seiner Umgebung.
 */
const AI_BASE = `${API_BASE}/ai`;

/** Vom Server gemeldeter Zustand, beim App-Start einmal abgefragt. */
let aiReady = true;
let aiStatusLoaded = false;

export function isMistralConfigured(): boolean {
  return aiReady;
}

export async function refreshAiStatus(): Promise<boolean> {
  try {
    const resp = await fetch(`${AI_BASE}/status`);
    if (!resp.ok) throw new Error(String(resp.status));
    const data = (await resp.json()) as { configured?: boolean };
    aiReady = Boolean(data.configured);
    aiStatusLoaded = true;
  } catch {
    if (!aiStatusLoaded) aiReady = true;
  }
  return aiReady;
}

type MistralChatMsg = { role: string; content: string };

async function mistralChatJson(messages: MistralChatMsg[]): Promise<{ text: string; totalTokens: number }> {
  const resp = await fetch(`${AI_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Mistral error ${resp.status}: ${txt}`);
  }

  const data = (await resp.json()) as {
    choices?: [{ message?: { content?: string } }];
    usage?: { total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  const totalTokens = data.usage?.total_tokens ?? 0;
  if (!text) throw new Error('Leere Mistral-Antwort');
  return { text, totalTokens };
}

function stripJsonFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return t;
}

function collectToolFileIds(node: unknown, out: Set<string>): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const x of node) collectToolFileIds(x, out);
    return;
  }
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    const t = o.type;
    const fid = o.file_id;
    if (typeof fid === 'string' && (t === 'tool_file' || o.tool === 'image_generation')) out.add(fid);
    for (const k of Object.keys(o)) collectToolFileIds(o[k], out);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

async function downloadMistralFileAsDataUrl(fileId: string): Promise<string | null> {
  const resp = await fetch(`${AI_BASE}/files/${encodeURIComponent(fileId)}/content`);
  if (!resp.ok) {
    console.error('Mistral file download failed', resp.status, await resp.text());
    return null;
  }
  const buf = await resp.arrayBuffer();
  const ct = resp.headers.get('content-type') || 'image/png';
  const b64 = arrayBufferToBase64(buf);
  return `data:${ct};base64,${b64}`;
}

function digErrorMessage(v: unknown, depth = 0): string | null {
  if (v == null || depth > 6) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (v instanceof Error && v.message.trim()) return v.message.trim();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const msg = o.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    const err = o.error;
    if (err) {
      const inner = digErrorMessage(err, depth + 1);
      if (inner) return inner;
    }
    const details = o.details;
    if (details) {
      const inner = digErrorMessage(details, depth + 1);
      if (inner) return inner;
    }
    const status = o.status;
    const code = o.code;
    if (status || code) {
      const parts = [
        typeof code === 'string' || typeof code === 'number' ? String(code) : null,
        typeof status === 'string' ? status : null,
      ].filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
  }
  return null;
}

/** Lesbare Meldung für UI/Toast. */
export function describeGenerationError(err: unknown): string {
  const raw = digErrorMessage(err, 0);
  const base =
    raw || (typeof err === 'string' ? err : 'Unbekannter Fehler bei der Mistral-Anfrage.');
  const hintParts: string[] = [];
  if (/MISTRAL_API_KEY|API[_-]?key|API key|401|403|invalid|unauthori|forbidden|leaked|blocked/i.test(base)) {
    hintParts.push(
      'API-Schlüssel in der Mistral-Konsole prüfen (https://console.mistral.ai/) — Berechtigung und Guthaben.',
    );
  }
  if (/not found|NOT_FOUND|unsupported|404|model|unknown model/i.test(base)) {
    hintParts.push(
      'Modell prüfen: MISTRAL_TEXT_MODEL bzw. MISTRAL_IMAGE_CONVERSATION_MODEL in der .env des Servers, danach Container neu starten.',
    );
  }
  if (/quota|429|rate|limit|too many/i.test(base)) {
    hintParts.push('Kontingent/Rate-Limit: später erneut versuchen oder Abrechnung prüfen.');
  }
  const hint = hintParts.length ? ` ${hintParts.join(' ')}` : '';
  return `${base}${hint}`.trim();
}

// --- Usage Tracking ---
const STORAGE_KEY = 'mistral_api_usage_daily';
export const API_DAILY_LIMIT = 1500;

const getStoredUsage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { count: 0, tokens: 0 };
    const { date, count, tokens } = JSON.parse(stored);
    if (date !== new Date().toDateString()) return { count: 0, tokens: 0 };
    return { count: count || 0, tokens: tokens || 0 };
  } catch {
    return { count: 0, tokens: 0 };
  }
};

let apiUsage = getStoredUsage();

export const getApiUsage = () => apiUsage;
export const getApiUsageCount = () => apiUsage.count;

const incrementUsage = (tokenCount: number = 0) => {
  apiUsage.count++;
  apiUsage.tokens += tokenCount;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      date: new Date().toDateString(),
      count: apiUsage.count,
      tokens: apiUsage.tokens,
    }),
  );
};

// --- Generation ---

export const generateOfferText = async (input: OfferInput): Promise<Partial<OfferData>> => {
  if (!isMistralConfigured()) {
    throw new Error(
      'Der Server hat keinen Mistral-Schlüssel: in der .env des Servers MISTRAL_API_KEY setzen und den Container neu starten.',
    );
  }

  const isKamishibai = input.category === OfferCategory.KAMISHIBAI;

  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const topicInstruction = input.topic.trim()
    ? `Thema: ${input.topic}.`
    : `Thema: Du (die KI) sollst dir selbst ein pädagogisch wertvolles Thema ausdenken, das perfekt zum heutigen Datum (${dateString}) und der aktuellen Jahreszeit passt. Berücksichtige aktuelle Feste, Wetter oder Naturphänomene.`;

  const languageInstruction = input.isBilingual
    ? 'Die Ausgabe soll zweisprachig (Deutsch und Englisch) sein, wo sinnvoll (z.B. Vokabeln, Titel). Die Hauptanleitungen auf Deutsch.'
    : 'Die Ausgabe soll komplett auf Deutsch sein.';

  if (isKamishibai) {
    const userBody = `
Erstelle eine Kamishibai-Geschichte für Kinder (${input.targetGroup}).
${topicInstruction}
${languageInstruction}
Die Geschichte sollte 8 bis 12 Szenen haben.
Die Bildbeschreibungen (imagePrompt) müssen sehr detailliert sein und den Stil 'Kinderbuch-Illustration, Aquarell, freundlich' beschreiben.

Antwortformat: NUR ein JSON-Objekt (ohne Markdown), exakt mit diesen Keys:
- title: string
- goals: string[]
- scenes: Array von Objekten mit sceneNumber (number), imagePrompt (string), storyText (string)
`.trim();

    const messages: MistralChatMsg[] = [
      {
        role: 'system',
        content:
          'Du bist ein erfahrener Pädagoge und Geschichtenerzähler für Kinder. Du antwortest ausschließlich mit gültigem JSON gemäß den Benutzeranweisungen.',
      },
      { role: 'user', content: userBody },
    ];

    let textOut: string;
    try {
      const r = await mistralChatJson(messages);
      textOut = r.text;
      incrementUsage(r.totalTokens);
    } catch (e) {
      console.error('Mistral Kamishibai failed:', e);
      throw new Error(describeGenerationError(e));
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(stripJsonFences(textOut)) as Record<string, unknown>;
    } catch (e) {
      console.error('Kamishibai JSON parse failed', textOut?.slice?.(0, 500), e);
      throw new Error('Antwort war kein gültiges JSON (Kamishibai).');
    }

    return {
      title: data.title as string,
      goals: data.goals as string[],
      kamishibaiScenes: data.scenes as OfferData['kamishibaiScenes'],
      materials: [{ item: 'Kamishibai-Erzähltheater (Rahmen)' }, { item: 'Bildkarten (gedruckt)' }],
      preparation:
        'Bilder ausdrucken und in der richtigen Reihenfolge bereitlegen. Raum abdunkeln, gemütliche Atmosphäre schaffen.',
      steps: [],
    };
  }

  const userBody = `
Erstelle einen pädagogischen Ablaufplan.
${topicInstruction}
Kategorie: ${input.category}
Zielgruppe: ${input.targetGroup}
Dauer: ${input.duration}
${input.groupSize ? `Gruppengröße: ca. ${input.groupSize} Kinder` : ''}
${languageInstruction}

Formuliere die pädagogischen Ziele professionell (wie für einen Bildungsplan).
Wenn die Kategorie 'Basteln' ist, sorge dafür, dass die imagePrompt Felder in den steps visuelle Anweisungen enthalten.

Antwortformat: NUR ein JSON-Objekt (ohne Markdown), exakt mit diesen Keys:
- title: string
- materials: Array von { item: string, amount?: string|null }
- goals: string[]
- preparation: mehrzeiliger string — nur nummerierte Vorbereitungsschritte; genau ein Schritt pro Zeile, jede Zeile beginnt mit "N. " (z. B. "1. ...\\n2. ...\\n3. ..."). Kein Fließtext in einer Zeile mit mehreren "N."-Punkten.
- steps: Array von { step: number, instruction: string, imagePrompt: string }
`.trim();

  const messages: MistralChatMsg[] = [
    {
      role: 'system',
      content:
        'Du bist ein erfahrener Pädagoge. Erstelle strukturierte, sichere und altersgerechte Angebote. Du antwortest ausschließlich mit gültigem JSON gemäß den Benutzeranweisungen.',
    },
    { role: 'user', content: userBody },
  ];

  let textOut: string;
  try {
    const r = await mistralChatJson(messages);
    textOut = r.text;
    incrementUsage(r.totalTokens);
  } catch (e) {
    console.error('Mistral Angebot failed:', e);
    throw new Error(describeGenerationError(e));
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stripJsonFences(textOut)) as Record<string, unknown>;
  } catch (e) {
    console.error('Angebot JSON parse failed', textOut?.slice?.(0, 500), e);
    throw new Error('Antwort war kein gültiges JSON.');
  }

  return {
    title: data.title as string,
    materials: data.materials as OfferData['materials'],
    goals: data.goals as string[],
    preparation: normalizeAiPreparation(data.preparation),
    steps: data.steps as OfferData['steps'],
  };
};

export const generateIllustration = async (
  prompt: string,
  aspectRatio: '1:1' | '4:3' | '16:9' = '1:1',
): Promise<string | null> => {
  if (!isMistralConfigured()) return null;

  const arHint =
    aspectRatio === '4:3'
      ? 'Komposition eher quer (4:3).'
      : aspectRatio === '16:9'
        ? 'Breitbild (16:9).'
        : 'Quadratische Komposition (1:1).';

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(`${AI_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tools: [{ type: 'image_generation' }],
          instructions:
            'Wenn der Nutzer eine Illustration möchte, rufe genau einmal das Tool image_generation auf. Keine reine Textbeschreibung statt Bild.',
          inputs: `${arHint}\n\nErzeuge genau eine Kinderbuch-/Aquarell-Illustration (freundlich, ohne Text im Bild):\n\n${prompt}`,
          stream: false,
          completion_args: { temperature: 0.35, top_p: 0.95 },
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Mistral conversations ${resp.status}: ${txt}`);
      }

      const data = (await resp.json()) as { outputs?: unknown };
      const ids = new Set<string>();
      collectToolFileIds(data.outputs, ids);
      collectToolFileIds(data, ids);

      incrementUsage(0);

      for (const fileId of ids) {
        const url = await downloadMistralFileAsDataUrl(fileId);
        if (url) return url;
      }

      console.warn(`Mistral image: attempt ${attempt}: no tool_file/file_id in response`, data);
    } catch (error) {
      console.error(`Mistral image generation failed (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) return null;
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
};
