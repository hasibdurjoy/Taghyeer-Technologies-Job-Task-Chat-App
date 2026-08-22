import {
  ArrowDownToLine,
  AudioLines,
  BellRing,
  Columns3,
  History,
  PenLine,
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
      'Messages arrive over a live WebSocket connection — no refreshing, no polling delay. A status dot tells you when the connection drops.',
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
    icon: History,
    title: 'History that holds up',
    description:
      'Full conversation history with date separators, paged in as you scroll back. Drafts survive switching chats.',
  },
] as const;

export function Features() {
  return (
    <section id="features" className="border-y border-ink-100 bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl leading-tight tracking-tight text-ink-950 sm:text-4xl">
            Built around how people actually message
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-500">
            Every detail here exists because its absence is annoying.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li key={feature.title}>
              <Reveal delay={index * 60}>
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-700 ring-1 ring-inset ring-brand-600/10"
                >
                  <feature.icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-[1.0625rem] font-semibold tracking-tight text-ink-950">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
                  {feature.description}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
