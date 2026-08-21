import type { NextRequest } from 'next/server';

import { resolveUserId } from '@/lib/auth/verify-token';
import { getReadStateCollection } from '@/lib/mongodb/client';
import type { ReadState } from '@/types/chat';

/**
 * Per-user read markers — the one piece of state the upstream API does not
 * provide, and this application's only use of MongoDB. No user, conversation or
 * message data is stored here.
 */

export const dynamic = 'force-dynamic';

function errorResponse(status: number, message: string, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

const UNAVAILABLE = () =>
  errorResponse(503, 'Read state is unavailable', 'READ_STATE_UNAVAILABLE');

const UNAUTHORIZED = () => errorResponse(401, 'Invalid or missing token', 'INVALID_TOKEN');

/** All read markers for the signed-in user. */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request.headers.get('authorization'));
  if (!userId) return UNAUTHORIZED();

  const collection = await getReadStateCollection();
  if (!collection) return UNAVAILABLE();

  try {
    const documents = await collection.find({ userId }).toArray();
    const data: ReadState[] = documents.map((doc) => ({
      conversationId: doc.conversationId,
      lastReadAt: doc.lastReadAt.toISOString(),
    }));
    return Response.json({ data });
  } catch {
    return UNAVAILABLE();
  }
}

/** Marks a conversation read up to a timestamp. */
export async function PUT(request: NextRequest) {
  const userId = await resolveUserId(request.headers.get('authorization'));
  if (!userId) return UNAUTHORIZED();

  let body: { conversationId?: unknown; lastReadAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', 'VALIDATION_ERROR');
  }

  const { conversationId, lastReadAt } = body;
  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    return errorResponse(400, 'conversationId is required', 'VALIDATION_ERROR');
  }

  const timestamp = typeof lastReadAt === 'string' ? new Date(lastReadAt) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return errorResponse(400, 'lastReadAt must be a valid date', 'VALIDATION_ERROR');
  }

  const collection = await getReadStateCollection();
  if (!collection) return UNAVAILABLE();

  try {
    // Never move a marker backwards: a stale write from another tab must not
    // resurrect unread badges the user has already cleared. The upsert creates
    // the marker the first time; the conditional update advances it after that.
    await collection.updateOne(
      { userId, conversationId },
      { $setOnInsert: { userId, conversationId, lastReadAt: timestamp } },
      { upsert: true },
    );
    const updated = await collection.findOneAndUpdate(
      { userId, conversationId, lastReadAt: { $lt: timestamp } },
      { $set: { lastReadAt: timestamp } },
      { returnDocument: 'after' },
    );

    // Report what is actually stored, which may be newer than what was sent.
    const stored = updated ?? (await collection.findOne({ userId, conversationId }));
    return Response.json({
      data: {
        conversationId,
        lastReadAt: (stored?.lastReadAt ?? timestamp).toISOString(),
      },
    });
  } catch {
    return UNAVAILABLE();
  }
}
