'use client';

import { SendHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cx } from '@/lib/utils';

interface MessageComposerProps {
  conversationId: string;
  conversationTitle: string;
  draft: string;
  onDraftChange: (conversationId: string, value: string) => void;
  /** Called on each keystroke; the hook throttles the outgoing signal. */
  onTyping: () => void;
  onSend: (text: string) => Promise<void>;
  isDisconnected: boolean;
}

const MAX_TEXTAREA_HEIGHT = 160;

export function MessageComposer({
  conversationId,
  conversationTitle,
  draft,
  onDraftChange,
  onTyping,
  onSend,
  isDisconnected,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSending, setIsSending] = useState(false);

  const canSend = draft.trim().length > 0 && !isSending;

  // Grow with the content up to a cap, then scroll internally.
  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(resize, [draft, resize]);

  // Focus the composer when the conversation changes so typing can start immediately.
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) textareaRef.current?.focus();
  }, [conversationId]);

  // Keyboard shortcut: Escape blurs, and "/" from anywhere focuses the composer.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (isTyping) return;
      // Don't steal focus out of an open dialog and into the composer behind it.
      if (document.querySelector('[role="dialog"]')) return;

      event.preventDefault();
      textareaRef.current?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const submit = useCallback(async () => {
    const text = draft.trim();
    // Guards an empty/whitespace send and a double submit from a fast second Enter.
    if (!text || isSending) return;

    setIsSending(true);
    try {
      await onSend(text);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [draft, isSending, onSend]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t border-ink-100 bg-surface px-3 py-3 sm:px-6 sm:py-4">
      {isDisconnected && (
        <p className="mb-2 text-xs text-ink-500" role="status">
          You&apos;re offline — reconnecting. Messages you send may not go through yet.
        </p>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Message {conversationTitle}
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(event) => {
            onDraftChange(conversationId, event.target.value);
            // Only signal on real content — clearing the box isn't typing.
            if (event.target.value.trim()) onTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${conversationTitle}`}
          className={cx(
            'scroll-subtle max-h-40 min-h-11 flex-1 resize-none rounded-2xl bg-paper px-4 py-2.5',
            'text-[0.9375rem] leading-relaxed text-ink-900 ring-1 ring-inset ring-ink-200',
            'transition-shadow placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900',
          )}
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-full transition-all',
            'active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100',
            canSend
              ? 'bg-ink-900 text-white hover:bg-ink-800'
              : 'bg-ink-100 text-ink-300',
          )}
        >
          <SendHorizontal aria-hidden className="size-4.5" />
        </button>
      </form>

      <p className="mt-2 hidden text-[0.6875rem] text-ink-400 sm:block">
        <kbd className="font-sans font-medium">Enter</kbd> to send ·{' '}
        <kbd className="font-sans font-medium">Shift + Enter</kbd> for a new line
      </p>
    </div>
  );
}
