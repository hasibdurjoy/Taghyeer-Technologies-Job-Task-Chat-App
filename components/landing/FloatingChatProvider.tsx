'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { FloatingChatWindow } from '@/components/landing/FloatingChatWindow';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useRealtime } from '@/hooks/useRealtime';
import type { Conversation, Message } from '@/types/chat';

/** Width of one window, plus the gap after it. Used to work out how many fit. */
const WINDOW_FOOTPRINT = 332;
/** More than this is unreadable even on a wide screen. */
const MAX_WINDOWS = 3;

interface OpenChat {
  conversation: Conversation;
  isMinimized: boolean;
}

interface FloatingChatValue {
  openChats: OpenChat[];
  openChat: (conversation: Conversation) => void;
  closeChat: (conversationId: string) => void;
  toggleMinimized: (conversationId: string) => void;
}

const FloatingChatContext = createContext<FloatingChatValue | null>(null);

export function useFloatingChat(): FloatingChatValue {
  const context = useContext(FloatingChatContext);
  if (!context) throw new Error('useFloatingChat must be used inside <FloatingChatProvider>');
  return context;
}

/**
 * The dock, if there is one.
 *
 * The header lives on the landing page today, where the provider wraps it — but
 * it is a general-purpose component, and reusing it on a page without a dock
 * should degrade to navigation, not crash the page.
 */
export function useOptionalFloatingChat(): FloatingChatValue | null {
  return useContext(FloatingChatContext);
}

/** How many windows fit right now, between 1 and `MAX_WINDOWS`. */
function fittingWindowCount(): number {
  if (typeof window === 'undefined') return MAX_WINDOWS;
  return Math.max(1, Math.min(MAX_WINDOWS, Math.floor((window.innerWidth - 32) / WINDOW_FOOTPRINT)));
}

/**
 * Messenger-style chat windows docked at the bottom of the landing page.
 *
 * The provider owns three things the windows cannot own individually: which
 * chats are open, how many fit on screen, and — most importantly — the single
 * socket connection. One window per socket would open a connection per open
 * chat, so the connection lives here and incoming messages are routed to
 * whichever window registered for that conversation.
 */
export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [maxWindows, setMaxWindows] = useState(fittingWindowCount);
  const playNotificationSound = useNotificationSound();

  // Each window publishes its `receive` here while mounted, so the shared
  // socket handler below can hand a message to the right history.
  const receiversRef = useRef(new Map<string, (message: Message) => void>());

  const registerReceiver = useCallback((conversationId: string, receive: (m: Message) => void) => {
    const receivers = receiversRef.current;
    receivers.set(conversationId, receive);
    return () => {
      receivers.delete(conversationId);
    };
  }, []);

  // A narrower window drops the oldest chats rather than letting the dock run
  // off the side of the screen.
  useEffect(() => {
    const sync = () => {
      const next = fittingWindowCount();
      setMaxWindows(next);
      setOpenChats((current) => (current.length > next ? current.slice(-next) : current));
    };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const openChat = useCallback((conversation: Conversation) => {
    setOpenChats((current) => {
      const existing = current.find((chat) => chat.conversation.id === conversation.id);
      // Re-opening an open chat restores it rather than adding a duplicate.
      if (existing) {
        return current.map((chat) =>
          chat.conversation.id === conversation.id ? { ...chat, isMinimized: false } : chat,
        );
      }
      // Newest goes last, which puts it nearest the corner once rendered.
      return [...current, { conversation, isMinimized: false }].slice(-fittingWindowCount());
    });
  }, []);

  const closeChat = useCallback((conversationId: string) => {
    setOpenChats((current) => current.filter((chat) => chat.conversation.id !== conversationId));
  }, []);

  const toggleMinimized = useCallback((conversationId: string) => {
    setOpenChats((current) =>
      current.map((chat) =>
        chat.conversation.id === conversationId ? { ...chat, isMinimized: !chat.isMinimized } : chat,
      ),
    );
  }, []);

  const handleRealtimeMessage = useCallback(
    (message: Message) => {
      receiversRef.current.get(message.conversationId)?.(message);
      // The socket never echoes your own message back, but the guard keeps a
      // stray echo from pinging you for something you sent.
      if (message.senderId !== user?.id) playNotificationSound();
    },
    [user?.id, playNotificationSound],
  );

  const noop = useCallback(() => {}, []);

  // Connect only while a chat is actually open: signing in should not cost a
  // socket connection just for reading the landing page.
  useRealtime(openChats.length > 0 ? token : null, {
    onMessage: handleRealtimeMessage,
    onConversationUpdated: noop,
    onReconnect: noop,
  });

  const value = useMemo<FloatingChatValue>(
    () => ({ openChats, openChat, closeChat, toggleMinimized }),
    [openChats, openChat, closeChat, toggleMinimized],
  );

  return (
    <FloatingChatContext.Provider value={value}>
      {children}

      {user && token && openChats.length > 0 && (
        <div
          // Below `md` a docked window would cover the page it floats over.
          className="pointer-events-none fixed bottom-0 right-4 z-40 hidden items-end gap-3 md:flex"
        >
          {openChats.slice(-maxWindows).map((chat) => (
            <FloatingChatWindow
              key={chat.conversation.id}
              conversation={chat.conversation}
              currentUser={user}
              token={token}
              isMinimized={chat.isMinimized}
              onToggleMinimize={() => toggleMinimized(chat.conversation.id)}
              onClose={() => closeChat(chat.conversation.id)}
              registerReceiver={registerReceiver}
            />
          ))}
        </div>
      )}
    </FloatingChatContext.Provider>
  );
}
