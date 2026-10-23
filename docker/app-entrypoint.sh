#!/bin/sh
set -e
export KITAPL_WEB_ROOT="${KITAPL_WEB_ROOT:-/app/web}"
node /app/inject-config.cjs
cd /app/server
exec node dist/index.js
