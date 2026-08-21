'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cx } from '@/lib/utils';

interface ModalProps {
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible dialog: Escape to close, click-outside to close, focus moved in on
 * open and returned to the trigger on close, and focus trapped while open.
 *
 * Built directly rather than pulling in a dialog library — this is the only
 * modal in the app and the behaviour needed is small and explicit.
 *
 * Callers mount this only while the dialog is open, so there is no `isOpen`
 * prop: closing unmounts it, which discards the dialog's draft state for free.
 */
export function Modal({ onClose, title, description, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Focus the first meaningful control so keyboard users start inside the dialog.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, button:not([data-close]), [href], select',
    );
    focusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const targets = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);

      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Stop the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        // Only close on a press that both starts and ends on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className={cx(
          'flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-lifted',
          'animate-pop rounded-t-3xl sm:max-w-lg sm:rounded-card',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-ink-900">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="mt-1 text-sm text-ink-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 shrink-0 rounded-full p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
