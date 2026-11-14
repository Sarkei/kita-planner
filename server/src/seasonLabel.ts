/** Gleiche Jahreszeiten-Labels wie im Frontend (Library). */
export function seasonPeriodFromOfferData(data: unknown, createdAt: Date): string {
  const o = data as { savedAt?: unknown };
  const t =
    typeof o?.savedAt === 'number' && Number.isFinite(o.savedAt)
      ? o.savedAt
      : createdAt.getTime();
  const date = new Date(t);
  const month = date.getMonth();
  const year = date.getFullYear();

  let season = '';
  if (month === 11 || month === 0 || month === 1) {
    season = 'Winter';
  } else if (month >= 2 && month <= 4) {
    season = 'Frühling';
  } else if (month >= 5 && month <= 7) {
    season = 'Sommer';
  } else {
    season = 'Herbst';
  }
  return `${season} ${year}`;
}

/** WHERE-Fragment für Postgres; bezieht sich auf offers.created_at (Annäherung wie Label aus savedAt). */
export function buildSeasonPeriodSql(
  period: string,
  paramIndex: number,
): { clause: string; values: unknown[] } | null {
  const m2 = period.match(/^(Winter|Frühling|Sommer|Herbst)\s+(\d{4})$/);
  if (!m2) return null;
  const season = m2[1];
  const y = parseInt(m2[2], 10);
  const yp = `$${paramIndex}`;
  if (season === 'Frühling') {
    return {
      clause: `(EXTRACT(YEAR FROM created_at) = ${yp}::int AND EXTRACT(MONTH FROM created_at) IN (3,4,5))`,
      values: [y],
    };
  }
  if (season === 'Sommer') {
    return {
      clause: `(EXTRACT(YEAR FROM created_at) = ${yp}::int AND EXTRACT(MONTH FROM created_at) IN (6,7,8))`,
      values: [y],
    };
  }
  if (season === 'Herbst') {
    return {
      clause: `(EXTRACT(YEAR FROM created_at) = ${yp}::int AND EXTRACT(MONTH FROM created_at) IN (9,10,11))`,
      values: [y],
    };
  }
  return {
    clause: `((EXTRACT(YEAR FROM created_at) = ${yp}::int AND EXTRACT(MONTH FROM created_at) = 12) OR (EXTRACT(YEAR FROM created_at) = ${yp}::int AND EXTRACT(MONTH FROM created_at) IN (1,2)))`,
    values: [y],
  };
}
