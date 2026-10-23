import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Immer das Verzeichnis dieser Datei — nicht `process.cwd()` (IDE/Compose-Start kann woanders liegen). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  /** Leerer Prefix-String = alle Keys aus `.env` / `.env.local` (siehe Vite loadEnv). */
  const env = loadEnv(mode, projectRoot, '');
  /** Lokal: aus Projekt-`.env`; Docker-Image: oft leer — Key kommt per config.js (Entrypoint, MISTRAL_API_KEY im Container). */
  const mistralKey = (process.env.MISTRAL_API_KEY ?? env.MISTRAL_API_KEY ?? '').trim();
  const textModel =
    (process.env.VITE_MISTRAL_TEXT_MODEL ?? env.VITE_MISTRAL_TEXT_MODEL ?? '').trim() ||
    'mistral-large-latest';
  const imageConvModel =
    (process.env.VITE_MISTRAL_IMAGE_CONVERSATION_MODEL ?? env.VITE_MISTRAL_IMAGE_CONVERSATION_MODEL ?? '').trim() ||
    'mistral-medium-latest';
  return {
    /** Relativ zu index.html – funktioniert auch hinter Unterpfaden / Tunnel ohne falsche `/assets`-URLs. */
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
    plugins: [tailwindcss(), react()],
    define: {
      /** Legacy: ältere Builds; weiterhin gesetzt wie MISTRAL_API_KEY für einfachen Zugriff. */
      'process.env.API_KEY': JSON.stringify(mistralKey),
      'process.env.MISTRAL_API_KEY': JSON.stringify(mistralKey),
      'process.env.MISTRAL_TEXT_MODEL': JSON.stringify(textModel),
      'process.env.MISTRAL_IMAGE_CONVERSATION_MODEL': JSON.stringify(imageConvModel),
    },
    resolve: {
      alias: {
        '@': path.resolve(projectRoot),
      },
    },
  };
});
