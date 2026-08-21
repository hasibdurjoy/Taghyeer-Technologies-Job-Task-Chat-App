/** Client-side validation. The API validates too, but catching it here avoids a wasted round-trip. */

export interface FieldErrors {
  phone?: string;
  name?: string;
}

/**
 * Phone validation is intentionally permissive.
 *
 * The API stores whatever string it is given — the seeded data contains both
 * `+8801700000001` and `01672589498` — so this only rejects input that is
 * clearly not a phone number rather than enforcing a single format.
 */
export function validatePhone(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your phone number.';

  const digitCount = trimmed.replace(/\D/g, '').length;
  if (digitCount < 6) return 'That phone number looks too short.';
  if (digitCount > 15) return 'That phone number looks too long.';
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) {
    return 'Use digits only, optionally starting with +.';
  }
  return undefined;
}

export function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your name.';
  if (trimmed.length < 2) return 'Your name needs at least 2 characters.';
  if (trimmed.length > 60) return 'Your name is too long (60 characters max).';
  return undefined;
}

export function validateLogin(phone: string, name: string): FieldErrors {
  const errors: FieldErrors = {};
  const phoneError = validatePhone(phone);
  const nameError = validateName(name);
  if (phoneError) errors.phone = phoneError;
  if (nameError) errors.name = nameError;
  return errors;
}

export function validateGroupName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Give the group a name.';
  if (trimmed.length > 60) return 'Group names are limited to 60 characters.';
  return undefined;
}
