'use client';

import Link from 'next/link';

import { HeaderMessagesMenu } from '@/components/landing/HeaderMessagesMenu';
import { StartCta } from '@/components/landing/StartCta';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';

/**
 * The right-hand side of the landing header.
 *
 * Signed out it is the sign-in call to action; signed in it becomes the
 * messages menu and the user's avatar. The call to action is dropped in that
 * state rather than kept alongside — the menu's own "Open all in Messengo"
 * already does that job, and two buttons pointing at `/chat` is one too many.
 *
 * Keyed on the session rather than on `isRestoring`, which starts `true` and
 * would therefore render a placeholder into the server HTML that every signed
 * *out* visitor sees before it resolves. The session store has a server
 * snapshot, so a stored user is present on the very first client render.
 */
export function HeaderAccount() {
  const { user, token } = useAuth();

  if (!user || !token) return <StartCta size="md" />;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <HeaderMessagesMenu currentUser={user} token={token} />

      <Link
        href="/chat"
        aria-label={`Open Messengo as ${user.name}`}
        className="rounded-full transition-transform hover:-translate-y-0.5"
      >
        <Avatar name={user.name} seed={user.id} size="sm" />
      </Link>
    </div>
  );
}
