'use client';

import { Play } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Reveal } from '@/components/landing/Reveal';
import { cx } from '@/lib/utils';

const VIDEO_ID = 'nxCqbukb1OE';
const VIDEO_TITLE = 'Messengo Chat App Working Demo';
/** 1280×720 poster frame — the highest resolution YouTube publishes for this video. */
const POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

/**
 * A walkthrough of the running app.
 *
 * The player is loaded on click, not on page load. A YouTube iframe pulls in
 * roughly a megabyte of third-party JavaScript and sets cookies before anyone
 * has asked to watch anything, which is a poor trade on a page whose whole
 * point is that it's fast. Until then this is one image and a button.
 */
export function Demo() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section id="demo" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
          See it working
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink-950 sm:text-4xl">
          The real thing, not a mockup
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-ink-500">
          A walkthrough of the running app — messages landing live, typing indicators, groups, and
          the rest of it.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-10">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink-950 shadow-lifted ring-1 ring-ink-100">
          {isPlaying ? (
            <iframe
              // `-nocookie` so watching doesn't set tracking cookies on this domain.
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
              title={VIDEO_TITLE}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              aria-label={`Play video: ${VIDEO_TITLE}`}
              className="group absolute inset-0 size-full cursor-pointer"
            >
              <Image
                src={POSTER}
                // Decorative: the button's label already names the video.
                alt=""
                fill
                sizes="(min-width: 1024px) 64rem, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-ink-950/30 transition-colors group-hover:bg-ink-950/15"
              />
              <span
                aria-hidden
                className={cx(
                  'absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2',
                  'items-center justify-center rounded-full bg-white text-ink-950 shadow-lifted',
                  'transition-transform duration-300 group-hover:scale-110',
                )}
              >
                {/* Nudged right so the triangle looks centred in the circle. */}
                <Play aria-hidden className="size-6 translate-x-0.5" fill="currentColor" />
              </span>
            </button>
          )}
        </div>
      </Reveal>
    </section>
  );
}
