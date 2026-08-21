'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { UserSearchResults } from '@/components/chat/UserSearchResults';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useUserSearch } from '@/hooks/useUserSearch';
import { startDirectConversation } from '@/lib/api/conversations';
import type { Conversation, User } from '@/types/chat';

interface NewConversationDialogProps {
  onClose: () => void;
  token: string;
  currentUser: User;
  conversations: Conversation[];
  onOpenConversation: (conversationId: string) => void;
}

/**
 * Start a 1-to-1 conversation from a user search result.
 *
 * No duplicate check is needed: `POST /conversations` is idempotent upstream and
 * returns the existing conversation for a pair. Existing chats are still labelled
 * so the user understands where they're about to land.
 *
 * The parent mounts this only while it is open, so closing it discards the search
 * term and results naturally — no reset effect required.
 */
export function NewConversationDialog({
  onClose,
  token,
  currentUser,
  conversations,
  onOpenConversation,
}: NewConversationDialogProps) {
  const { showToast } = useToast();
  const [term, setTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const search = useUserSearch(token, currentUser.id, term);

  const existingIds = conversations
    .filter((conversation) => conversation.type === 'direct')
    .map((conversation) => conversation.participants[0]?.id)
    .filter((id): id is string => Boolean(id));

  const handleSelect = async (user: User) => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const conversationId = await startDirectConversation(token, user.id);
      onOpenConversation(conversationId);
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? `Could not open that conversation: ${error.message}`
          : 'Could not open that conversation.',
      );
      setBusyId(null);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New conversation"
      description="Search for someone by name or phone number."
    >
      <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
        <TextField
          label="Search people"
          hideLabel
          type="search"
          autoComplete="off"
          placeholder="Search by name or phone number"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          leadingIcon={<Search className="size-4" />}
        />
      </div>

      <div className="scroll-subtle min-h-64 flex-1 overflow-y-auto py-2">
        <UserSearchResults
          term={term}
          results={search.results}
          isSearching={search.isSearching}
          error={search.error}
          hasSearched={search.hasSearched}
          truncated={search.truncated}
          phoneSearchLimited={search.phoneSearchLimited}
          onRetry={search.retry}
          onSelect={handleSelect}
          existingIds={existingIds}
          busyId={busyId}
        />
      </div>
    </Modal>
  );
}
