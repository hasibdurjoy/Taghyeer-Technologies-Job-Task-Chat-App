import { cx } from '@/lib/utils';
import type { TypingUser } from '@/types/chat';

/** "Ada is typing", "Ada and Grace are typing", "3 people are typing". */
export function describeTyping(users: TypingUser[]): string | null {
  if (users.length === 0) return null;

  const firstNames = users.map((user) => user.name.trim().split(/\s+/)[0]);

  if (users.length === 1) return `${firstNames[0]} is typing`;
  if (users.length === 2) return `${firstNames[0]} and ${firstNames[1]} are typing`;
  return `${users.length} people are typing`;
}

/** The three-dot bubble, aligned like an incoming message. */
export function TypingBubble({ users }: { users: TypingUser[] }) {
  const label = describeTyping(users);
  if (!label) return null;

  return (
    <div className="mt-3 flex flex-col items-start">
      <span className="mb-1 pl-3 text-xs font-medium text-ink-500">{label}</span>
      <div
        className="flex items-center gap-1 rounded-bubble rounded-tl-md bg-surface px-3.5 py-3 ring-1 ring-inset ring-ink-100"
        role="status"
        aria-label={label}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden
            className="size-1.5 rounded-full bg-ink-300"
            style={{ animation: 'typing-dot 1.3s ease-in-out infinite', animationDelay: `${index * 180}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Compact one-line form, used in the conversation header. */
export function TypingLabel({ users, className }: { users: TypingUser[]; className?: string }) {
  const label = describeTyping(users);
  if (!label) return null;

  return (
    <span className={cx('inline-flex items-center gap-1.5 text-success', className)}>
      <span aria-hidden className="flex items-center gap-0.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1 rounded-full bg-success"
            style={{ animation: 'typing-dot 1.3s ease-in-out infinite', animationDelay: `${index * 180}ms` }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
