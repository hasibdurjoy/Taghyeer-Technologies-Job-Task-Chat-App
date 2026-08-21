'use client';

import { ArrowLeft } from 'lucide-react';

import { TypingLabel } from '@/components/chat/TypingIndicator';
import { Avatar } from '@/components/ui/Avatar';
import type { Conversation, TypingUser } from '@/types/chat';

interface ChatHeaderProps {
  conversation: Conversation;
  typingUsers: TypingUser[];
  /** Returns to the conversation list on mobile. */
  onBack: () => void;
}

export function ChatHeader({ conversation, typingUsers, onBack }: ChatHeaderProps) {
  const isGroup = conversation.type === 'group';

  const subtitle = isGroup
    ? `${conversation.participants.length + 1} members · ${conversation.participants
        .slice(0, 3)
        .map((participant) => participant.name.split(' ')[0])
        .join(', ')}${conversation.participants.length > 3 ? '…' : ''}`
    : (conversation.participants[0]?.phone ?? '');

  return (
    <header className="flex items-center gap-3 border-b border-ink-100 bg-surface px-3 py-3 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to conversations"
        className="-ml-1 shrink-0 rounded-full p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 md:hidden"
      >
        <ArrowLeft aria-hidden className="size-5" />
      </button>

      <Avatar
        name={conversation.title}
        seed={isGroup ? conversation.id : (conversation.participants[0]?.id ?? conversation.id)}
        isGroup={isGroup}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[0.9375rem] font-semibold leading-tight text-ink-950">
          {conversation.title}
        </h1>
        {typingUsers.length > 0 ? (
          <TypingLabel users={typingUsers} className="truncate text-xs" />
        ) : (
          subtitle && <p className="truncate text-xs text-ink-400">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
