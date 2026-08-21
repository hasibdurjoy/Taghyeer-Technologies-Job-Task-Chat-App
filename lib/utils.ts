/** Joins class names, skipping falsy values. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** Up to two initials for an avatar, falling back to a neutral glyph. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Picks a stable accent for an avatar from the user's id.
 *
 * Deterministic so the same person keeps the same colour across sessions and
 * devices, which makes a busy conversation list easier to scan.
 */
const AVATAR_TONES = [
  'bg-[#1e2634] text-white',
  'bg-[#2f4858] text-white',
  'bg-[#33565b] text-white',
  'bg-[#5b4636] text-white',
  'bg-[#4a3b5c] text-white',
  'bg-[#8a5a2b] text-white',
] as const;

export function avatarTone(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
