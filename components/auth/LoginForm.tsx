'use client';

import { ArrowLeft, ArrowRight, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, NetworkError } from '@/lib/api/http';
import { lastLoginStore } from '@/lib/auth/session';
import { validateLogin, type FieldErrors } from '@/lib/validation';

/**
 * Login screen.
 *
 * The API has no separate signup: an unknown phone number is registered
 * automatically and a known one signs in, so the form is framed as "continue"
 * rather than making the user choose between two flows.
 */
export function LoginForm() {
  const router = useRouter();
  const { login, user, isRestoring } = useAuth();

  // Pre-fill from the last session so returning users don't retype — and so they
  // keep the same display name, which a differing name would silently overwrite.
  const lastLogin = useSyncExternalStore(
    lastLoginStore.subscribe,
    lastLoginStore.getSnapshot,
    lastLoginStore.getServerSnapshot,
  );

  // `null` means "not edited yet", so the remembered value shows through until
  // the user types. Reading the store during render keeps this hydration-safe.
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string | null>(null);
  const phone = phoneInput ?? lastLogin?.phone ?? '';
  const name = nameInput ?? lastLogin?.name ?? '';

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // An already-signed-in visitor goes straight to the chat.
  useEffect(() => {
    if (!isRestoring && user) router.replace('/chat');
  }, [isRestoring, user, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateLogin(phone, name);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login(phone, name);
      router.replace('/chat');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        // Map upstream validation details onto the field they belong to.
        const mapped: FieldErrors = {};
        for (const detail of error.details) {
          if (detail.path === 'phone') mapped.phone = detail.message;
          if (detail.path === 'name') mapped.name = detail.message;
        }
        if (Object.keys(mapped).length > 0) {
          setFieldErrors(mapped);
        } else {
          setFormError(error.message);
        }
      } else if (error instanceof NetworkError) {
        setFormError(
          'Could not reach the server. It may be waking up from sleep — try again in a moment.',
        );
      } else {
        setFormError('Something went wrong signing you in. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to home
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <span
                aria-hidden
                className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-ink-900 text-white"
              >
                <MessagesSquare className="size-6" strokeWidth={1.75} />
              </span>
              <h1 className="font-display text-4xl leading-tight tracking-tight text-ink-950">
                Welcome to Parley
              </h1>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
                Enter your phone number and name to continue. If you&apos;re new here, your account
                is created automatically.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-ink-100 sm:p-7"
            >
              <div className="space-y-4">
                <TextField
                  label="Phone number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+15551234567"
                  value={phone}
                  onChange={(event) => {
                    setPhoneInput(event.target.value);
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  error={fieldErrors.phone}
                  hint="Include your country code, e.g. +1 or +880."
                  disabled={isSubmitting}
                  required
                />

                <TextField
                  label="Your name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(event) => {
                    setNameInput(event.target.value);
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  error={fieldErrors.name}
                  hint="This is how other people will see you."
                  disabled={isSubmitting}
                  required
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-danger-soft px-3.5 py-3 text-sm leading-relaxed text-danger"
                >
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isSubmitting}
                className="mt-6"
              >
                {isSubmitting ? 'Signing you in…' : 'Continue'}
                {!isSubmitting && <ArrowRight aria-hidden className="size-4" />}
              </Button>

              <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
                Signing in with a number you&apos;ve used before updates your display name to the
                one entered above.
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
