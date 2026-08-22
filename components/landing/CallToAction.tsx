import { Radio, Sparkles, UsersRound, Volume2 } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/landing/Reveal';
import { StartCta } from '@/components/landing/StartCta';

/** Kept short: this row is scanned, not read. */
const POINTS = [
  { icon: Radio, label: 'Live over WebSockets' },
  { icon: UsersRound, label: 'Groups in seconds' },
  { icon: Volume2, label: 'Sounds on arrival' },
] as const;

/**
 * Closing call to action.
 *
 * Built on ink rather than a flat wash of brand colour: a saturated slab that
 * size reads as a block of paint, and white text on the light end of the ramp
 * is unreadable anyway. The brand arrives here as light instead — three blurred
 * radial blooms running the logo's cyan-to-indigo ramp diagonally across a dark
 * panel, which gives the section depth the flat fill never had.
 */
export function CallToAction() {
  return (
    <section className="px-5 pb-16 sm:px-8 sm:pb-24">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-ink-950 shadow-lifted ring-1 ring-inset ring-white/10">
          {/* The logo's ramp, as light: cyan high left, indigo low right. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-40 size-[38rem] bg-[radial-gradient(closest-side,var(--color-brand-500),transparent)] opacity-45 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-52 -right-28 size-[38rem] bg-[radial-gradient(closest-side,var(--color-brand-800),transparent)] opacity-60 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 right-1/4 size-[22rem] bg-[radial-gradient(closest-side,var(--color-brand-400),transparent)] opacity-25 blur-3xl"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          {/* Lit top edge — the detail that stops the panel reading as a sticker. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
          />

          <div className="relative px-6 py-14 sm:px-12 sm:py-18 lg:px-16">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                <Sparkles aria-hidden className="size-3.5 text-brand-400" />
                No password. No setup.
              </span>

              {/* `text-balance` keeps the headline from stranding a word on its own line. */}
              <h2 className="mt-6 text-balance font-display text-4xl leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Your next conversation is one number away
              </h2>

              <p className="mx-auto mt-5 max-w-lg text-pretty text-lg leading-relaxed text-white/65">
                Sign in with your phone number and name. If it&apos;s your first time, the account
                creates itself.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <StartCta variant="onDark" />
                <Link
                  href="#features"
                  className="inline-flex h-13 items-center justify-center rounded-full px-6 text-base font-medium text-white/85 ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/10 hover:text-white"
                >
                  See what it does
                </Link>
              </div>
            </div>

            <ul className="mx-auto mt-12 grid max-w-3xl divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {POINTS.map((point) => (
                <li
                  key={point.label}
                  className="flex items-center justify-center gap-2.5 px-5 py-4 text-sm text-white/75"
                >
                  <point.icon aria-hidden className="size-4 shrink-0 text-brand-400" />
                  {point.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
