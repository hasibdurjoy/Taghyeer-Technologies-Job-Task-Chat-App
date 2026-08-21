import Link from 'next/link';

import { Wordmark } from '@/components/landing/Wordmark';

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
            A messaging app built for a frontend take-home assignment — real API, real WebSockets,
            no mock data.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link href="/login" className="text-ink-700 transition-colors hover:text-ink-950">
            Sign in
          </Link>
          <Link href="#features" className="text-ink-700 transition-colors hover:text-ink-950">
            Features
          </Link>
          <a
            href="https://frontend-task-chatapp.onrender.com/docs/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-700 transition-colors hover:text-ink-950"
          >
            API docs
          </a>
        </nav>
      </div>
    </footer>
  );
}
