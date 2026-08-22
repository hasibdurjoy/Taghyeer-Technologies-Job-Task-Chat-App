import Image from 'next/image';

import { cx } from '@/lib/utils';

/** Intrinsic size of the source file; Next reserves space from the ratio. */
const LOGO_WIDTH = 1955;
const LOGO_HEIGHT = 455;

interface WordmarkProps {
  className?: string;
  /** Set on above-the-fold placements so the mark isn't lazy-loaded. */
  priority?: boolean;
}

/**
 * The product mark — the full Messengo lockup, icon and name together.
 *
 * Sized by height so a caller adjusts it with one class and the width follows
 * the source ratio. `alt` carries the product name, which is what the mark says.
 */
export function Wordmark({ className, priority = false }: WordmarkProps) {
  return (
    <Image
      src="/messengo-logo.webp"
      alt="Messengo"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={cx('h-8 w-auto', className)}
    />
  );
}
