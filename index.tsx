import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './shell.css';
import App from './App';
import { getDemoToken, isDemoEntry, startDemoSession } from './services/api';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * Demo-Betrieb: eigene Demo-Domain (demo-…) oder ?demo=1 holt beim Start anonym
 * ein Demo-Token. Danach wird `?demo=1` aus der Adresse entfernt, damit ein
 * Neuladen nicht erneut anfragt und der Link teilbar bleibt.
 */
async function boot(): Promise<void> {
  if (isDemoEntry() && !getDemoToken()) {
    await startDemoSession();
  }
  if (isDemoEntry()) {
    document.documentElement.dataset.demo = '1';
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void boot();
