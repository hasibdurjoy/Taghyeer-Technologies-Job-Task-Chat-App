'use client';

import { Phone } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { formatFullTimestamp } from '@/lib/format';
import { cx } from '@/lib/utils';
import type { Conversation, User } from '@/types/chat';

interface ConversationDetailsProps {
  conversation: Conversation;
  currentUser: User;
  className?: string;
}

/**
 * The third column: who you are talking to.
 *
 * Everything here comes from the conversation already in memory, so opening the
 * panel costs no request. It is rendered only on wide screens — below that the
 * same facts are in the header's subtitle, and a third column would leave the
 * messages too narrow to read.
 */
export function ConversationDetails({
  conversation,
  currentUser,
  className,
}: ConversationDetailsProps) {
  const isGroup = conversation.type === 'group';
  const otherParticipant = conversation.participants[0] ?? null;

  // The current user is a member too, but the API leaves them out of
  // `participants` — the list would otherwise be short by one.
  const members = isGroup ? [...conversation.participants, currentUser] : [];

  const subtitle = isGroup
    ? `${conversation.participants.length + 1} members`
    : (otherParticipant?.phone ?? '');

  return (
    <aside
      aria-label="Conversation details"
      className={cx('scroll-subtle flex-col overflow-y-auto border-l border-ink-100 bg-surface', className)}
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
        <Avatar
          name={conversation.title}
          seed={isGroup ? conversation.id : (otherParticipant?.id ?? conversation.id)}
          isGroup={isGroup}
          size="xl"
        />
        <div className="min-w-0">
          <h2 className="font-display text-xl leading-tight tracking-tight text-ink-950">
            {conversation.title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>

      {isGroup ? (
        <section className="border-t border-ink-100 px-4 py-5">
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Members
          </h3>
          <ul className="mt-2 space-y-0.5">
            {members.map((member) => {
              const isYou = member.id === currentUser.id;
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-paper-dim"
                >
                  <Avatar name={member.name} seed={member.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {member.name}
                      {isYou && <span className="ml-1 font-normal text-ink-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-ink-400">{member.phone}</p>
                  </div>
                  {conversation.adminIds.includes(member.id) && (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-accent-deep">
                      Admin
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
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
        <p className="mt-1.5 text-sm text-ink-700">
          {formatFullTimestamp(conversation.updatedAt)}
        </p>
      </div>
    </aside>
  );
}
