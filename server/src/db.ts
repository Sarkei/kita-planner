import { existsSync } from 'node:fs';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/** Im Docker-Image darf DATABASE_URL nicht auf localhost zeigen (das ist der Backend-Container). */
function effectiveDatabaseUrl(): string {
  const raw = (process.env.DATABASE_URL || '').trim();
  if (!raw) return '';
  const inDocker = existsSync('/.dockerenv');
  if (inDocker && /\b(localhost|127\.0\.0\.1)\b/i.test(raw)) {
    console.warn(
      '[db] DATABASE_URL verweist auf localhost — im Container ungueltig. Verwende POSTGRES_* (Host z. B. db).',
    );
    return '';
  }
  return raw;
}

export function buildPoolConfig(): PoolConfig {
  const conn = effectiveDatabaseUrl();
  if (conn) {
    return {
      connectionString: conn,
      connectionTimeoutMillis: 15_000,
      max: 10,
      idleTimeoutMillis: 30_000,
    };
  }

  const host = (process.env.POSTGRES_HOST || 'db').trim() || 'db';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10) || 5432;
  const user = (process.env.POSTGRES_USER || 'postgres').trim() || 'postgres';
  const database = (process.env.POSTGRES_DB || 'kita_planer').trim() || 'kita_planer';
  const password = process.env.POSTGRES_PASSWORD ?? 'postgres';

  return {
    host,
    port,
    user,
    database,
    password,
    connectionTimeoutMillis: 15_000,
    max: 10,
    idleTimeoutMillis: 30_000,
  };
}

export function logPoolTarget(): void {
  if (effectiveDatabaseUrl()) {
    console.log('[db] Modus: DATABASE_URL (Details nicht geloggt).');
    return;
  }
  const host = (process.env.POSTGRES_HOST || 'db').trim() || 'db';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10) || 5432;
  const user = (process.env.POSTGRES_USER || 'postgres').trim() || 'postgres';
  const database = (process.env.POSTGRES_DB || 'kita_planer').trim() || 'kita_planer';
  console.log(`[db] Postgres: host=${host} port=${port} db=${database} user=${user}`);
}

let pool: Pool | null = null;

const INIT_TABLE = `
  CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    offer_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data JSONB NOT NULL
  );
`;

const INIT_IDX_CREATED = `CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers(created_at DESC);`;
const INIT_IDX_OFFER_ID = `CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_offer_id ON offers(offer_id);`;

const MAX_CONNECT_ATTEMPTS = 25;
const RETRY_DELAY_MS = 2500;

/**
 * Verbindet zu Postgres und legt das Schema an.
 * Wird VOR app.listen() ausgefuehrt — es gibt keinen separaten „Service starting“-503 mehr.
 */
export async function connectDatabase(): Promise<void> {
  if (pool) {
    return;
  }

  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    const p = new Pool(buildPoolConfig());
    let client: PoolClient | undefined;
    let success = false;

    try {
      console.log(`[db] Verbindungsversuch ${attempt}/${MAX_CONNECT_ATTEMPTS}…`);
      client = await p.connect();
      await client.query('SELECT 1 AS ok');
      await client.query(INIT_TABLE);
      await client.query(INIT_IDX_CREATED);
      await client.query(INIT_IDX_OFFER_ID);
      pool = p;
      success = true;
      console.log('[db] PostgreSQL verbunden, Schema bereit.');
    } catch (err) {
      lastErr = err;
      console.error(`[db] Fehler (Versuch ${attempt}/${MAX_CONNECT_ATTEMPTS}):`, err);
    } finally {
      client?.release();
    }

    if (success) {
      return;
    }

    await p.end().catch(() => {});
    if (attempt < MAX_CONNECT_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('[db] Keine Verbindung zu PostgreSQL nach allen Versuchen.');
}

export function query(text: string, params?: unknown[]) {
  if (!pool) {
    throw new Error('Database not connected');
  }
  return pool.query(text, params);
}
