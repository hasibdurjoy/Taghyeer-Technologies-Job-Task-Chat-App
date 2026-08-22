import type { Metadata } from 'next';

import { ChatWorkspace } from '@/components/chat/ChatWorkspace';

export const metadata: Metadata = {
  title: 'Messages — Messengo',
  description: 'Your direct and group conversations.',
};

export default function ChatPage() {
  return <ChatWorkspace />;
}
