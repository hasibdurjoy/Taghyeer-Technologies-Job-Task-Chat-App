import {
  ArrowDownToLine,
  AudioLines,
  BellRing,
  Columns3,
  History,
  Inbox,
  PenLine,
  PictureInPicture2,
  PlugZap,
  Radio,
  Search,
  UsersRound,
} from 'lucide-react';

import { Reveal } from '@/components/landing/Reveal';

const FEATURES = [
  {
    icon: Radio,
    title: 'Real-time delivery',
    description:
      'Messages arrive over a live WebSocket connection — no refreshing, and no polling anywhere in the app.',
  },
  {
    icon: UsersRound,
    title: 'Groups in seconds',
    description:
      'Name a group, pick the people, done. Everyone sees it appear the moment it exists.',
  },
  {
    icon: PenLine,
    title: 'See them typing',
    description:
      'Live typing indicators, so you know a reply is coming instead of staring at a still screen.',
  },
  {
    icon: AudioLines,
    title: 'Hear them typing',
    description:
      'The typing indicator has a sound to go with it, looping softly while the other person writes and stopping the moment they stop.',
  },
  {
    icon: BellRing,
    title: 'You never miss one',
    description:
      'An arriving message plays a notification sound whether the tab is focused or sitting in the background, so you can look away without losing the thread.',
  },
  {
    icon: Columns3,
    title: 'Three columns when there is room',
    description:
      'On a wide screen the conversation list, the messages, and the details of whoever you are talking to all sit side by side. Narrower screens fold back to two.',
  },
  {
    icon: Search,
    title: 'Find anyone',
    description:
      'Search the directory by name or phone number and start a conversation straight from the result.',
  },
  {
    icon: ArrowDownToLine,
    title: 'Never loses your place',
    description:
      'Scrolled up reading something? New messages wait in a quiet counter instead of yanking you to the bottom.',
  },
  {
    icon: Inbox,
    title: 'Your messages, one click away',
    description:
      'Signed in on the landing page? Your conversations are in the header — open the list, pick one, and read it without going anywhere.',
  },
  {
    icon: PictureInPicture2,
    title: 'Chat without leaving the page',
    description:
      'Conversations open as floating windows docked in the corner. Keep a few going at once, minimise the ones you are not reading, close the ones you are done with.',
  },
  {
    icon: PlugZap,
    title: 'Survives a dropped connection',
    description:
      'A status dot tells you the moment the socket goes. When it comes back, the conversation and the list are refetched so nothing sent while you were gone is missing.',
  },
  {
    icon: History,
    title: 'History that holds up',
    description:
      'Full conversation history with date separators, paged in as you scroll back. Drafts survive switching chats.',
  },
] as const;

export function Features() {
  return (
    <section id="features" className="border-y border-ink-100 bg-paper-dim">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl leading-tight tracking-tight text-ink-950 sm:text-4xl">
            Built around how people actually message
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-500">
            Every detail here exists because its absence is annoying.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li key={feature.title} className="h-full">
              <Reveal delay={index * 60} className="h-full">
                <article className="group relative h-full overflow-hidden rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ink-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted hover:ring-brand-600/25">
                  {/* Brand light blooming from the corner, only while hovered. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[radial-gradient(closest-side,var(--color-brand-500),transparent)] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
                  />

                  {/*
                    The gradient is a stacked layer rather than a hover
                    background: a solid colour cannot cross-fade into an image,
                    so swapping them directly would snap instead of animate.
                  */}
                  <span
                    aria-hidden
                    className="relative flex size-11 items-center justify-center rounded-xl bg-brand-soft ring-1 ring-inset ring-brand-600/10 transition-all duration-300 group-hover:ring-transparent"
                  >
                    <span className="brand-gradient absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <feature.icon
                      className="relative size-5 text-brand-700 transition-colors duration-300 group-hover:text-white"
                      strokeWidth={1.75}
                    />
                  </span>

                  <h3 className="relative mt-5 text-[1.0625rem] font-semibold tracking-tight text-ink-950">
                    {feature.title}
                  </h3>
                  <p className="relative mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
                    {feature.description}
                  </p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
