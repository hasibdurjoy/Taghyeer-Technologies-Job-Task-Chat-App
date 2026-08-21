import { Users } from 'lucide-react';

import { avatarTone, cx, initialsOf } from '@/lib/utils';

const SIZES = {
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
} as const;

interface AvatarProps {
  name: string;
  /** Seeds the colour so a person keeps the same tone everywhere. */
  seed: string;
  size?: keyof typeof SIZES;
  isGroup?: boolean;
  className?: string;
}

export function Avatar({ name, seed, size = 'md', isGroup = false, className }: AvatarProps) {
  return (
    <span
      // Decorative: the adjacent text always names the person or group.
      aria-hidden
      className={cx(
        'flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide',
        SIZES[size],
        isGroup ? 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200' : avatarTone(seed),
        className,
      )}
    >
      {isGroup ? <Users className="size-1/2" strokeWidth={2} /> : initialsOf(name)}
    </span>
  );
}
