import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ConfirmOptions = { title?: string; description?: string; confirmText?: string; cancelText?: string };

const ConfirmContext = createContext<((opts?: ConfirmOptions) => Promise<boolean>) | null>(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Array<{ id: string; opts: ConfirmOptions; resolve: (v: boolean) => void }>>([]);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      const id = `c_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      setQueue(prev => [...prev, { id, opts, resolve }]);
    });
  }, []);

  const close = (id: string, result: boolean) => {
    setQueue(prev => {
      const item = prev.find(p => p.id === id);
      if (item && item.resolve) item.resolve(result);
      return prev.filter(p => p.id !== id);
    });
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {queue.map(q => (
        <div key={q.id} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface text-ink rounded-2xl p-6 max-w-md w-full border border-line shadow-card">
            {q.opts.title && <h3 className="text-lg font-bold mb-2">{q.opts.title}</h3>}
            {q.opts.description && <p className="text-sm text-muted mb-4">{q.opts.description}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => close(q.id, false)} className="px-4 py-2 rounded-lg border border-line-strong text-ink font-medium hover:bg-surface-2 transition-colors">{q.opts.cancelText || 'Cancel'}</button>
              <button onClick={() => close(q.id, true)} className="px-4 py-2 rounded-lg bg-accent text-on-accent font-medium hover:bg-accent-hover transition-colors">{q.opts.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      ))}
    </ConfirmContext.Provider>
  );
};

export default ConfirmProvider;
