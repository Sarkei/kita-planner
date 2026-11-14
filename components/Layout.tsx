import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Sun, Moon, Menu, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  toggleTheme: () => void;
  apiUsage?: { count: number; tokens: number };
  apiLimit?: number;
  /** Gesetzt im Demo-Betrieb: zeigt das Demo-Konto in der Marke. */
  demoName?: string;
}

/** Bereiche der App — Kopfzeile und Mobilmenü teilen sich diese Liste. */
const NAV = [
  { to: '/', label: 'Übersicht', also: [] as string[] },
  { to: '/neu', label: 'Neues Angebot', also: ['/angebot'] },
  { to: '/bibliothek', label: 'Bibliothek', also: [] as string[] },
];

const Layout: React.FC<LayoutProps> = ({
  children,
  isDarkMode,
  toggleTheme,
  apiUsage = { count: 0, tokens: 0 },
  apiLimit = 1500,
  demoName,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  const isItemActive = (item: (typeof NAV)[number]) =>
    pathname === item.to || item.also.includes(pathname);

  const navClass = (item: (typeof NAV)[number]) =>
    `app-nav-item${isItemActive(item) ? ' is-active' : ''}`;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-container app-header__inner">
          <Link to="/" className="app-brand" aria-label="Kita-Planer — Übersicht">
            <span className="app-brand__mark">
              <BookOpen size={20} />
            </span>
            <span className="app-brand__text">
              Kita-Planer
              <span className="app-brand__sub">
                {demoName ? `Demo · ${demoName}` : 'Pädagogische Angebote'}
              </span>
            </span>
          </Link>

          <nav className="app-nav" aria-label="Hauptnavigation">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className={navClass(item)} aria-current={isItemActive(item) ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="app-actions">
            <a
              href="https://console.mistral.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="app-usage"
              title="Mistral-Konsole (lokal zählt nur diese App mit)"
            >
              <span className={`app-usage__dot${apiUsage.count > 0 ? ' is-live' : ''}`} />
              <span>
                {apiUsage.count} / {apiLimit} Anfragen
              </span>
            </a>

            <button
              type="button"
              onClick={toggleTheme}
              className="app-iconbtn"
              aria-label={isDarkMode ? 'Helles Design' : 'Dunkles Design'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="app-iconbtn app-mobile-toggle"
              aria-label="Menü"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="app-mobile-nav" aria-label="Hauptnavigation mobil">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={isItemActive(item) ? 'is-active' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="app-main">{children}</main>

    </div>
  );
};

export default Layout;
