import Link from 'next/link';

import { ChatPreview } from '@/components/landing/ChatPreview';
import { Reveal } from '@/components/landing/Reveal';
import { StartCta } from '@/components/landing/StartCta';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Texture sits behind the content and fades out before the fold ends. */}
      <div
        aria-hidden
        className="texture-dots pointer-events-none absolute inset-0 opacity-60 mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-28">
        <div className="max-w-xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 shadow-soft ring-1 ring-ink-100">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              Real-time delivery over WebSockets
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[1.05] tracking-tight text-ink-950 sm:text-6xl lg:text-[4.25rem]">
              Say it once.
              <br />
              <span className="text-accent-deep">It&apos;s already there.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-500">
              Messengo is messaging stripped back to the part that matters — the conversation.
              Messages land the moment they&apos;re sent, groups take seconds to start, and the
              message list never loses your place.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartCta />
              <Link
                href="#features"
                className="inline-flex h-13 items-center justify-center rounded-full px-6 text-base font-medium text-ink-700 transition-colors hover:bg-ink-100"
              >
                See what it does
              </Link>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-6 text-sm text-ink-400">
              No password to remember — sign in with your phone number and name.
            </p>
          </Reveal>
        </div>

        <Reveal delay={140} className="lg:pl-4">
          <ChatPreview />
        </Reveal>
      </div>
    </section>
  );
}
