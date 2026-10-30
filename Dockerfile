# Ein Image: Vite-Build → Express liefert / + /api (kein nginx).
# Debian (glibc): @tailwindcss/oxide unter Alpine/musl oft „Cannot find native binding“.

# ============ Web (Vite) ============
FROM node:20-bookworm-slim AS web-build

WORKDIR /app

# Der Browser bekommt nur die API-Basis; Modellnamen und Schlüssel bleiben im Server.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./

ENV NPM_CONFIG_LOGLEVEL=error
ENV NPM_CONFIG_PROGRESS=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN set -eux; \
		try_install() { \
			if [ -f package-lock.json ]; then \
				npm ci --prefer-offline --no-audit --no-fund --network-timeout=100000; \
			else \
				npm install --prefer-offline --no-audit --no-fund --network-timeout=100000; \
			fi; \
		}; \
		n=0; \
		until [ $n -ge 5 ]; do \
			if try_install; then break; fi; \
			n=$((n+1)); \
			echo "npm install failed, retrying ($n)..."; \
			sleep $((5 * n)); \
		done; \
		if [ $n -ge 5 ]; then echo "npm install failed after retries"; exit 1; fi

COPY . .
RUN npm run build

# ============ API (tsc) ============
FROM node:20-bookworm-slim AS server-build

WORKDIR /server

COPY server/package*.json ./

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN set -eux; \
		try_install() { \
			if [ -f package-lock.json ]; then \
				npm ci --prefer-offline --no-audit --no-fund --silent --network-timeout=100000; \
			else \
				npm install --prefer-offline --no-audit --no-fund --silent --network-timeout=100000; \
			fi; \
		}; \
		n=0; \
		until [ $n -ge 5 ]; do \
			if try_install; then break; fi; \
			n=$((n+1)); \
			echo "npm install failed, retrying ($n)..."; \
			sleep $((5 * n)); \
		done; \
		if [ $n -ge 5 ]; then echo "npm install failed after retries"; exit 1; fi

COPY server/ ./
RUN npm run build

# ============ Runtime ============
FROM node:20-bookworm-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl \
	&& rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV KITAPL_WEB_ROOT=/app/web
ENV PORT=4466

WORKDIR /app

COPY --from=web-build /app/dist /app/web

WORKDIR /app/server
COPY --from=server-build /server/package*.json ./
RUN set -eux; \
		if [ -f package-lock.json ]; then \
			npm ci --omit=dev --no-audit --no-fund --network-timeout=100000; \
		else \
			npm install --omit=dev --no-audit --no-fund --network-timeout=100000; \
		fi
COPY --from=server-build /server/dist ./dist

WORKDIR /app/server

EXPOSE 4466

CMD ["node", "dist/index.js"]
