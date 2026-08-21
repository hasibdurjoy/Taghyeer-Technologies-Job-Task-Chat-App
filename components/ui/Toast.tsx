'use client';

import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { cx } from '@/lib/utils';

type ToastTone = 'error' | 'success';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 5_000;

/**
 * Lightweight toast layer.
 *
 * Used for transient failures that aren't tied to a specific piece of UI;
 * anything a user can act on (a failed send, a failed load) gets inline
 * feedback with a retry control instead. No browser `alert()` anywhere.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'error') => {
      nextIdRef.current += 1;
      const id = nextIdRef.current;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
      );
    },
    [dismiss],
  );

  // Clear pending timers if the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // Announced politely so a screen reader hears failures without losing focus.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-lifted',
              'animate-pop',
              toast.tone === 'error'
                ? 'bg-ink-950 text-white'
                : 'bg-surface text-ink-900 ring-1 ring-inset ring-ink-200',
            )}
          >
            {toast.tone === 'error' ? (
              <CircleAlert aria-hidden className="mt-0.5 size-4.5 shrink-0 text-[#fca5a5]" />
            ) : (
              <CircleCheck aria-hidden className="mt-0.5 size-4.5 shrink-0 text-success" />
            )}
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className={cx(
                'shrink-0 rounded-full p-1 transition-colors',
                toast.tone === 'error' ? 'hover:bg-white/15' : 'hover:bg-ink-100',
              )}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
