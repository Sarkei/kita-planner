# Kita Planner

Web-Anwendung für die Planung pädagogischer Angebote in der Kita. Aus wenigen Eingaben
(Thema, Kategorie, Zielgruppe, Dauer) erzeugt die App über die Mistral-API ein Angebot mit
Titel, Materialliste, Zielen, Vorbereitung und Schritten – optional zweisprachig
(Deutsch/Englisch) und mit generierten Illustrationen. Ergebnisse landen in Postgres,
lassen sich in einer Bibliothek durchsuchen und als PDF exportieren.

## Funktionen

**Angebot erstellen** (`components/OfferForm.tsx`, `services/mistralService.ts`)

- Themenfeld optional; Kategorie, Zielgruppe, Dauer und Kinderzahl per Auswahl, „zweisprachig“ als Schalter.
- Kategorien: Morgenkreis, Turnen/Bewegung, Basteln/Kunst, Experimente/MINT, Kamishibai, Musik, Geschichte vorlesen.
- Zielgruppen: Krippe (0–3), Regelgruppe (3–6), Vorschule (5–6).
- Text per Chat Completions mit `response_format: json_object`, `temperature 0.7`, `max_tokens 8000`, übernommen in das Schema aus `types.ts`.

**Bilder und Kamishibai** (`App.tsx`, `utils/pdfGenerator.ts`)

- Kategorie Kamishibai liefert Szenen mit `sceneNumber`, `storyText`, `imagePrompt` statt Schritten.
- Bilder werden nach der Textgenerierung automatisch erzeugt: Szenen 4:3, Schritte 1:1, sequenziell mit 500 ms Pause; ein Bildfehler bricht die übrige Generierung nicht ab.
- PDF für Kamishibai: A4 quer, eine Bildseite pro Szene, danach Textseiten A4 hoch.

**Bearbeiten und Export** (`components/OfferDisplay.tsx`)

- Titel, Ziele, Vorbereitung, Schritte und Szenen inline editierbar; Bildprompts änderbar, Bilder einzeln neu generierbar.
- Autosave 1,3 s nach der letzten Eingabe (debounced) in die Bibliothek; Fehler als Toast.
- PDF-Export über `jspdf` + `jspdf-autotable` (Standardangebot: A4 hoch, Materialtabelle, Schritte mit optionalen Bildern).

**Bibliothek** (`components/Library.tsx`, `services/libraryAiSearch.ts`)

- Serverseitige Pagination (Standard 24, max. 200 pro Seite).
- Filter: Freitext `q` (`ILIKE` über die JSON-Spalte), Kategorie, Zeitraum.
- Zeitraum-Label = Jahreszeit + Jahr aus dem Speicherzeitpunkt (Winter Dez–Feb, Frühling Mär–Mai, Sommer Jun–Aug, Herbst Sep–Nov); Logik doppelt in `utils/seasonYear.ts` und `server/src/seasonLabel.ts`.
- Modus „KI-Suche“: bis zu 52 Kandidaten werden geladen, per Mistral bewertet und nach Relevanz sortiert.
- Löschen mit Bestätigungsdialog; dunkles Theme als Standard (`localStorage: theme`); Tageszähler für API-Aufrufe (Limit 1500) im Header.

## Technik

| Schicht | Umsetzung |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, `react-router-dom` (HashRouter) |
| Backend | Express 4, `pg`, TypeScript, `ts-node-dev` in Entwicklung |
| Datenbank | PostgreSQL 15, Tabelle `offers` (`offer_id`, `title`, `created_at`, `data` als `JSONB`) |
| KI | Mistral: `/v1/chat/completions` (Text), `/v1/conversations` mit Tool `image_generation`, Bildabruf `/v1/files/{id}/content` |
| Export / Tests | `jspdf`, `jspdf-autotable`; Vitest mit jsdom und Testing Library |
| Betrieb | Ein Image: Vite-Build + kompilierter Express-Server, Statik und `/api/*` auf Port 4466 |

Der Server verbindet sich vor `listen` mit Postgres (bis zu 25 Versuche, 2,5 s Abstand) und
legt Tabelle und Indizes per `CREATE TABLE IF NOT EXISTS` an; `GET /api/health` antwortet
erst danach. Beim Containerstart schreibt `docker/frontend-inject-config.cjs` den Schlüssel
inline in `index.html`.

## Projektstruktur

```
App.tsx              Routing, Generierungs- und Speicherlogik, Theme
index.tsx            React-Einstiegspunkt
types.ts             OfferCategory, TargetGroup, OfferInput, OfferData, SavedOffer
components/          Layout, OfferForm, OfferDisplay, Library, Confirm
src/components/      Toasts, Confirm.test.tsx
services/            api.ts (REST-Client), mistralService.ts, libraryAiSearch.ts
utils/               pdfGenerator.ts, seasonYear.ts, preparationFormat.ts
server/src/          index.ts (Routen), db.ts (Pool/Schema), offersFilter.ts, seasonLabel.ts
docker/              app-entrypoint.sh, frontend-inject-config.cjs
public/config.js     Platzhalter für den Dev-Server
Dockerfile           Stufen web-build, server-build, Runtime
docker-compose.yaml  kita-planner + postgres
nginx.conf           Legacy, wird nicht mehr gebaut
```

## Start

```bash
npm install
cp .env.example .env      # Werte eintragen
npm run dev               # Vite :3000, /api geproxyt an 127.0.0.1:5000
npm test                  # Vitest
npm run build             # Produktionsbuild nach dist/
cd server && npm run dev  # Backend separat, Port 5000 ohne KITAPL_WEB_ROOT
```

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:4466/api/health
```

Ports: App 4466 (UI und `/api` im selben Prozess), Postgres 4455 → 5432. Das Compose-File
bindet das externe Netz `cloudflare-tunnel-net` ein; existiert es nicht, schlägt `compose`
fehl – `docker network create cloudflare-tunnel-net` ausführen oder den `cloudflare`-Eintrag
samt Netzblock entfernen.

## Konfiguration

Alle Werte in `.env` (Vorlage `.env.example`); echte Schlüssel nicht committen.

| Variable | Zweck |
|---|---|
| `VITE_API_URL` | Basis-URL der API im Browser: lokal `http://localhost:5000/api`, im Docker-Build `/api` |
| `MISTRAL_API_KEY` | Schlüssel für Text und Bilder; lokal über Vite eingebettet, im Container beim Start in `index.html` injiziert |
| `VITE_MISTRAL_TEXT_MODEL` | Optionaler Override des Textmodells (Vorgabe `mistral-large-latest`), Build-Time-Define |
| `VITE_MISTRAL_IMAGE_CONVERSATION_MODEL` | Optionaler Override des Bildmodells (Vorgabe `mistral-medium-latest`), Build-Time-Define |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Zugangsdaten und Datenbankname für Container und Server |
| `POSTGRES_HOST`, `POSTGRES_PORT` | Verbindungsziel des Servers; Compose setzt `POSTGRES_HOST=postgres` |
| `DATABASE_URL` | Alternative Verbindungszeichenfolge; `localhost` wird im Container ignoriert, Compose setzt sie leer |
| `PORT` | HTTP-Port (Compose 4466, lokal ohne `KITAPL_WEB_ROOT` 5000) |
| `KITAPL_WEB_ROOT` | Verzeichnis der gebauten SPA, die Express ausliefert (im Image `/app/web`) |
| `NODE_ENV` | `production` im Container, steuert u. a. das Cache-Alter statischer Dateien |

## Hinweise

- **Schlüssel im Browser.** `MISTRAL_API_KEY` wird beim Build bzw. Start in die ausgelieferte Seite geschrieben und ist für jeden Client auslesbar – gedacht für privaten Betrieb hinter Tunnel, nicht für öffentliche Instanzen.
- **Modell-Overrides brauchen einen Rebuild.** `VITE_MISTRAL_*` sind Compile-Time-Defines; danach `docker compose build` und Neustart.
- **Startreihenfolge.** Der Port öffnet erst nach DB-Verbindung; auf langsamen NAS liefert `/api/health` ein bis zwei Minuten nichts. Der Client wiederholt 503 bis 10-mal, 502/504 bis 5-mal.
- **`nginx.conf` ist Legacy.** Das Produktions-Image liefert Statik und `/api` über Express.
- **Doku-Drift.** `README-Docker.md` nennt teils den Compose-Service `app`, tatsächlich heißt er `kita-planner`; Port- und Netzwerkhinweise dort stimmen, Befehle mit `app` nicht.
- **Gemischte Ordner.** Kleine Komponenten unter `components/`, Toasts und Test unter `src/components/`; `App.tsx` importiert beide Pfade.
- **Testabdeckung.** Vitest ist auf `src/**/*.test.tsx` konfiguriert, vorhanden ist nur `Confirm.test.tsx`; Angebots- und PDF-Logik sind ungetestet.
- Die Git-Historie beginnt mit einem Import aus Google Drive.
