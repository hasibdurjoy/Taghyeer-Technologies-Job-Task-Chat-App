'use client';

import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useNotificationSound } from '@/hooks/useNotificationSound';
import { cx } from '@/lib/utils';

/** Long enough to read as a response to the click, short enough not to linger. */
const PING_MS = 900;

/**
 * Plays the app's real arrival sound.
 *
 * The same file and the same hook the chat uses, so this is the product's own
 * notification rather than a marketing approximation. Click-driven by
 * definition, which is also what satisfies the browser's autoplay policy.
 */
export function SoundDemo() {
  const playNotificationSound = useNotificationSound();
  const [isPinging, setIsPinging] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleClick = () => {
    playNotificationSound();
    setIsPinging(true);
    // Restart the pulse on a repeat click rather than letting the first finish.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsPinging(false), PING_MS);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cx(
        'group inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm font-medium',
        'text-ink-700 shadow-soft ring-1 ring-ink-100 transition-all',
        'hover:-translate-y-0.5 hover:text-ink-950 hover:shadow-lifted active:translate-y-0',
      )}
    >
      <span className="relative flex size-4 items-center justify-center">
        {isPinging && (
          <span
            aria-hidden
            className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500/50"
          />
        )}
        <Volume2
          aria-hidden
          className={cx(
            'relative size-4 transition-colors',
            isPinging ? 'text-brand-600' : 'text-ink-400 group-hover:text-brand-600',
          )}
        />
      </span>
      Hear it arrive
    </button>
  );
}
