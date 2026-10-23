# Kita-Planer — Docker / docker-compose

Ein **App-Container** baut das Vite-Frontend, kompiliert den Express-Back-End-Code und startet zur Laufzeit **einen** Node-Prozess: Statische Dateien, SPA-Fallback (`index.html`) und **`/api/*`** auf demselben Port (**4466**). Die **Datenbank** läuft im zweiten Container (`postgres:15-alpine`).

Quick start (PowerShell):

1. Build and run:

   `docker compose up -d --build`

   **Ohne Cloudflare-Tunnel:** Das externe Netz `cloudflare-tunnel-net` muss existieren, sonst schlägt `compose` fehl. Entweder `docker network create cloudflare-tunnel-net` anlegen oder im `docker-compose.yaml` beim Service `app` den Eintrag unter `networks:` für `cloudflare` sowie den ganzen Block `networks: cloudflare:` unten entfernen (nur `default`).

2. **Lokal entwickeln** (ohne Compose für die App): im Projektroot `npm run dev` (Vite) und parallel im Ordner `server` z. B. `npm run dev` — Vite proxy siehe `vite.config.ts`.

**Ports**

- App (HTTP + API): **4466**
- Postgres (optional vom Host): **4455** → 5432

Notes for Ugreen NAS (ugos):

- Falls ihr ein Workspace-Compose nutzt, dort nur noch **diesen** `app`-Dienst (ein Image) und dieselbe DB-Logik verdrahten; der frühere Split **frontend + backend** entfällt.

Build reliability note

- To avoid `npm install` issues during Docker builds on NAS devices, create and commit a `package-lock.json` locally (run `npm ci`) before building on the NAS. This guarantees reproducible dependency installs and reduces transient network failures.

Note: To further reduce transient failures on constrained NAS images the repository Dockerfiles were hardened: `ca-certificates` are installed and npm install retry logic now performs up to 5 attempts with exponential backoff. The recommended, most reliable approach is still to generate and commit `package-lock.json` locally — use `./scripts/generate-lockfiles.sh` on a machine with Node/npm to create lockfiles across the workspace.

Mistral API key
---------------

AI runs **in the browser** (same pattern as before: key is present in the loaded app). Text uses `mistral-large-latest` via **`/v1/chat/completions`**; step/Kamishibai illustrations use the Mistral **Conversations** API with the built-in **`image_generation`** tool (`mistral-medium-latest` by default).

- **Docker:** `MISTRAL_API_KEY` in `.env` im **gleichen Ordner** wie `docker-compose.yaml`. Beim Container-Start erzeugt `inject-config.cjs` die `index.html` aus der Vorlage und trägt den Key **inline** ein. Compose: `env_file` + `environment: MISTRAL_API_KEY: ${MISTRAL_API_KEY}`. Nach Key-Änderung: `docker compose up -d app`. Prüfen: `docker compose exec app printenv MISTRAL_API_KEY` (sollte nicht leer sein).
- **Local Vite:** `vite.config.ts` lädt `.env` immer relativ zur `vite.config.ts` (nicht zum aktuellen Shell-Verzeichnis). Trotzdem: `npm run dev` am besten im Projektroot `kita_planner` ausführen.

Optional in `.env`: `VITE_MISTRAL_TEXT_MODEL`, `VITE_MISTRAL_IMAGE_CONVERSATION_MODEL` (see `.env.example`) — these require an **app image rebuild** when using Docker, because they are compile-time defines.

Do NOT commit real keys.

## Cloudflare / reverse proxy (502 Bad Gateway)

A **502** in the browser often comes **from Cloudflare** (or another proxy) because the **origin** did not return a valid HTTP response in time.

- **Tunnel / port:** Point Cloudflare Tunnel (or your reverse proxy) at the **`app`** service on port **`4466`**. Es gibt keinen separaten API-Port nach außen — `/api` liegt auf demselben Host/Port.
- **Check origin without Cloudflare** (on the NAS):  
  `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4466/api/health`  
  Expect `200` and `{"status":"ok"}` once Postgres connected and the server has started listening.
- **If 502 only via the public hostname:** Compare with direct `http://NAS-LAN-IP:4466` — if LAN works, adjust Tunnel routing, origin timeouts, or SSL mode (Flexible vs Full) so the tunnel reaches the same port.
- **DB nicht bereit:** `docker compose logs app --tail 80` — der Prozess startet den HTTP-Server erst nach erfolgreichem `connectDatabase()`.

Die frühere `nginx.conf` bleibt nur als **Referenz** im Repo; das Produktions-Image nutzt sie nicht mehr.

## Docker: "endpoint with name ... already exists in network"

After `docker compose up` or rebuild, the daemon can leave a stale network endpoint (container name / alias). **Build succeeds; start fails.**

Typical fix (project directory):

```bash
sudo docker compose down
sudo docker compose up -d
```

If it still errors:

```bash
sudo docker compose down --remove-orphans
sudo docker network rm kita_planner_default 2>/dev/null || true
sudo docker compose up -d
```

(`network rm` only works when no container is attached; `down` should detach first.)

### Network still "in use" or endpoint error persists

Something else (or a ghost endpoint) still holds `kita_planner_default`. On the NAS:

```bash
# Who is still on this network?
sudo docker network inspect kita_planner_default

# All containers (running or stopped) mentioning kita / kitaplaner
sudo docker ps -a | grep -i kita

# Remove stopped leftovers; then force-remove known names (adjust if needed)
sudo docker rm -f kitaplaner kitaplaner-db 2>/dev/null

# If the project network still exists and is empty, remove it
sudo docker compose down --remove-orphans
sudo docker network rm kita_planner_default 2>/dev/null || true

sudo docker compose up -d
```

If **`network rm`** still says *in use*, find the attaching container in `docker network inspect` → **Containers** and `docker rm -f <id>` for each, then `network rm` again.

**Last resort (NAS):** restart the Docker daemon (clears stuck endpoints on many systems):

```bash
sudo systemctl restart docker
cd ~/Projekte/kita_planner && sudo docker compose up -d
```

**Hinweis:** Für **`app`** wird im Compose **kein** fester `container_name` gesetzt (weniger Konflikte mit alten Endpoints). Logs und Shell: `docker compose logs app` bzw. `docker compose exec app sh`.

Der HTTP-Server **öffnet den Port erst nach PostgreSQL** (`connectDatabase()` vor `listen`). Bis dahin liefert `curl` auf dem Host für `/api/health` kein Ergebnis — auf langsamen NAS bis zu ~1–2 Minuten normal.
