'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { ConversationDetails } from '@/components/chat/ConversationDetails';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { EmptyConversation } from '@/components/chat/EmptyConversation';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';
import { SidebarResizer } from '@/components/chat/SidebarResizer';
import { useToast } from '@/components/ui/Toast';
import { useConversations } from '@/hooks/useConversations';
import { useDrafts } from '@/hooks/useDrafts';
import { useMessages } from '@/hooks/useMessages';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useRealtime } from '@/hooks/useRealtime';
import { useResizableSidebar } from '@/hooks/useResizableSidebar';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useTypingSound } from '@/hooks/useTypingSound';
import { cx } from '@/lib/utils';
import type { Message, User } from '@/types/chat';

interface ChatLayoutProps {
  currentUser: User;
  token: string;
}

type MobilePane = 'list' | 'conversation';

/**
 * Conversation to open on mount, from `/chat?c=<id>` — how the landing page's
 * messages menu hands a specific chat over.
 *
 * Read straight off `window.location` rather than through `useSearchParams`,
 * which would drag this statically-rendered route into a Suspense boundary.
 * `ChatWorkspace` only mounts this after the client-side session restore, so
 * there is never any server HTML for the read to disagree with.
 *
 * The id is shape-checked before use: it goes into state that drives a lookup,
 * and anything can be typed into a query string.
 */
function readRequestedConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('c');
  return id && /^[a-f\d]{24}$/i.test(id) ? id : null;
}

/**
 * Composition root for the chat.
 *
 * This component wires the hooks together and owns only navigation-level state
 * (which conversation is open, which dialog is showing, which pane is visible on
 * mobile). All data logic lives in hooks and all rendering in child components.
 */
export function ChatLayout({ currentUser, token }: ChatLayoutProps) {
  const { showToast } = useToast();

  const [initialConversationId] = useState(readRequestedConversationId);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  // Arriving with a conversation in the URL means the user asked for that
  // conversation, not for the list they would otherwise land on.
  const [mobilePane, setMobilePane] = useState<MobilePane>(
    initialConversationId ? 'conversation' : 'list',
  );
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  // Only ever rendered from `xl` up; below that the layout stays two-column.
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  const {
    conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    unreadCounts,
    refresh: refreshConversations,
    applyIncomingMessage,
    applyOwnMessage,
    applyConversationUpdate,
    markRead,
  } = useConversations(token, currentUser.id);

  const {
    messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    hasMore,
    isLoadingMore,
    reload: reloadMessages,
    loadOlder,
    send,
    retry,
    receive,
  } = useMessages(token, currentUser.id, activeId);

  const { getDraft, setDraft, clearDraft } = useDrafts();

  const sidebar = useResizableSidebar();

  // Typing signals travel over this app's own relay: the provided API has no
  // typing channel (docs/API.md → "There is no typing / presence channel").
  const { typingUsers, notifyTyping, clearTyping } = useTypingIndicator(token, activeId);

  // Loops while the indicator is on screen. `typingUsers` is already scoped to
  // the open conversation and excludes the current user, so it is exactly the
  // condition the indicator itself renders on.
  useTypingSound(typingUsers.length > 0);

  // Realtime handlers read the active id through a ref so that switching
  // conversations never tears down and re-establishes the socket.
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const playNotificationSound = useNotificationSound();

  const handleRealtimeMessage = useCallback(
    (message: Message) => {
      const isActive = message.conversationId === activeIdRef.current;
      if (isActive) receive(message);
      applyIncomingMessage(message, isActive);

      // Sound plays whether the tab is focused or in the background — the
      // socket keeps delivering either way. The server never echoes a message
      // back to its sender (see `useRealtime`), but the guard keeps a stray
      // echo from pinging you for your own message.
      if (message.senderId !== currentUser.id) playNotificationSound();
    },
    [receive, applyIncomingMessage, currentUser.id, playNotificationSound],
  );

  const handleReconnect = useCallback(() => {
    // Nothing is replayed after a dropped connection, so refetch both the list
    // and the open conversation to close the gap.
    void refreshConversations();
    reloadMessages();
  }, [refreshConversations, reloadMessages]);

  const connectionStatus = useRealtime(token, {
    onMessage: handleRealtimeMessage,
    onConversationUpdated: applyConversationUpdate,
    onReconnect: handleReconnect,
  });

  const activeConversation = conversations.find((item) => item.id === activeId) ?? null;

  // Opening a conversation clears its badge.
  useEffect(() => {
    if (activeId) markRead(activeId);
  }, [activeId, markRead]);

  const openConversation = useCallback((conversationId: string) => {
    setActiveId(conversationId);
    setMobilePane('conversation');
  }, []);

  const handleConversationCreated = useCallback(
    async (conversationId: string) => {
      setIsNewChatOpen(false);
      setIsNewGroupOpen(false);
      // `POST /conversations` returns a sparse object without participants or a
      // preview, so the list is refreshed *before* opening — selecting an id the
      // list doesn't hold yet would flash the empty state.
      await refreshConversations();
      openConversation(conversationId);
    },
    [openConversation, refreshConversations],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeId) return;

      // The composer clears as soon as the optimistic bubble exists. If the send
      // fails, the text lives on in that bubble with a Retry control — leaving it
      // in the composer too would show the same message twice.
      clearDraft(activeId);
      // The message is on its way, so stop advertising that we're typing.
      clearTyping();

      const saved = await send(text);
      if (saved) applyOwnMessage(saved);
      else showToast('Message not delivered. Use Retry on the message to send it again.');
    },
    [activeId, send, applyOwnMessage, clearDraft, clearTyping, showToast],
  );

  const handleRetryMessage = useCallback(
    async (clientId: string) => {
      const saved = await retry(clientId);
      if (saved) applyOwnMessage(saved);
      else showToast('Still could not send that message.');
    },
    [retry, applyOwnMessage, showToast],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      {/*
        The width rides down as a custom property rather than an inline style on
        the list itself: inline styles have no breakpoint, and the list is a
        full-width pane on mobile where this width must not apply.
      */}
      <div
        className="flex w-full flex-1 overflow-hidden"
        style={{ '--sidebar-width': `${sidebar.width}px` } as CSSProperties}
      >
        {/*
          One markup tree serves both layouts: on mobile each pane takes the full
          width and visibility is toggled, on desktop both are always visible.
        */}
        <ConversationSidebar
          className={cx(
            "w-full shrink-0 bg-surface md:flex md:w-[var(--sidebar-width)]",
            mobilePane === "conversation" ? "hidden md:flex" : "flex",
          )}
          currentUser={currentUser}
          conversations={conversations}
          unreadCounts={unreadCounts}
          activeId={activeId}
          isLoading={isLoadingConversations}
          error={conversationsError}
          connectionStatus={connectionStatus}
          onRetry={refreshConversations}
          onSelect={openConversation}
          onNewChat={() => setIsNewChatOpen(true)}
          onNewGroup={() => setIsNewGroupOpen(true)}
        />

        <SidebarResizer
          width={sidebar.width}
          maxWidth={sidebar.maxWidth}
          isResizing={sidebar.isResizing}
          onPointerDown={sidebar.onPointerDown}
          onKeyDown={sidebar.onKeyDown}
          onReset={sidebar.reset}
        />

        <main
          className={cx(
            "min-w-0 flex-1 flex-col bg-paper",
            mobilePane === "conversation" ? "flex" : "hidden md:flex",
          )}
        >
          {activeConversation ? (
            <>
              <ChatHeader
                conversation={activeConversation}
                typingUsers={typingUsers}
                onBack={() => setMobilePane("list")}
                isDetailsOpen={isDetailsOpen}
                onToggleDetails={() => setIsDetailsOpen((open) => !open)}
              />
              <MessageList
                conversation={activeConversation}
                messages={messages}
                currentUserId={currentUser.id}
                isLoading={isLoadingMessages}
                error={messagesError}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onReload={reloadMessages}
                onLoadOlder={loadOlder}
                onRetryMessage={handleRetryMessage}
                typingUsers={typingUsers}
              />
              <MessageComposer
                conversationId={activeConversation.id}
                conversationTitle={activeConversation.title}
                draft={getDraft(activeConversation.id)}
                onDraftChange={setDraft}
                onTyping={notifyTyping}
                onSend={handleSend}
                isDisconnected={connectionStatus === "disconnected"}
              />
            </>
          ) : (
            <EmptyConversation
              hasConversations={conversations.length > 0}
              isLoading={isLoadingConversations}
              onNewChat={() => setIsNewChatOpen(true)}
              onNewGroup={() => setIsNewGroupOpen(true)}
            />
          )}
        </main>

        {activeConversation && isDetailsOpen && (
          <ConversationDetails
            conversation={activeConversation}
            currentUser={currentUser}
            className="hidden w-80 shrink-0 xl:flex"
          />
        )}
      </div>

      {/* Mounted only while open so their draft state resets on close. */}
      {isNewChatOpen && (
        <NewConversationDialog
          onClose={() => setIsNewChatOpen(false)}
          token={token}
          currentUser={currentUser}
          conversations={conversations}
          onOpenConversation={handleConversationCreated}
        />
      )}

      {isNewGroupOpen && (
        <CreateGroupDialog
          onClose={() => setIsNewGroupOpen(false)}
          token={token}
          currentUser={currentUser}
          onCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}
