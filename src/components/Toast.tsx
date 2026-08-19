import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconX } from './Icons';

interface ToastItem {
  id: number;
  message: string;
  tone: 'good' | 'bad';
}

const ToastContext = createContext<(message: string, tone?: 'good' | 'bad') => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: 'good' | 'bad' = 'good') => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={t.tone === 'bad' ? 'toast toast--bad' : 'toast'}>
            {t.tone === 'bad' ? (
              <IconX className="btn__icon" />
            ) : (
              <IconCheck className="btn__icon" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
