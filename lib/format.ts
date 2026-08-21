/** Date and time formatting shared by the conversation list and message view. */

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000);
}

/** Clock time for a message bubble, e.g. "14:32". */
export function formatMessageTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** Full timestamp for a bubble's `title`/`dateTime`, so the exact time is always available. */
export function formatFullTimestamp(iso: string): string {
  const date = new Date(iso);
  return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`;
}

/** Heading for a date separator: "Today", "Yesterday", a weekday, or a full date. */
export function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  const distance = daysBetween(date, new Date());

  if (distance === 0) return 'Today';
  if (distance === 1) return 'Yesterday';
  if (distance > 1 && distance < 7) return weekdayFormatter.format(date);
  return dateFormatter.format(date);
}

/** True when two messages fall on different calendar days. */
export function isNewDay(previousIso: string | null, currentIso: string): boolean {
  if (!previousIso) return true;
  return startOfDay(new Date(previousIso)) !== startOfDay(new Date(currentIso));
}

/** Compact timestamp for the conversation list: time today, weekday this week, else a date. */
export function formatRelativeTimestamp(iso: string): string {
  const date = new Date(iso);
  const distance = daysBetween(date, new Date());

  if (distance === 0) return timeFormatter.format(date);
  if (distance === 1) return 'Yesterday';
  if (distance > 1 && distance < 7) return weekdayFormatter.format(date);
  return shortDateFormatter.format(date);
}
