'use client';

import { LogOut } from 'lucide-react';

import { ConnectionIndicator } from '@/components/chat/ConnectionIndicator';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import type { ConnectionStatus, User } from '@/types/chat';

interface CurrentUserBarProps {
  user: User;
  connectionStatus: ConnectionStatus;
}

export function CurrentUserBar({ user, connectionStatus }: CurrentUserBarProps) {
  const { logout } = useAuth();

  return (
    <header className="flex items-center gap-3 px-4 py-4">
      <Avatar name={user.name} seed={user.id} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold leading-tight text-ink-950">
          {user.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="truncate text-xs text-ink-400">{user.phone}</p>
          <ConnectionIndicator status={connectionStatus} />
        </div>
      </div>

      <button
        type="button"
        onClick={logout}
        aria-label="Sign out"
        title="Sign out"
        className="shrink-0 rounded-full p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        <LogOut aria-hidden className="size-4.5" />
      </button>
    </header>
  );
}
