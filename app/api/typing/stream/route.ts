import type { NextRequest } from 'next/server';

import { extractToken, isParticipant, resolveUser } from '@/lib/auth/verify-token';
import { subscribe } from '@/lib/typing/registry';
import type { TypingEvent } from '@/types/chat';

/**
 * Server-sent events carrying typing signals for one conversation.
 *
 * SSE rather than a WebSocket because the payload is one-directional (publishing
 * goes over `POST /api/typing`) and SSE needs no extra protocol or dependency.
 *
 * Note the client reads this with `fetch` + a stream reader rather than
 * `EventSource`: `EventSource` cannot send an `Authorization` header, and the
 * alternative — putting the JWT in the query string — would leak it into access
 * logs and browser history.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Keeps proxies and load balancers from closing an idle connection. */
const HEARTBEAT_INTERVAL_MS = 25_000;

function errorResponse(status: number, message: string, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const user = await resolveUser(token);
  if (!token || !user) return errorResponse(401, 'Invalid or missing token', 'INVALID_TOKEN');

  const conversationId = request.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return errorResponse(400, 'conversationId is required', 'VALIDATION_ERROR');
  }
  if (!(await isParticipant(token, user, conversationId))) {
    return errorResponse(403, 'Not a participant of this conversation', 'FORBIDDEN');
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const send = (payload: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // The client went away between the check and the write.
          isClosed = true;
        }
      };

      const unsubscribe = subscribe(conversationId, (event: TypingEvent) => {
        // Never echo a signal back to its author.
        if (event.userId === user.id) return;
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      // An initial comment flushes headers so the client knows it is connected.
      send(': connected\n\n');

      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_INTERVAL_MS);

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Fires when the browser navigates away, closes the tab, or aborts.
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx-style proxies not to buffer the stream.
      'X-Accel-Buffering': 'no',
    },
  });
}
