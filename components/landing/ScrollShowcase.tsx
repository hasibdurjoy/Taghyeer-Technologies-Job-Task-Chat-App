import { ArrowDown, MoveHorizontal, PenLine, RotateCw } from 'lucide-react';

import { Reveal } from '@/components/landing/Reveal';

const DETAILS = [
  {
    icon: ArrowDown,
    label: 'Smart scrolling',
    title: '“3 new messages” instead of a jolt',
    body: 'Reading back through a thread is normal. When something new arrives while you are up there, Messengo counts it in a small pill at the bottom rather than dragging you away mid-sentence. Tap it to catch up.',
  },
  {
    icon: RotateCw,
    label: 'Failed sends',
    title: 'Retry without retyping',
    body: 'A message that does not make it stays exactly where you wrote it, marked and ready to send again with one tap. Your words are never the thing that gets lost.',
  },
  {
    icon: PenLine,
    label: 'Drafts',
    title: 'Half-written messages wait for you',
    body: 'Switch conversations mid-thought and come back later — the draft is still sitting in the composer where you left it, per conversation.',
  },
  {
    icon: MoveHorizontal,
    label: 'Your layout',
    title: 'Drag the list to the width you want',
    body: 'The divider between your conversations and the messages is a handle. Pull it wider for long group names, narrower for more room to read — it remembers where you left it.',
  },
] as const;

/** Second-level detail section: the small behaviours that make the chat feel finished. */
export function ScrollShowcase() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
          The small things
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink-950 sm:text-4xl">
          Details you only notice when they&apos;re missing
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {DETAILS.map((detail, index) => (
          <Reveal key={detail.title} delay={index * 80}>
            <article className="h-full rounded-card bg-surface p-6 shadow-soft ring-1 ring-ink-100 transition-shadow hover:shadow-lifted">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="brand-gradient flex size-8 items-center justify-center rounded-lg text-white"
                >
                  <detail.icon className="size-4" strokeWidth={2} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {detail.label}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-ink-950">
                {detail.title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">{detail.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
