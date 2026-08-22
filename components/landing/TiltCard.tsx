'use client';

import { useEffect, useRef } from 'react';

import { cx } from '@/lib/utils';

/** Half the total travel, in degrees, on each axis. */
const MAX_TILT = 5;

/**
 * Tilts its contents toward the pointer, giving a flat card some depth.
 *
 * Skipped on coarse pointers — there is no hover on touch, so the effect would
 * only ever be seen mid-tap — and under reduced motion.
 */
export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;

    const handleMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
        const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
        element.style.setProperty('--tilt-y', `${offsetX * MAX_TILT * 2}deg`);
        // Inverted: the pointer should push the near edge away, not pull it.
        element.style.setProperty('--tilt-x', `${-offsetY * MAX_TILT * 2}deg`);
      });
    };

    const handleLeave = () => {
      cancelAnimationFrame(frame);
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    };

    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerleave', handleLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  return (
    <div ref={ref} className={cx('tilt-card', className)}>
      {children}
    </div>
  );
}
