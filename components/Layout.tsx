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
            ? 'bg-white dark:bg-slate-800/50 text-orange-600 dark:text-orange-400 border-orange-500' 
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30'
        }`}
      >
        <Icon size={18} className={isActive ? "text-orange-500" : ""} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-kita-bg dark:bg-kita-dark transition-colors duration-300 font-sans text-slate-800 dark:text-slate-100">
      
      {/* Top Header */}
      <header className="h-16 bg-white dark:bg-kita-cardDark border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 sticky top-0 shadow-sm">
         <div className="flex items-center gap-3">
             <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-500">
                <BookOpen size={24} />
             </div>
             <div>
                 <h1 className="text-lg md:text-xl font-bold font-hand tracking-tight leading-none">Kita-Planer</h1>
                 {demoName && (
                   <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
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
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" 
              title="Mistral-Konsole (hier nur lokale App-Nutzungszähler)"
            >
                <div className={`w-2 h-2 rounded-full ${apiUsage.count > 0 ? 'bg-green-500' : 'bg-slate-300'} ${apiUsage.count > 0 ? 'animate-pulse' : ''}`}></div>
                <span className="hidden sm:inline">Lokal:</span>
                <span className="font-mono">{apiUsage.count} / {apiLimit} Req</span>
                <span className="hidden md:inline text-slate-300 dark:text-slate-600">|</span>
                <span className="hidden md:inline font-mono text-slate-400">{Math.round(apiUsage.tokens / 1000)}k Tok</span>
            </a>

            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-orange-100 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-500 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
         </div>
      </header>

      {/* Main Navigation Bar */}
      <div className="bg-white/50 dark:bg-kita-cardDark/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20">
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