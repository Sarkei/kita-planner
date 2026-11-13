import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Toast = { id: string; type?: 'info' | 'success' | 'error' | 'warning'; message: string; timeout?: number };

const ToastContext = createContext<{ push: (t: Omit<Toast,'id'>) => void } | null>(null);

export const useToasts = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast,'id'>) => {
    const id = `t_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    setToasts(prev => [...prev, { id, ...t }]);
  }, []);

  useEffect(() => {
    const timers: Array<number> = [];
    toasts.forEach(t => {
      if (t.timeout !== 0) {
        const ms = t.timeout ?? 4000;
        const id = window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), ms);
        timers.push(id);
      }
    });
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [toasts]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-60 space-y-2 w-[320px] max-w-[90vw]">
        {toasts.map(t => (
          <div key={t.id} className="rounded-xl border border-line bg-surface p-3 shadow-card text-sm text-ink flex items-start gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.type === 'success' ? 'bg-success' : t.type === 'error' ? 'bg-danger' : t.type === 'warning' ? 'bg-warn' : 'bg-accent'}`} />
            <div className="flex-1">{t.message}</div>
            <button className="opacity-80 hover:opacity-100" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
