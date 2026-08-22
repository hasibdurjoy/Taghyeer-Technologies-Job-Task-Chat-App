'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { UserSearchResults } from '@/components/chat/UserSearchResults';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useUserSearch } from '@/hooks/useUserSearch';
import type { Conversation, User } from '@/types/chat';

interface AddMembersDialogProps {
  conversation: Conversation;
  token: string;
  currentUser: User;
  isPending: boolean;
  onAdd: (userIds: string[]) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Adds people to an existing group.
 *
 * Deliberately close in shape to the create-group dialog — same search, same
 * chips — because it is the same task at a different moment, and inventing a
 * second interaction for it would only make the app harder to learn.
 */
export function AddMembersDialog({
  conversation,
  token,
  currentUser,
  isPending,
  onAdd,
  onClose,
}: AddMembersDialogProps) {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<User[]>([]);

  const search = useUserSearch(token, currentUser.id, term);

  // Existing members are labelled and can't be picked: re-adding is a harmless
  // no-op upstream, but offering it would imply it does something.
  const memberIds = [currentUser.id, ...conversation.participants.map((p) => p.id)];

  const toggle = (user: User) => {
    if (memberIds.includes(user.id)) return;
    setSelected((current) =>
      current.some((entry) => entry.id === user.id)
        ? current.filter((entry) => entry.id !== user.id)
        : [...current, user],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending || selected.length === 0) return;
    const succeeded = await onAdd(selected.map((user) => user.id));
    if (succeeded) onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={`Add people to ${conversation.title}`}
      description="Search for someone by name or phone number."
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
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
            disabled={isPending}
          />

          {selected.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {selected.map((user) => (
                <li key={user.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 py-1 pl-1 pr-1 text-sm text-ink-900">
                    <Avatar
                      name={user.name}
                      seed={user.id}
                      size="sm"
                      className="size-6 text-[0.625rem]"
                    />
                    <span className="max-w-32 truncate font-medium">{user.name}</span>
                    <button
                      type="button"
                      onClick={() => toggle(user)}
                      aria-label={`Remove ${user.name} from the selection`}
                      disabled={isPending}
                      className="rounded-full p-1 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-900"
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
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
            onSelect={toggle}
            selectedIds={selected.map((user) => user.id)}
            existingIds={memberIds}
            existingLabel="Already in group"
            disableExisting
          />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-4 sm:px-6">
          <p className="text-sm text-ink-500">
            {selected.length === 0
              ? 'No one selected yet'
              : `${selected.length} selected`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isPending}
              disabled={selected.length === 0}
            >
              {isPending ? 'Adding…' : 'Add to group'}
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
