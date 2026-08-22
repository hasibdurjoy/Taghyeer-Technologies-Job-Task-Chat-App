'use client';

import { useCallback, useState } from 'react';

import {
  addParticipants,
  promoteToAdmin,
  removeParticipant,
  renameGroup,
} from '@/lib/api/conversations';
import { ApiError } from '@/lib/api/http';
import type { Conversation } from '@/types/chat';

/** Which action is in flight, so only the control that started it shows a spinner. */
export type GroupAction =
  | { kind: 'rename' }
  | { kind: 'add' }
  | { kind: 'remove'; userId: string }
  | { kind: 'promote'; userId: string }
  | { kind: 'leave' };

interface UseGroupAdminOptions {
  token: string;
  currentUserId: string;
  /** Applies the updated group returned by the API. */
  onUpdated: (conversation: Conversation) => void;
  /** Called after the current user leaves, so the caller can close the conversation. */
  onLeft: (conversationId: string) => void;
  onError: (message: string) => void;
}

interface UseGroupAdminResult {
  pending: GroupAction | null;
  rename: (conversationId: string, name: string) => Promise<boolean>;
  addMembers: (conversationId: string, userIds: string[]) => Promise<boolean>;
  removeMember: (conversationId: string, userId: string) => Promise<boolean>;
  promote: (conversationId: string, userId: string) => Promise<boolean>;
  leave: (conversationId: string) => Promise<boolean>;
}

/**
 * The four group administration endpoints, wrapped with pending state and a
 * single error path.
 *
 * Each endpoint returns the complete updated group, so the response is applied
 * straight away rather than triggering a refetch. The matching
 * `conversation:updated` event arrives moments later and merges to the same
 * state, which is why applying both is safe.
 *
 * The UI hides actions the current user isn't allowed to take, but the server is
 * the authority — a 403 that slips through (a demotion elsewhere, a stale view)
 * is surfaced with the upstream message rather than swallowed.
 */
export function useGroupAdmin({
  token,
  currentUserId,
  onUpdated,
  onLeft,
  onError,
}: UseGroupAdminOptions): UseGroupAdminResult {
  const [pending, setPending] = useState<GroupAction | null>(null);

  /** Runs one mutation, owning the pending flag and error reporting. */
  const run = useCallback(
    async (
      action: GroupAction,
      operation: () => Promise<Conversation>,
      fallbackMessage: string,
    ): Promise<Conversation | null> => {
      setPending(action);
      try {
        const updated = await operation();
        onUpdated(updated);
        return updated;
      } catch (error: unknown) {
        // Upstream messages here are genuinely useful ("Only admins can rename
        // the group", "Target user is not a member"), so they're shown as-is.
        onError(error instanceof ApiError ? error.message : fallbackMessage);
        return null;
      } finally {
        setPending(null);
      }
    },
    [onUpdated, onError],
  );

  const rename = useCallback(
    async (conversationId: string, name: string) => {
      const result = await run(
        { kind: 'rename' },
        () => renameGroup(token, currentUserId, conversationId, name),
        'Could not rename the group.',
      );
      return result !== null;
    },
    [run, token, currentUserId],
  );

  const addMembers = useCallback(
    async (conversationId: string, userIds: string[]) => {
      if (userIds.length === 0) return false;
      const result = await run(
        { kind: 'add' },
        () => addParticipants(token, currentUserId, conversationId, userIds),
        'Could not add those people to the group.',
      );
      return result !== null;
    },
    [run, token, currentUserId],
  );

  const removeMember = useCallback(
    async (conversationId: string, userId: string) => {
      const result = await run(
        { kind: 'remove', userId },
        () => removeParticipant(token, currentUserId, conversationId, userId),
        'Could not remove that member.',
      );
      return result !== null;
    },
    [run, token, currentUserId],
  );

  const promote = useCallback(
    async (conversationId: string, userId: string) => {
      const result = await run(
        { kind: 'promote', userId },
        () => promoteToAdmin(token, currentUserId, conversationId, userId),
        'Could not promote that member.',
      );
      return result !== null;
    },
    [run, token, currentUserId],
  );

  /**
   * Leaving is the same endpoint as removing a member, pointed at yourself.
   *
   * The response still describes the group, but the current user is no longer in
   * it — so it is deliberately *not* passed to `onUpdated`, which would put the
   * group straight back into the sidebar.
   */
  const leave = useCallback(
    async (conversationId: string) => {
      setPending({ kind: 'leave' });
      try {
        await removeParticipant(token, currentUserId, conversationId, currentUserId);
        onLeft(conversationId);
        return true;
      } catch (error: unknown) {
        onError(error instanceof ApiError ? error.message : 'Could not leave the group.');
        return false;
      } finally {
        setPending(null);
      }
    },
    [token, currentUserId, onLeft, onError],
  );

  return { pending, rename, addMembers, removeMember, promote, leave };
}
