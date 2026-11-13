import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PlusCircle, Library, Sun, Moon, BookOpen } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  toggleTheme: () => void;
  apiUsage?: { count: number, tokens: number };
  apiLimit?: number;
  /** Gesetzt im Demo-Betrieb: zeigt Badge mit Demo-Konto. */
  demoName?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, isDarkMode, toggleTheme, apiUsage = { count: 0, tokens: 0 }, apiLimit = 1500, demoName }) => {
  const location = useLocation();

  const NavTab = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-medium transition-all duration-200 border-b-2 ${
          isActive 
            ? 'bg-surface text-accent border-accent' 
            : 'text-muted hover:text-ink border-transparent hover:bg-surface-2'
        }`}
      >
        <Icon size={18} className={isActive ? "text-accent" : ""} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg transition-colors duration-300 font-sans text-ink">
      
      {/* Top Header */}
      <header className="h-16 bg-surface border-b border-line flex items-center justify-between px-4 md:px-8 shrink-0 z-30 sticky top-0 shadow-sm">
         <div className="flex items-center gap-3">
             <div className="p-2 bg-accent-soft rounded-lg text-accent">
                <BookOpen size={24} />
             </div>
             <div>
                 <h1 className="text-lg md:text-xl font-bold font-hand tracking-tight leading-none">Kita-Planer</h1>
                 {demoName && (
                   <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
                     Demo · {demoName}
                   </span>
                 )}
             </div>
         </div>
         
         <div className="flex items-center gap-3">
            <a 
              href="https://console.mistral.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 rounded-full text-xs font-medium text-muted border border-line shadow-sm hover:bg-surface-3 transition-colors cursor-pointer" 
              title="Mistral-Konsole (hier nur lokale App-Nutzungszähler)"
            >
                <div className={`w-2 h-2 rounded-full ${apiUsage.count > 0 ? 'bg-success' : 'bg-line-strong'} ${apiUsage.count > 0 ? 'animate-pulse' : ''}`}></div>
                <span className="hidden sm:inline">Lokal:</span>
                <span className="font-mono">{apiUsage.count} / {apiLimit} Req</span>
                <span className="hidden md:inline text-placeholder">|</span>
                <span className="hidden md:inline font-mono text-muted">{Math.round(apiUsage.tokens / 1000)}k Tok</span>
            </a>

            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-surface-2 text-muted hover:bg-accent-soft hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
         </div>
      </header>

      {/* Main Navigation Bar */}
      <div className="bg-surface/85 backdrop-blur-sm border-b border-line sticky top-16 z-20">
        <nav className="max-w-5xl mx-auto px-4 md:px-8 flex gap-2 overflow-x-auto pt-2">
          <NavTab to="/" icon={PlusCircle} label="Generator" />
          <NavTab to="/bibliothek" icon={Library} label="Bibliothek" />
        </nav>
      </div>

      {/* Content Area */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;