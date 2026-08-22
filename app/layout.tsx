import type { Metadata } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';

import { AuthProvider } from '@/hooks/useAuth';
import { SITE_URL } from '@/lib/config';
import { ToastProvider } from '@/components/ui/Toast';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

/** Display face used for headlines — gives the product an editorial voice. */
const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  weight: '400',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  // Absolute base for every URL-based tag below. Relative image paths are a
  // build error without it, and crawlers reject them outright.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Messengo — Real-time messaging for real conversations',
    // Child routes supply only their own name; the brand is appended here.
    template: '%s — Messengo',
  },
  description:
    'Real-time chat that lands the moment you send — live typing indicators, notification sounds, instant group conversations, and a message list that never loses your place.',
  applicationName: 'Messengo',
  keywords: [
    'Messengo',
    'real-time chat app',
    'instant messaging',
    'group chat',
    'WebSocket chat',
    'Socket.IO messaging',
    'typing indicator',
    'direct messages',
    'online messenger',
    'web chat application',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Messengo',
    locale: 'en_US',
    url: '/',
    title: 'Messengo — Real-time messaging for real conversations',
    description:
      'Messages land the moment they are sent. Live typing indicators, notification sounds, groups in seconds, and a message list that never loses your place.',
  },
  twitter: {
    // No `twitter-image` file: X falls back to og:image, so one asset serves both.
    card: 'summary_large_image',
    title: 'Messengo — Real-time messaging for real conversations',
    description:
      'Messages land the moment they are sent. Live typing indicators, notification sounds, groups in seconds, and a message list that never loses your place.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
