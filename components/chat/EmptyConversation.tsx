import { MessageSquarePlus, UsersRound } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface EmptyConversationProps {
  hasConversations: boolean;
  isLoading: boolean;
  onNewChat: () => void;
  onNewGroup: () => void;
}

/** Desktop-only resting state shown when no conversation is selected. */
export function EmptyConversation({
  hasConversations,
  isLoading,
  onNewChat,
  onNewGroup,
}: EmptyConversationProps) {
  return (
    <div className="texture-dots flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <span
          aria-hidden
          className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-surface text-ink-700 shadow-soft ring-1 ring-ink-100"
        >
          <MessageSquarePlus className="size-6" strokeWidth={1.75} />
        </span>

        <h2 className="font-display text-2xl tracking-tight text-ink-950">
          {hasConversations ? 'Pick up where you left off' : 'Start your first conversation'}
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
          {isLoading
            ? 'Loading your conversations…'
            : hasConversations
              ? 'Choose a conversation from the list to read it, or start a new one.'
              : 'Find someone by name to send your first message, or gather a few people into a group.'}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={onNewChat}>
            <MessageSquarePlus aria-hidden className="size-4" />
            New chat
          </Button>
          <Button variant="secondary" size="sm" onClick={onNewGroup}>
            <UsersRound aria-hidden className="size-4" />
            New group
          </Button>
        </div>
      </div>
    </div>
  );
}
