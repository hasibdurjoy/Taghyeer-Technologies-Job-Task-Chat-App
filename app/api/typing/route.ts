import type { NextRequest } from 'next/server';

import { extractToken, isParticipant, resolveUser } from '@/lib/auth/verify-token';
import { publish } from '@/lib/typing/registry';

/**
 * Publishes a typing signal to the other participants of a conversation.
 *
 * This is not part of the upstream API — it has no typing channel — so the app
 * relays these itself. Nothing is stored: the event is fanned out to whoever is
 * currently listening and then discarded.
 */

export const dynamic = 'force-dynamic';
// The relay keeps subscribers in memory, so it needs the Node runtime.
export const runtime = 'nodejs';

function errorResponse(status: number, message: string, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const user = await resolveUser(token);
  if (!token || !user) return errorResponse(401, 'Invalid or missing token', 'INVALID_TOKEN');

  let body: { conversationId?: unknown; isTyping?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', 'VALIDATION_ERROR');
  }

  const { conversationId, isTyping } = body;
  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    return errorResponse(400, 'conversationId is required', 'VALIDATION_ERROR');
  }
  if (typeof isTyping !== 'boolean') {
    return errorResponse(400, 'isTyping must be a boolean', 'VALIDATION_ERROR');
  }

  // Anyone with a valid token could otherwise probe arbitrary conversation ids.
  if (!(await isParticipant(token, user, conversationId))) {
    return errorResponse(403, 'Not a participant of this conversation', 'FORBIDDEN');
  }

  publish({ conversationId, userId: user.id, name: user.name, isTyping });

  // Nothing useful to return; the client fires these and forgets them.
  return new Response(null, { status: 204 });
}
