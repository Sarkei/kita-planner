'use strict';

/**
 * Schreibt MISTRAL_API_KEY zur Laufzeit in index.html (inline), damit kein
 * separates config.js nötig ist — vermeidet 403/WAF auf statischen *.js neben dem Bundle.
 * Idempotent pro Start: index.html wird immer aus index.html.tmpl kopiert (Unified Dockerfile).
 * Root: KITAPL_WEB_ROOT (Vorgabe /app/web in Production; Fallback /usr/share/nginx/html für alte Pfade).
 */
const fs = require('fs');
const path = require('path');

const root = String(process.env.KITAPL_WEB_ROOT || '/usr/share/nginx/html').trim() || '/usr/share/nginx/html';
const tmplPath = path.join(root, 'index.html.tmpl');
const htmlPath = path.join(root, 'index.html');

fs.copyFileSync(tmplPath, htmlPath);

let html = fs.readFileSync(htmlPath, 'utf8');
const k = String(process.env.MISTRAL_API_KEY || '').trim();
const payload = JSON.stringify({ MISTRAL_API_KEY: k }).replace(/</g, '\\u003c');
const inline = `<script>window.__KITAPL_CONFIG__=${payload};</script>`;

const reConfig = /<script\s+src=["']\.\/config\.js["']\s*><\/script>\s*/i;
if (reConfig.test(html)) {
  html = html.replace(reConfig, `${inline}\n    `);
} else if (!html.includes('__KITAPL_CONFIG__')) {
  html = html.replace(/<\/body>/i, `    ${inline}\n  </body>`);
}

fs.writeFileSync(htmlPath, html);
