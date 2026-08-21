'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { normalizeSocketMessage } from '@/lib/api/normalize';
import { SOCKET_URL } from '@/lib/config';
import type { RawConversation, RawSocketMessage } from '@/types/api';
import type { ConnectionStatus, Message } from '@/types/chat';

interface RealtimeHandlers {
  /** A message arrived for a conversation the user belongs to. */
  onMessage: (message: Message) => void;
  /** A group was created, renamed, or had its membership changed. */
  onConversationUpdated: (raw: RawConversation) => void;
  /**
   * Fired after the connection is re-established. Messages sent while offline
   * are never replayed by the server, so the caller refetches to close the gap.
   */
  onReconnect: () => void;
}

/**
 * Owns the single Socket.io connection for the app.
 *
 * Real-time here is genuine: the upstream API runs Socket.io at its root origin
 * and pushes `message:new` / `conversation:updated`. There is no polling
 * anywhere in this application.
 *
 * Note the socket is used for *receiving only* — sending goes over REST, which
 * returns the created message so optimistic bubbles can be reconciled. The
 * server also never echoes `message:new` back to the sender, so incoming
 * messages here are always from someone else and cannot duplicate an optimistic
 * bubble.
 */
export function useRealtime(token: string | null, handlers: RealtimeHandlers): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  // Handlers live in a ref so that changing them never tears down the socket.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });

    // `connect` fires for the first connection and every reconnection; only the
    // latter needs a refetch, so the first one is tracked explicitly.
    let hasConnectedBefore = false;

    const handleConnect = () => {
      setStatus('connected');
      if (hasConnectedBefore) handlersRef.current.onReconnect();
      hasConnectedBefore = true;
    };

    const handleDisconnect = () => setStatus('disconnected');
    const handleConnectError = () => setStatus('disconnected');

    const handleMessage = (raw: RawSocketMessage) => {
      if (!raw?.id || !raw.conversation) return;
      handlersRef.current.onMessage(normalizeSocketMessage(raw));
    };

    const handleConversationUpdated = (raw: RawConversation) => {
      if (!raw?._id) return;
      handlersRef.current.onConversationUpdated(raw);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('message:new', handleMessage);
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('message:new', handleMessage);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.disconnect();
    };
  }, [token]);

  // Without a token there is no connection to report on.
  return token ? status : 'disconnected';
}
