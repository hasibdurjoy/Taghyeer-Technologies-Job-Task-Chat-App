'use client';

import { ArrowLeft, PanelRight } from 'lucide-react';

import { TypingLabel } from '@/components/chat/TypingIndicator';
import { Avatar } from '@/components/ui/Avatar';
import { cx } from '@/lib/utils';
import type { Conversation, TypingUser } from '@/types/chat';

interface ChatHeaderProps {
  conversation: Conversation;
  typingUsers: TypingUser[];
  /** Returns to the conversation list on mobile. */
  onBack: () => void;
  isDetailsOpen: boolean;
  /** Shows or hides the details column. Wide screens only — see `ChatLayout`. */
  onToggleDetails: () => void;
}

export function ChatHeader({
  conversation,
  typingUsers,
  onBack,
  isDetailsOpen,
  onToggleDetails,
}: ChatHeaderProps) {
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

      {/*
        Available at every size. Above `xl` it docks the details column; below
        that there is no room for a third column, so it opens the same panel as
        a sheet — group management must not be desktop-only.
      */}
      <button
        type="button"
        onClick={onToggleDetails}
        aria-pressed={isDetailsOpen}
        aria-label={isDetailsOpen ? 'Hide conversation details' : 'Show conversation details'}
        title={isDetailsOpen ? 'Hide details' : 'Show details'}
        className={cx(
          'inline-flex shrink-0 rounded-full p-2 transition-colors',
          isDetailsOpen
            ? 'bg-ink-100 text-ink-900'
            : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
        )}
      >
        <PanelRight aria-hidden className="size-5" />
      </button>
    </header>
  );
}
