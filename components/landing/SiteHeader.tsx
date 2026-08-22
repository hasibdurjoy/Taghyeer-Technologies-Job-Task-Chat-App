import Link from 'next/link';

import { StartCta } from '@/components/landing/StartCta';
import { Wordmark } from '@/components/landing/Wordmark';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-100/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link href="/" aria-label="Messengo home" className="shrink-0">
          <Wordmark priority />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link
            href="#features"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 sm:inline-flex"
          >
            Features
          </Link>
          <StartCta size="md" />
        </nav>
      </div>
    </header>
  );
}
