'use client';

import { MessageSquarePlus, Search, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ConversationItem } from '@/components/chat/ConversationItem';
import { CurrentUserBar } from '@/components/chat/CurrentUserBar';
import { Button } from '@/components/ui/Button';
import { ConversationSkeleton, EmptyState, ErrorState } from '@/components/ui/StateViews';
import { TextField } from '@/components/ui/TextField';
import { cx } from '@/lib/utils';
import type { ConnectionStatus, Conversation, User } from '@/types/chat';

interface ConversationSidebarProps {
  className?: string;
  currentUser: User;
  conversations: Conversation[];
  unreadCounts: Record<string, number>;
  activeId: string | null;
  isLoading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  onRetry: () => void;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
}

export function ConversationSidebar({
  className,
  currentUser,
  conversations,
  unreadCounts,
  activeId,
  isLoading,
  error,
  connectionStatus,
  onRetry,
  onSelect,
  onNewChat,
  onNewGroup,
}: ConversationSidebarProps) {
  const [filter, setFilter] = useState('');

  // Filtering existing conversations is purely local — finding *new* people is a
  // separate flow, because the API's search endpoint only returns users.
  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => {
      if (conversation.title.toLowerCase().includes(term)) return true;
      return conversation.participants.some(
        (participant) =>
          participant.name.toLowerCase().includes(term) || participant.phone.includes(term),
      );
    });
  }, [conversations, filter]);

  return (
    <aside className={cx('flex-col', className)} aria-label="Conversations">
      <CurrentUserBar user={currentUser} connectionStatus={connectionStatus} />

      <div className="space-y-3 border-b border-ink-100 px-4 pb-4">
        <TextField
          label="Filter your conversations"
          hideLabel
          type="search"
          placeholder="Filter conversations"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          leadingIcon={<Search className="size-4" />}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onNewChat} className="flex-1">
            <MessageSquarePlus aria-hidden className="size-4" />
            New chat
          </Button>
          <Button variant="secondary" size="sm" onClick={onNewGroup} className="flex-1">
            <UsersRound aria-hidden className="size-4" />
            New group
          </Button>
        </div>
      </div>

      <div className="scroll-subtle min-h-0 flex-1 overflow-y-auto">
        <SidebarBody
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          conversations={conversations}
          visible={visible}
          filter={filter}
          unreadCounts={unreadCounts}
          activeId={activeId}
          onSelect={onSelect}
          onNewChat={onNewChat}
        />
      </div>
    </aside>
  );
}

/** Split out so the sidebar shell stays flat instead of nesting conditionals. */
function SidebarBody({
  isLoading,
  error,
  onRetry,
  conversations,
  visible,
  filter,
  unreadCounts,
  activeId,
  onSelect,
  onNewChat,
}: {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  conversations: Conversation[];
  visible: Conversation[];
  filter: string;
  unreadCounts: Record<string, number>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  if (isLoading && conversations.length === 0) return <ConversationSkeleton />;

  if (error && conversations.length === 0) {
    return <ErrorState message={error} onRetry={onRetry} title="Couldn't load conversations" />;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquarePlus className="size-5" />}
        title="No conversations yet"
        description="Search for someone by name to start your first conversation."
        action={
          <Button size="sm" onClick={onNewChat}>
            Start a conversation
          </Button>
        }
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<Search className="size-5" />}
        title="No matches"
        description={`Nothing in your conversations matches “${filter.trim()}”.`}
      />
    );
  }

  return (
    <ul className="space-y-0.5 p-2">
      {visible.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeId}
          unreadCount={unreadCounts[conversation.id] ?? 0}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
