'use client';

import { Check, SendHorizontal, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cx } from '@/lib/utils';

/**
 * The product preview: a scripted conversation that plays out in the real chat
 * UI's styling, so what you see on the landing page is what you get in the app.
 *
 * It is deliberately restrained — messages land one at a time with a typing
 * indicator, then the loop restarts. The animation pauses when scrolled out of
 * view and is skipped entirely under `prefers-reduced-motion`, where the full
 * conversation is shown at rest instead.
 */

interface ScriptedMessage {
  id: number;
  author: string;
  text: string;
  isOwn: boolean;
  time: string;
  /** Pause before this message appears, in milliseconds. */
  delay: number;
}

const SCRIPT: ScriptedMessage[] = [
  { id: 1, author: 'Priya', text: 'Room is booked for Thursday at 3.', isOwn: false, time: '09:41', delay: 900 },
  { id: 2, author: 'You', text: 'Perfect. I’ll bring the deck.', isOwn: true, time: '09:41', delay: 1500 },
  { id: 3, author: 'Marcus', text: 'Can we push to 3:30? Standup always runs long.', isOwn: false, time: '09:42', delay: 1900 },
  { id: 4, author: 'You', text: '3:30 works for me.', isOwn: true, time: '09:42', delay: 1500 },
  { id: 5, author: 'Priya', text: 'Done — moved it. See you both then 👋', isOwn: false, time: '09:43', delay: 1800 },
];

const RESTART_DELAY = 3600;

export function ChatPreview({ className }: { className?: string }) {
  // Starts with the whole conversation shown: that is the correct resting state
  // for reduced motion and for browsers that never run the effect. The animation
  // rewinds to zero itself when it begins.
  const [visibleCount, setVisibleCount] = useState(SCRIPT.length);
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let isPlaying = false;
    let cancelled = false;

    const step = (index: number) => {
      if (cancelled) return;

      if (index >= SCRIPT.length) {
        timer = setTimeout(() => {
          setVisibleCount(0);
          step(0);
        }, RESTART_DELAY);
        return;
      }

      const message = SCRIPT[index];
      // Only incoming messages get a typing indicator — you don't watch yourself type.
      if (!message.isOwn) setIsTyping(true);

      timer = setTimeout(() => {
        if (cancelled) return;
        setIsTyping(false);
        setVisibleCount(index + 1);
        step(index + 1);
      }, message.delay);
    };

    // Don't animate off-screen: saves work and means the loop starts when seen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isPlaying) {
          isPlaying = true;
          setVisibleCount(0);
          step(0);
        } else if (!entry.isIntersecting && isPlaying) {
          isPlaying = false;
          clearTimeout(timer);
        }
      },
      { threshold: 0.25 },
    );

    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // Keep the newest message in view as the script plays.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [visibleCount, isTyping]);

  return (
    <div
      ref={containerRef}
      className={cx(
        'overflow-hidden rounded-card bg-surface shadow-lifted ring-1 ring-ink-100',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-ink-100 text-ink-700"
        >
          <Users className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-ink-950">Design Review</p>
          <p className="text-xs text-ink-400">3 members · Priya, Marcus</p>
        </div>
        <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-success">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          Live
        </span>
      </div>

      <div
        ref={scrollRef}
        // Decorative marketing content — the real app is announced properly.
        aria-hidden
        className="h-72 space-y-2 overflow-hidden bg-paper px-4 py-4 sm:h-80"
      >
        <div className="flex justify-center pb-1">
          <span className="rounded-full bg-paper-dim px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">
            Today
          </span>
        </div>

        {SCRIPT.slice(0, visibleCount).map((message) => (
          <div
            key={message.id}
            className={cx('flex animate-pop', message.isOwn ? 'justify-end' : 'justify-start')}
          >
            <div className="max-w-[82%]">
              {!message.isOwn && (
                <p className="mb-1 pl-3 text-xs font-medium text-ink-500">{message.author}</p>
              )}
              <div
                className={cx(
                  'rounded-bubble px-3.5 py-2',
                  message.isOwn
                    ? 'rounded-tr-md bg-ink-900 text-white'
                    : 'rounded-tl-md bg-surface text-ink-900 ring-1 ring-inset ring-ink-100',
                )}
              >
                <p className="text-sm leading-relaxed">{message.text}</p>
                <div
                  className={cx(
                    'mt-1 flex items-center justify-end gap-1 text-[0.625rem]',
                    message.isOwn ? 'text-white/55' : 'text-ink-400',
                  )}
                >
                  {message.time}
                  {message.isOwn && <Check aria-hidden className="size-3" />}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isTyping && <TypingIndicator />}
      </div>

      <div className="flex items-center gap-2 border-t border-ink-100 bg-surface px-4 py-3">
        <div className="h-10 flex-1 rounded-2xl bg-paper px-4 py-2.5 text-sm text-ink-400 ring-1 ring-inset ring-ink-200">
          Message Design Review
        </div>
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-300"
        >
          <SendHorizontal className="size-4" />
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-bubble rounded-tl-md bg-surface px-3.5 py-3 ring-1 ring-inset ring-ink-100">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 rounded-full bg-ink-300"
            style={{
              animation: 'pulse-ring 1.4s ease-in-out infinite',
              animationDelay: `${index * 160}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
