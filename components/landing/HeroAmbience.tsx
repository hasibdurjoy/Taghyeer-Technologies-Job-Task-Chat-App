'use client';

import { useEffect, useRef } from 'react';

/**
 * Brand light that follows the pointer across the hero.
 *
 * Coordinates are written straight to custom properties rather than through
 * React state — this updates on every mouse move, and a render per frame would
 * be wasted work for something no other component reads.
 */
export function HeroAmbience() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // A spotlight that tracks a cursor is meaningless without one, and motion
    // this large is exactly what reduced-motion is asking us not to do.
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;

    const handleMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        element.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
        element.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
        // Faded in on first movement so it never sits parked in the corner.
        element.style.opacity = '1';
      });
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="hero-spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700"
    />
  );
}
