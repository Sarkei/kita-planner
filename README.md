# Kita Planner

Web-App zur Planung im Kita-Alltag: Angebote, Gruppen und Tagesabläufe an einem Ort.
Frontend mit React, TypeScript und Vite, Styling über Tailwind. Texte für Angebote
lassen sich per Mistral AI generieren; die Schlüssel liegen in `.env` (Vorlage:
`.env.example`), nicht im Repo.

**Technik:** `React` · `TypeScript` · `Vite` · `Tailwind CSS` · `Docker Compose`

## Inhalt

- `.dockerignore`
- `.env.example`
- `.gitattributes`
- `.gitignore`
- `App.tsx`
- `Dockerfile`
- `README-Docker.md`
- `README.md`
- `components/`
- `docker-compose.yaml`
- `docker/`
- `index.css`
- `index.html`
- `index.tsx`

_Insgesamt 44 Dateien._

## Sprachen

| Sprache | Dateien |
|---|---|
| TypeScript | 22 |
| Markdown | 2 |
| CSS | 1 |
| HTML | 1 |
| JavaScript | 1 |

## Start

```bash
npm install
npm run dev     # Entwicklung starten
cp .env.example .env   # Werte eintragen
docker compose up -d
```

## Hinweise

- Zugangsdaten stehen **nicht** im Repo. Für lokale Werte `.env` anlegen (siehe `.env.example`).
- Importstand aus Google Drive; die Historie beginnt mit diesem Import.
