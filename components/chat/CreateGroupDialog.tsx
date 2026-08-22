'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { UserSearchResults } from '@/components/chat/UserSearchResults';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useUserSearch } from '@/hooks/useUserSearch';
import { createGroup } from '@/lib/api/conversations';
import { ApiError } from '@/lib/api/http';
import { validateGroupName } from '@/lib/validation';
import type { User } from '@/types/chat';

interface CreateGroupDialogProps {
  onClose: () => void;
  token: string;
  currentUser: User;
  onCreated: (conversationId: string) => void;
}

/** Upstream requires three members total, so at least two others must be chosen. */
const MIN_OTHER_PARTICIPANTS = 2;

/**
 * Mounted by the parent only while open, so closing discards the draft group
 * (name, selection, errors) without a reset effect.
 */
export function CreateGroupDialog({
  onClose,
  token,
  currentUser,
  onCreated,
}: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const search = useUserSearch(token, currentUser.id, term);

  const toggleParticipant = (user: User) => {
    setFormError(null);
    setSelected((current) =>
      current.some((entry) => entry.id === user.id)
        ? current.filter((entry) => entry.id !== user.id)
        : [...current, user],
    );
  };

  const needed = MIN_OTHER_PARTICIPANTS - selected.length;
  const canSubmit = name.trim().length > 0 && selected.length >= MIN_OTHER_PARTICIPANTS;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreating) return;

    const invalidName = validateGroupName(name);
    setNameError(invalidName ?? null);
    setFormError(null);

    if (invalidName) return;
    if (selected.length < MIN_OTHER_PARTICIPANTS) {
      setFormError(`Add at least ${MIN_OTHER_PARTICIPANTS} people — a group needs three members.`);
      return;
    }

    setIsCreating(true);
    try {
      const group = await createGroup(
        token,
        currentUser.id,
        name,
        selected.map((user) => user.id),
      );
      onCreated(group.id);
    } catch (error: unknown) {
      // Surface the upstream validation detail verbatim when there is one.
      if (error instanceof ApiError) setFormError(error.firstDetail ?? error.message);
      else setFormError('Could not create the group. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New group"
      description="Name the group and choose who's in it."
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 space-y-4 border-b border-ink-100 px-5 py-4 sm:px-6">
          <TextField
            label="Group name"
            placeholder="Weekend Plans"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            maxLength={60}
            disabled={isCreating}
            required
          />

          <div>
            <TextField
              label="Add people"
              type="search"
              autoComplete="off"
              placeholder="Search by name or phone number"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              leadingIcon={<Search className="size-4" />}
              disabled={isCreating}
              hint={
                selected.length === 0
                  ? 'Groups need at least three members, including you.'
                  : undefined
              }
            />

            {selected.length > 0 && (
              <div className="scroll-subtle mt-3 max-h-20 overflow-y-auto overscroll-contain sm:max-h-24">
                <ul aria-label="Selected members" className="flex flex-wrap gap-1.5">
                  {selected.map((user) => (
                    <li key={user.id}>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 py-1 pl-1 pr-1 text-sm text-ink-900">
                        <Avatar name={user.name} seed={user.id} size="sm" className="size-6 text-[0.625rem]" />
                        <span className="max-w-[7rem] truncate font-medium sm:max-w-32">{user.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleParticipant(user)}
                          aria-label={`Remove ${user.name} from the group`}
                          disabled={isCreating}
                          className="rounded-full p-1 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-900"
                        >
                          <X aria-hidden className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="scroll-subtle min-h-0 flex-1 overflow-y-auto py-2">
          <UserSearchResults
            term={term}
            results={search.results}
            isSearching={search.isSearching}
            error={search.error}
            hasSearched={search.hasSearched}
            truncated={search.truncated}
            phoneSearchLimited={search.phoneSearchLimited}
            onRetry={search.retry}
            onSelect={toggleParticipant}
            selectedIds={selected.map((user) => user.id)}
          />
        </div>

        <footer className="shrink-0 border-t border-ink-100 px-5 py-4 sm:px-6">
          {formError && (
            <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-500">
              {selected.length === 0
                ? 'No one selected yet'
                : needed > 0
                  ? `${selected.length} selected · add ${needed} more`
                  : `${selected.length + 1} members including you`}
            </p>
            <div className="flex shrink-0 justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isCreating} disabled={!canSubmit}>
                {isCreating ? 'Creating…' : 'Create group'}
              </Button>
            </div>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
