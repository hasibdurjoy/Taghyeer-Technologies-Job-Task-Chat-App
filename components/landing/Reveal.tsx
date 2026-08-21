'use client';

import { useEffect, useRef, useState } from 'react';

import { cx } from '@/lib/utils';

interface RevealProps {
  children: React.ReactNode;
  /** Stagger, in milliseconds, applied when the element enters the viewport. */
  delay?: number;
  className?: string;
}

/**
 * Reveals content once as it scrolls into view.
 *
 * Uses IntersectionObserver rather than a scroll listener, so nothing runs on
 * the main thread between reveals, and disconnects as soon as it has fired.
 *
 * The hidden state is expressed in CSS (`.reveal`), not in React state, which
 * keeps the markup identical on the server and means content is never left
 * invisible if JavaScript fails to run. `prefers-reduced-motion` disables the
 * hiding entirely in the stylesheet.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={cx('reveal', isVisible && 'reveal-visible', className)}
    >
      {children}
    </div>
  );
}
