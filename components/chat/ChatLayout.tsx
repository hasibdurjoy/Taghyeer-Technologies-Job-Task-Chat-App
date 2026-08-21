'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { EmptyConversation } from '@/components/chat/EmptyConversation';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';
import { useToast } from '@/components/ui/Toast';
import { useConversations } from '@/hooks/useConversations';
import { useDrafts } from '@/hooks/useDrafts';
import { useMessages } from '@/hooks/useMessages';
import { useRealtime } from '@/hooks/useRealtime';
import { cx } from '@/lib/utils';
import type { Message, User } from '@/types/chat';

interface ChatLayoutProps {
  currentUser: User;
  token: string;
}

type MobilePane = 'list' | 'conversation';

/**
 * Composition root for the chat.
 *
 * This component wires the hooks together and owns only navigation-level state
 * (which conversation is open, which dialog is showing, which pane is visible on
 * mobile). All data logic lives in hooks and all rendering in child components.
 */
export function ChatLayout({ currentUser, token }: ChatLayoutProps) {
  const { showToast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);

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

  // Realtime handlers read the active id through a ref so that switching
  // conversations never tears down and re-establishes the socket.
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const handleRealtimeMessage = useCallback(
    (message: Message) => {
      const isActive = message.conversationId === activeIdRef.current;
      if (isActive) receive(message);
      applyIncomingMessage(message, isActive);
    },
    [receive, applyIncomingMessage],
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

      const saved = await send(text);
      if (saved) applyOwnMessage(saved);
      else showToast('Message not delivered. Use Retry on the message to send it again.');
    },
    [activeId, send, applyOwnMessage, clearDraft, showToast],
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
      <div className="mx-auto flex w-full max-w-[100rem] flex-1 overflow-hidden">
        {/*
          One markup tree serves both layouts: on mobile each pane takes the full
          width and visibility is toggled, on desktop both are always visible.
        */}
        <ConversationSidebar
          className={cx(
            'w-full shrink-0 border-r border-ink-100 bg-surface md:flex md:w-80 lg:w-96',
            mobilePane === 'conversation' ? 'hidden md:flex' : 'flex',
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

        <main
          className={cx(
            'min-w-0 flex-1 flex-col bg-paper',
            mobilePane === 'conversation' ? 'flex' : 'hidden md:flex',
          )}
        >
          {activeConversation ? (
            <>
              <ChatHeader
                conversation={activeConversation}
                onBack={() => setMobilePane('list')}
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
              />
              <MessageComposer
                conversationId={activeConversation.id}
                conversationTitle={activeConversation.title}
                draft={getDraft(activeConversation.id)}
                onDraftChange={setDraft}
                onSend={handleSend}
                isDisconnected={connectionStatus === 'disconnected'}
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
