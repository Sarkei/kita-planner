/**
 * KI liefert "Vorbereitung" oft als einen zusammenhängenden Absatz (1. … 2. …).
 * Hier: zuverlässige Zeilenumbrüche + Darstellung als einzelne Punkte.
 */

function coalesceNumberedRunOn(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n').trim();
  if (!t) return t;
  t = t.replace(/;\s*(?=\d+\.\s)/g, '\n');
  t = t.replace(/(?<=[^\n])\s+(?=\d{1,2}\.\s+[A-ZÄÖÜa-zÄöüß])/g, '\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/** Aus Mistral-JSON: String oder aus Versehen string[]. */
export function normalizeAiPreparation(raw: unknown): string {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    const lines = raw
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    return lines
      .map((line, i) => ( /^\d+\.\s/.test(line) ? line : `${i + 1}. ${line}`))
      .join('\n');
  }
  if (typeof raw !== 'string') return '';
  return coalesceNumberedRunOn(raw);
}

/** Für UI/PDF: einzelne Punkte ohne führende "N." (wird als <ol> gerendert). */
export function preparationItemsForList(text: string): string[] {
  return normalizeAiPreparation(text)
    .split(/\n+/)
    .map((s) => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
}
