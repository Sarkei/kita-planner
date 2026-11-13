import path from 'path';
import fs from 'fs';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { connectDatabase, query, logPoolTarget } from './db';
import { seasonPeriodFromOfferData } from './seasonLabel';
import { buildOfferFilters } from './offersFilter';
import { aiRouter } from './ai';
import { createDemoSession, demoScopeEmail, demoUserFromRequest, ensureDemoSetup } from './demo';

const webRoot = (process.env.KITAPL_WEB_ROOT || process.env.STATIC_ROOT || '').trim();
const port: number = (() => {
  const p = parseInt(String(process.env.PORT ?? ''), 10);
  if (!Number.isNaN(p) && p > 0) return p;
  return webRoot ? 4466 : 5000;
})();

const app = express();

/**
 * Die SPA läuft im selben Prozess wie die API — CORS braucht es nur, wenn ein
 * separater Dev-Server zugreift. Deshalb nur auf ausdrückliche Freigabe öffnen.
 */
const corsOrigin = (process.env.CORS_ORIGIN || '').trim();
if (corsOrigin) {
  app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()) }));
}

app.disable('x-powered-by');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

/**
 * KI-Proxy: eigener Body-Limit, weil hier nur Text und kleine Steuerdaten laufen.
 * Die Schlüssel bleiben ausschließlich im Container.
 */
app.use('/api/ai', express.json({ limit: '2mb' }), aiRouter);

app.get('/api/health', (_req: Request, res: Response) => {
  /** Sobald der Server antwortet, ist die DB verbunden (connectDatabase vor listen). */
  res.status(200).json({ status: 'ok' });
});

/**
 * Anonymer Demo-Zugang: GET oder POST liefert ein frisches Token für das
 * Demo-Konto (demo@example.com). Die App selbst kennt keine Anmeldung — das
 * Token markiert nur den Demo-Datenausschnitt.
 */
async function handleDemoLogin(_req: Request, res: Response) {
  try {
    const { token, user } = await createDemoSession();
    res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, displayName: user.name } });
  } catch (err) {
    console.error('[api/auth/demo]', err);
    res.status(500).json({ error: 'Demo konnte nicht geladen werden.' });
  }
}

app.get('/api/auth/demo', handleDemoLogin);
app.post('/api/auth/demo', handleDemoLogin);

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const user = await demoUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Kein gültiger Demo-Token.' });
      return;
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name, displayName: user.name }, demo: true });
  } catch (err) {
    console.error('[api/auth/me]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/offers/meta', async (req: Request, res: Response) => {
  try {
    const owner = await demoScopeEmail(req);
    const countResult = await query(
      'SELECT COUNT(*)::int AS c FROM offers WHERE owner_email IS NOT DISTINCT FROM $1',
      [owner],
    );
    const total = countResult.rows[0].c as number;

    const rows = await query(
      'SELECT created_at FROM offers WHERE owner_email IS NOT DISTINCT FROM $1 ORDER BY created_at DESC LIMIT 1500',
      [owner],
    );
    const periods = new Set<string>();
    for (const row of rows.rows as Array<{ created_at: Date | string }>) {
      periods.add(seasonPeriodFromOfferData({}, new Date(row.created_at)));
    }

    res.json({
      total,
      periods: Array.from(periods).sort(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/offers', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    let limit = parseInt(String(req.query.limit), 10) || 24;
    limit = Math.min(200, Math.max(1, limit));
    const offset = (page - 1) * limit;

    const { whereSql, params } = buildOfferFilters(req, await demoScopeEmail(req));
    const lim = params.length + 1;
    const off = params.length + 2;

    const countQuery = `SELECT COUNT(*)::int AS c FROM offers ${whereSql}`;
    const dataQuery = `SELECT data FROM offers ${whereSql} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`;

    const [countResult, dataResult] = await Promise.all([
      query(countQuery, params),
      query(dataQuery, [...params, limit, offset]),
    ]);

    const total = countResult.rows[0].c as number;
    const offers = (dataResult.rows as Array<{ data: unknown }>).map((row) => row.data);

    res.json({
      offers,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/offers', async (req: Request, res: Response) => {
  try {
    const offer = req.body;
    console.log('Saving offer:', offer?.id, offer?.title);
    const { id, title } = offer ?? {};

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
    const owner = await demoScopeEmail(req);
    const saved = await query(
      `INSERT INTO offers (offer_id, title, data, owner_email) VALUES ($1, $2, $3, $4)
       ON CONFLICT (offer_id) DO UPDATE SET title = EXCLUDED.title, data = EXCLUDED.data
         WHERE offers.owner_email IS NOT DISTINCT FROM EXCLUDED.owner_email
       RETURNING offer_id`,
      [id, title, offer, owner],
    );
    if ((saved.rowCount ?? 0) === 0) {
      return res.status(409).json({ error: 'Angebot gehört zu einem anderen Bereich.' });
    }

    res.status(201).json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/offers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const owner = await demoScopeEmail(req);
    const deleted = await query(
      'DELETE FROM offers WHERE offer_id = $1 AND owner_email IS NOT DISTINCT FROM $2',
      [id, owner],
    );
    if ((deleted.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: 'Angebot nicht gefunden.' });
    }
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

if (webRoot) {
  const root = path.resolve(webRoot);
  if (fs.existsSync(path.join(root, 'index.html'))) {
    app.use(
      express.static(root, {
        index: false,
        maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
      }),
    );
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.sendFile(path.join(root, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  } else {
    console.warn('[kita] KITAPL_WEB_ROOT ohne index.html:', root);
  }
}

async function start(): Promise<void> {
  logPoolTarget();
  await connectDatabase();

  try {
    await ensureDemoSetup();
  } catch (err) {
    // Die Demo darf den Start der echten Instanz nicht verhindern.
    console.error('[demo] Einrichtung fehlgeschlagen:', err);
  }

  await new Promise<void>((resolve, reject) => {
    const srv = app.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on port ${port} (DB bereit).`);
      resolve();
    });
    srv.on('error', reject);
  });
}

void start().catch((err) => {
  console.error('Serverstart fehlgeschlagen:', err);
  process.exit(1);
});
