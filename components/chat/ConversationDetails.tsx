'use client';

import { Check, LogOut, Pencil, Phone, ShieldPlus, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { formatFullTimestamp } from '@/lib/format';
import { cx } from '@/lib/utils';
import { validateGroupName } from '@/lib/validation';
import type { GroupAction } from '@/hooks/useGroupAdmin';
import type { Conversation, User } from '@/types/chat';

interface ConversationDetailsProps {
  conversation: Conversation;
  currentUser: User;
  /** Which administrative action is in flight, if any. */
  pending: GroupAction | null;
  onRename: (name: string) => Promise<boolean>;
  onAddMembers: () => void;
  onRemoveMember: (member: User) => void;
  onPromote: (member: User) => void;
  onLeave: () => void;
  className?: string;
}

/**
 * The third column: who you are talking to, and — for groups you administer —
 * the controls to change it.
 *
 * Membership and admin state come from the conversation already in memory, so
 * opening the panel costs no request. Above `xl` it is a docked third column;
 * below that the same content is presented as a sheet, because a third column
 * would leave the messages too narrow to read.
 */
export function ConversationDetails({
  conversation,
  currentUser,
  pending,
  onRename,
  onAddMembers,
  onRemoveMember,
  onPromote,
  onLeave,
  className,
}: ConversationDetailsProps) {
  const isGroup = conversation.type === 'group';
  const otherParticipant = conversation.participants[0] ?? null;
  const isAdmin = conversation.adminIds.includes(currentUser.id);

  // The current user is a member too, but the API leaves them out of
  // `participants` — the list would otherwise be short by one. Admins are
  // floated to the top, then everyone else alphabetically.
  const members = isGroup
    ? [...conversation.participants, currentUser].sort((a, b) => {
        const aAdmin = conversation.adminIds.includes(a.id);
        const bAdmin = conversation.adminIds.includes(b.id);
        if (aAdmin !== bAdmin) return aAdmin ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  const subtitle = isGroup
    ? `${conversation.participants.length + 1} members`
    : (otherParticipant?.phone ?? '');

  return (
    <aside
      aria-label="Conversation details"
      className={cx(
        // The docked column supplies its own left border; inside the small-screen
        // sheet there is nothing to divide it from.
        'scroll-subtle flex-col overflow-y-auto bg-surface',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
        <Avatar
          name={conversation.title}
          seed={isGroup ? conversation.id : (otherParticipant?.id ?? conversation.id)}
          isGroup={isGroup}
          size="xl"
        />

        {isGroup && isAdmin ? (
          <GroupNameEditor
            key={conversation.title}
            name={conversation.title}
            isPending={pending?.kind === 'rename'}
            onRename={onRename}
          />
        ) : (
          <div className="min-w-0">
            <h2 className="font-display text-xl leading-tight tracking-tight text-ink-950">
              {conversation.title}
            </h2>
          </div>
        )}

        {subtitle && <p className="-mt-2 text-sm text-ink-500">{subtitle}</p>}
      </div>

      {isGroup ? (
        <section className="border-t border-ink-100 px-4 py-5">
          <div className="flex items-center justify-between gap-2 px-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Members</h3>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddMembers}
                isLoading={pending?.kind === 'add'}
                className="-mr-2 h-8 px-2 text-xs"
              >
                <UserPlus aria-hidden className="size-3.5" />
                Add
              </Button>
            )}
          </div>

          <ul className="mt-2 space-y-0.5">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isYou={member.id === currentUser.id}
                isMemberAdmin={conversation.adminIds.includes(member.id)}
                canAdminister={isAdmin}
                pending={pending}
                onPromote={() => onPromote(member)}
                onRemove={() => onRemoveMember(member)}
              />
            ))}
          </ul>

          {isAdmin && (
            <p className="mt-3 px-2 text-xs leading-relaxed text-ink-400">
              Promoting is permanent — the API has no way to remove admin rights again.
            </p>
          )}
        </section>
      ) : (
        otherParticipant && (
          <section className="border-t border-ink-100 px-6 py-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Contact</h3>
            <p className="mt-3 flex items-center gap-2.5 text-sm text-ink-700">
              <Phone aria-hidden className="size-4 shrink-0 text-ink-400" />
              <span className="truncate">{otherParticipant.phone}</span>
            </p>
          </section>
        )
      )}

      <div className="mt-auto border-t border-ink-100 px-6 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Last activity</h3>
        <p className="mt-1.5 text-sm text-ink-700">{formatFullTimestamp(conversation.updatedAt)}</p>

        {isGroup && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            isLoading={pending?.kind === 'leave'}
            className="mt-4 w-full text-danger hover:bg-danger-soft"
          >
            <LogOut aria-hidden className="size-4" />
            Leave group
          </Button>
        )}
      </div>
    </aside>
  );
}

/**
 * Inline rename.
 *
 * Editing in place rather than in a dialog: renaming is a one-field change, and
 * the name is right there. Remounted via `key` when the name changes, so an
 * update from another admin is picked up instead of being overwritten by a
 * stale draft.
 */
function GroupNameEditor({
  name,
  isPending,
  onRename,
}: {
  name: string;
  isPending: boolean;
  onRename: (name: string) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setIsEditing(false);
    setDraft(name);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    const invalid = validateGroupName(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    // Nothing changed — close without a pointless request.
    if (draft.trim() === name) {
      cancel();
      return;
    }
    if (await onRename(draft)) setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate font-display text-xl leading-tight tracking-tight text-ink-950">
          {name}
        </h2>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          aria-label={`Rename ${name}`}
          className="shrink-0 rounded-full p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <Pencil aria-hidden className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full">
      <TextField
        label="Group name"
        hideLabel
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancel();
        }}
        error={error}
        maxLength={60}
        disabled={isPending}
        autoFocus
        className="text-center"
      />
      <div className="mt-2 flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={cancel} disabled={isPending}>
          <X aria-hidden className="size-3.5" />
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={isPending}>
          <Check aria-hidden className="size-3.5" />
          Save
        </Button>
      </div>
    </form>
  );
}

function MemberRow({
  member,
  isYou,
  isMemberAdmin,
  canAdminister,
  pending,
  onPromote,
  onRemove,
}: {
  member: User;
  isYou: boolean;
  isMemberAdmin: boolean;
  canAdminister: boolean;
  pending: GroupAction | null;
  onPromote: () => void;
  onRemove: () => void;
}) {
  // Admins manage everyone but themselves: leaving is a separate, clearer action
  // than removing yourself, and there is no way to give up admin rights.
  const showActions = canAdminister && !isYou;
  const isBusy = pending?.kind === 'promote' || pending?.kind === 'remove';
  const isThisMemberBusy =
    (pending?.kind === 'promote' || pending?.kind === 'remove') && pending.userId === member.id;

  return (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-paper-dim">
      <Avatar name={member.name} seed={member.id} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">
          {member.name}
          {isYou && <span className="ml-1 font-normal text-ink-400">(you)</span>}
        </p>
        <p className="truncate text-xs text-ink-400">{member.phone}</p>
      </div>

      {isMemberAdmin && (
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-accent-deep">
          Admin
        </span>
      )}

      {showActions && (
        // Always rendered rather than revealed on hover: hover-only controls are
        // unreachable on touch, and these are the only way to manage a member.
        <div className="flex shrink-0 items-center gap-0.5">
          {!isMemberAdmin && (
            <button
              type="button"
              onClick={onPromote}
              disabled={isBusy}
              aria-label={`Make ${member.name} an admin`}
              title="Make admin"
              className="rounded-full p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-40"
            >
              <ShieldPlus aria-hidden className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={isBusy}
            aria-label={`Remove ${member.name} from the group`}
            title="Remove from group"
            className={cx(
              'rounded-full p-1.5 transition-colors disabled:opacity-40',
              isThisMemberBusy
                ? 'text-danger'
                : 'text-ink-400 hover:bg-danger-soft hover:text-danger',
            )}
          >
            <UserMinus aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}
