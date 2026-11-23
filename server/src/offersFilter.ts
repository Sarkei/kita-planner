import type { Request } from 'express';
import { buildSeasonPeriodSql } from './seasonLabel';

export function buildOfferFilters(req: Request): { whereSql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

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

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}
