import type { Metadata } from 'next';

import { ChatWorkspace } from '@/components/chat/ChatWorkspace';

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Your direct and group conversations.',
  // A signed-in surface has nothing to offer a crawler.
  robots: { index: false, follow: false },
};

export default function ChatPage() {
  return <ChatWorkspace />;
}
