'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ChatLayout } from '@/components/chat/ChatLayout';
import { useAuth } from '@/hooks/useAuth';

/**
 * Route guard for the chat.
 *
 * The session lives in the browser (the bearer token has to reach both `fetch`
 * and the Socket.io handshake), so the guard runs on the client. `ChatLayout` is
 * only mounted once a session exists, which lets everything below it treat the
 * user and token as non-nullable.
 */
export function ChatWorkspace() {
  const router = useRouter();
  const { user, token, isRestoring } = useAuth();

  useEffect(() => {
    if (!isRestoring && !user) router.replace('/login');
  }, [isRestoring, user, router]);

  if (isRestoring || !user || !token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3 text-ink-500">
          <Loader2 aria-hidden className="size-6 animate-spin" />
          <p className="text-sm">{isRestoring ? 'Restoring your session…' : 'Redirecting…'}</p>
        </div>
      </div>
    );
  }

  return <ChatLayout currentUser={user} token={token} />;
}
