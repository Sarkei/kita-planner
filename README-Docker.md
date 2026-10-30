# Kita-Planer — Betrieb mit Docker

Kurzfassung für den Betrieb auf dem NAS. Architektur und Funktionen stehen in `README.md`.

## Bauen und starten

```bash
cp .env.example .env      # MISTRAL_API_KEY und POSTGRES_PASSWORD eintragen
docker compose up -d --build
curl -fsS http://127.0.0.1:4466/api/health
```

Ein Image enthält beides: die gebaute SPA (`/app/web`) und den Express-Server, der sie
ausliefert und `/api/*` bedient. Postgres läuft im Compose-Netz — ohne Port nach außen.

**Ohne Cloudflare-Tunnel:** Das externe Netz `cloudflare-tunnel-net` muss existieren, sonst
schlägt `compose` fehl. Entweder `docker network create cloudflare-tunnel-net` oder beim
Service `kita-planner` den `cloudflare`-Eintrag samt Netzblock entfernen.

**Lokal entwickeln** (ohne Compose): im Projektroot `npm run dev` (Vite auf :3000, `/api`
wird an :5000 geproxyt) und parallel in `server/` `npm run dev`.

Build-Hinweis: `package-lock.json` ist eingecheckt; das Image baut mit `npm ci`, das ist auf
dem NAS deutlich stabiler als ein frisches `npm install`. Schlägt das Netz beim Build weg,
baut der Dockerfile bis zu fünfmal mit Pause erneut.

## Der Schlüssel

`MISTRAL_API_KEY` steht nur in `.env` und geht ausschließlich an den App-Container. Die
KI-Aufrufe laufen über `/api/ai/*`; im Browser ist nichts davon zu sehen. Nach einer
Änderung genügt `docker compose up -d` — kein Rebuild, weil der Schlüssel nicht mehr
eingebacken wird.

```bash
docker compose exec kita-planner printenv MISTRAL_API_KEY | wc -c   # > 0
curl -s http://127.0.0.1:4466/api/ai/status                          # {"configured":true,...}
```

## Cloudflare Tunnel

Der Container hängt zusätzlich im externen Netz `cloudflare-tunnel-net`; der Tunnel zeigt
auf `http://kita-planner:4466`. UI und `/api` laufen über denselben Port.

## Wenn etwas klemmt

**502 über die Domain, direkt aber erreichbar**
Liegt am Tunnel, nicht an der App. Prüfen, ob der Ingress auf `kita-planner:4466` zeigt und
der Container im Netz hängt:
`docker inspect kita-planner --format '{{json .NetworkSettings.Networks}}'`

**Container läuft, `/api/health` antwortet lange nicht**
Der Server öffnet den Port erst nach der Datenbankverbindung (bis zu 25 Versuche à 2,5 s).
`docker compose logs kita-planner --tail 50` zeigt, ob er noch wartet.

**`endpoint with name ... already exists in network`**
Ein alter Container hängt im Netz:

```bash
docker compose down --remove-orphans
docker network inspect cloudflare-tunnel-net --format '{{range .Containers}}{{.Name}} {{end}}'
```

Steht dort noch `kita-planner`, den Container entfernen und neu starten.

**KI antwortet mit 503**
`/api/ai/status` zeigt `configured: false` → `MISTRAL_API_KEY` fehlt in `.env`. Mit 429 ist
das Stundenlimit pro IP erreicht (`AI_RATE_LIMIT_PER_HOUR`).
