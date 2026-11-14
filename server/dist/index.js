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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const seasonLabel_1 = require("./seasonLabel");
const offersFilter_1 = require("./offersFilter");
const ai_1 = require("./ai");
const demo_1 = require("./demo");
const webRoot = (process.env.KITAPL_WEB_ROOT || process.env.STATIC_ROOT || '').trim();
const port = (() => {
    var _a;
    const p = parseInt(String((_a = process.env.PORT) !== null && _a !== void 0 ? _a : ''), 10);
    if (!Number.isNaN(p) && p > 0)
        return p;
    return webRoot ? 4466 : 5000;
})();
const app = (0, express_1.default)();
/**
 * Die SPA läuft im selben Prozess wie die API — CORS braucht es nur, wenn ein
 * separater Dev-Server zugreift. Deshalb nur auf ausdrückliche Freigabe öffnen.
 */
const corsOrigin = (process.env.CORS_ORIGIN || '').trim();
if (corsOrigin) {
    app.use((0, cors_1.default)({ origin: corsOrigin.split(',').map((o) => o.trim()) }));
}
app.disable('x-powered-by');
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '1mb', extended: true }));
/**
 * KI-Proxy: eigener Body-Limit, weil hier nur Text und kleine Steuerdaten laufen.
 * Die Schlüssel bleiben ausschließlich im Container.
 */
app.use('/api/ai', express_1.default.json({ limit: '2mb' }), ai_1.aiRouter);
app.get('/api/health', (_req, res) => {
    /** Sobald der Server antwortet, ist die DB verbunden (connectDatabase vor listen). */
    res.status(200).json({ status: 'ok' });
});
/**
 * Anonymer Demo-Zugang: GET oder POST liefert ein frisches Token für das
 * Demo-Konto (demo@example.com). Die App selbst kennt keine Anmeldung — das
 * Token markiert nur den Demo-Datenausschnitt.
 */
function handleDemoLogin(_req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { token, user } = yield (0, demo_1.createDemoSession)();
            res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, displayName: user.name } });
        }
        catch (err) {
            console.error('[api/auth/demo]', err);
            res.status(500).json({ error: 'Demo konnte nicht geladen werden.' });
        }
    });
}
app.get('/api/auth/demo', handleDemoLogin);
app.post('/api/auth/demo', handleDemoLogin);
app.get('/api/auth/me', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield (0, demo_1.demoUserFromRequest)(req);
        if (!user) {
            res.status(401).json({ error: 'Kein gültiger Demo-Token.' });
            return;
        }
        res.json({ user: { id: user.id, email: user.email, name: user.name, displayName: user.name }, demo: true });
    }
    catch (err) {
        console.error('[api/auth/me]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
app.get('/api/offers/meta', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const owner = yield (0, demo_1.demoScopeEmail)(req);
        const countResult = yield (0, db_1.query)('SELECT COUNT(*)::int AS c FROM offers WHERE owner_email IS NOT DISTINCT FROM $1', [owner]);
        const total = countResult.rows[0].c;
        const rows = yield (0, db_1.query)('SELECT created_at FROM offers WHERE owner_email IS NOT DISTINCT FROM $1 ORDER BY created_at DESC LIMIT 1500', [owner]);
        const periods = new Set();
        for (const row of rows.rows) {
            periods.add((0, seasonLabel_1.seasonPeriodFromOfferData)({}, new Date(row.created_at)));
        }
        res.json({
            total,
            periods: Array.from(periods).sort(),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
app.get('/api/offers', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
        let limit = parseInt(String(req.query.limit), 10) || 24;
        limit = Math.min(200, Math.max(1, limit));
        const offset = (page - 1) * limit;
        const { whereSql, params } = (0, offersFilter_1.buildOfferFilters)(req, yield (0, demo_1.demoScopeEmail)(req));
        const lim = params.length + 1;
        const off = params.length + 2;
        const countQuery = `SELECT COUNT(*)::int AS c FROM offers ${whereSql}`;
        const dataQuery = `SELECT data FROM offers ${whereSql} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`;
        const [countResult, dataResult] = yield Promise.all([
            (0, db_1.query)(countQuery, params),
            (0, db_1.query)(dataQuery, [...params, limit, offset]),
        ]);
        const total = countResult.rows[0].c;
        const offers = dataResult.rows.map((row) => row.data);
        res.json({
            offers,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
app.post('/api/offers', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const offer = req.body;
        console.log('Saving offer:', offer === null || offer === void 0 ? void 0 : offer.id, offer === null || offer === void 0 ? void 0 : offer.title);
        const { id, title } = offer !== null && offer !== void 0 ? offer : {};
        if (!id || !title) {
            console.error('Missing id or title');
            return res.status(400).json({ error: 'Missing id or title' });
        }
        // Ohne `input` fehlen Kategorie/Zielgruppe/Dauer — solche Angebote würden die
        // Bibliothek beim Anzeigen zerlegen.
        if (typeof offer.input !== 'object' || offer.input === null) {
            return res.status(400).json({ error: 'Missing input' });
        }
        // Ein Statement statt SELECT+INSERT: keine Dubletten, wenn zwei Saves gleichzeitig kommen.
        // Der WHERE-Zusatz verhindert, dass ein Demo-Token eine echte Zeile überschreibt (und umgekehrt).
        const owner = yield (0, demo_1.demoScopeEmail)(req);
        const saved = yield (0, db_1.query)(`INSERT INTO offers (offer_id, title, data, owner_email) VALUES ($1, $2, $3, $4)
       ON CONFLICT (offer_id) DO UPDATE SET title = EXCLUDED.title, data = EXCLUDED.data
         WHERE offers.owner_email IS NOT DISTINCT FROM EXCLUDED.owner_email
       RETURNING offer_id`, [id, title, offer, owner]);
        if (((_a = saved.rowCount) !== null && _a !== void 0 ? _a : 0) === 0) {
            return res.status(409).json({ error: 'Angebot gehört zu einem anderen Bereich.' });
        }
        res.status(201).json(offer);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
app.delete('/api/offers/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const owner = yield (0, demo_1.demoScopeEmail)(req);
        const deleted = yield (0, db_1.query)('DELETE FROM offers WHERE offer_id = $1 AND owner_email IS NOT DISTINCT FROM $2', [id, owner]);
        if (((_a = deleted.rowCount) !== null && _a !== void 0 ? _a : 0) === 0) {
            return res.status(404).json({ error: 'Angebot nicht gefunden.' });
        }
        res.status(200).json({ message: 'Deleted successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
if (webRoot) {
    const root = path_1.default.resolve(webRoot);
    if (fs_1.default.existsSync(path_1.default.join(root, 'index.html'))) {
        app.use(express_1.default.static(root, {
            index: false,
            maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
        }));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api')) {
                next();
                return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                next();
                return;
            }
            res.sendFile(path_1.default.join(root, 'index.html'), (err) => {
                if (err)
                    next(err);
            });
        });
    }
    else {
        console.warn('[kita] KITAPL_WEB_ROOT ohne index.html:', root);
    }
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        (0, db_1.logPoolTarget)();
        yield (0, db_1.connectDatabase)();
        try {
            yield (0, demo_1.ensureDemoSetup)();
        }
        catch (err) {
            // Die Demo darf den Start der echten Instanz nicht verhindern.
            console.error('[demo] Einrichtung fehlgeschlagen:', err);
        }
        yield new Promise((resolve, reject) => {
            const srv = app.listen(port, '0.0.0.0', () => {
                console.log(`Server listening on port ${port} (DB bereit).`);
                resolve();
            });
            srv.on('error', reject);
        });
    });
}
void start().catch((err) => {
    console.error('Serverstart fehlgeschlagen:', err);
    process.exit(1);
});
