"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPoolConfig = buildPoolConfig;
exports.logPoolTarget = logPoolTarget;
exports.connectDatabase = connectDatabase;
exports.query = query;
const node_fs_1 = require("node:fs");
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/** Im Docker-Image darf DATABASE_URL nicht auf localhost zeigen (das ist der Backend-Container). */
function effectiveDatabaseUrl() {
    const raw = (process.env.DATABASE_URL || '').trim();
    if (!raw)
        return '';
    const inDocker = (0, node_fs_1.existsSync)('/.dockerenv');
    if (inDocker && /\b(localhost|127\.0\.0\.1)\b/i.test(raw)) {
        console.warn('[db] DATABASE_URL verweist auf localhost — im Container ungueltig. Verwende POSTGRES_* (Host z. B. db).');
        return '';
    }
    return raw;
}
function buildPoolConfig() {
    var _a;
    const conn = effectiveDatabaseUrl();
    if (conn) {
        return {
            connectionString: conn,
            connectionTimeoutMillis: 15000,
            max: 10,
            idleTimeoutMillis: 30000,
        };
    }
    const host = (process.env.POSTGRES_HOST || 'db').trim() || 'db';
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10) || 5432;
    const user = (process.env.POSTGRES_USER || 'postgres').trim() || 'postgres';
    const database = (process.env.POSTGRES_DB || 'kita_planer').trim() || 'kita_planer';
    const password = (_a = process.env.POSTGRES_PASSWORD) !== null && _a !== void 0 ? _a : 'postgres';
    return {
        host,
        port,
        user,
        database,
        password,
        connectionTimeoutMillis: 15000,
        max: 10,
        idleTimeoutMillis: 30000,
    };
}
function logPoolTarget() {
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
let pool = null;
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
function connectDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        if (pool) {
            return;
        }
        let lastErr;
        for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
            const p = new pg_1.Pool(buildPoolConfig());
            let client;
            let success = false;
            try {
                console.log(`[db] Verbindungsversuch ${attempt}/${MAX_CONNECT_ATTEMPTS}…`);
                client = yield p.connect();
                yield client.query('SELECT 1 AS ok');
                yield client.query(INIT_TABLE);
                yield client.query(INIT_IDX_CREATED);
                yield client.query(INIT_IDX_OFFER_ID);
                pool = p;
                success = true;
                console.log('[db] PostgreSQL verbunden, Schema bereit.');
            }
            catch (err) {
                lastErr = err;
                console.error(`[db] Fehler (Versuch ${attempt}/${MAX_CONNECT_ATTEMPTS}):`, err);
            }
            finally {
                client === null || client === void 0 ? void 0 : client.release();
            }
            if (success) {
                return;
            }
            yield p.end().catch(() => { });
            if (attempt < MAX_CONNECT_ATTEMPTS) {
                yield new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            }
        }
        throw lastErr instanceof Error
            ? lastErr
            : new Error('[db] Keine Verbindung zu PostgreSQL nach allen Versuchen.');
    });
}
function query(text, params) {
    if (!pool) {
        throw new Error('Database not connected');
    }
    return pool.query(text, params);
}
