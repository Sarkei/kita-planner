import type { Request } from 'express';
import { buildSeasonPeriodSql } from './seasonLabel';

/**
 * Filter der Bibliothek. `ownerEmail` ist gesetzt, wenn ein gültiger Demo-Token
 * mitgeschickt wurde; dann sieht der Aufrufer ausschließlich Demo-Zeilen.
 * Ohne Token bleiben Demo-Zeilen unsichtbar (`owner_email IS NULL` = echte Instanz).
 */
export function buildOfferFilters(
  req: Request,
  ownerEmail: string | null = null,
): { whereSql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (ownerEmail) {
    conditions.push(`owner_email = $${i}`);
    params.push(ownerEmail);
    i++;
  } else {
    conditions.push('owner_email IS NULL');
  }

  const q = String(req.query.q || '').trim();
  if (q) {
    const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    conditions.push(`data::text ILIKE $${i} ESCAPE '\\'`);
    params.push(`%${escaped}%`);
    i++;
  }

  const category = String(req.query.category || '').trim();
  if (category && category !== 'all') {
    conditions.push(`data->'input'->>'category' = $${i}`);
    params.push(category);
    i++;
  }

  const period = String(req.query.period || '').trim();
  if (period && period !== 'all') {
    const s = buildSeasonPeriodSql(period, i);
    if (s) {
      conditions.push(s.clause);
      params.push(...s.values);
      i += s.values.length;
    }
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  return { whereSql, params };
}
