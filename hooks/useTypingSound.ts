'use client';

import { useEffect, useRef } from 'react';

/** Lives in `public/`. The extension is uppercase on disk, and case matters
 *  once this is served from a case-sensitive filesystem. */
const TYPING_SOUND_SRC = '/typing_audio.MP3';

/**
 * Loops a sound for as long as someone is typing.
 *
 * Driven by state rather than by an event: the indicator can appear and vanish
 * on a TTL sweep with no "stopped" signal ever arriving (see
 * `useTypingIndicator`), so playback follows the rendered state and cannot be
 * left running by a signal that never came.
 */
export function useTypingSound(isTyping: boolean, src: string = TYPING_SOUND_SRC) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      // Covers unmount mid-playback: navigating away must not leave a loop running.
      audio.pause();
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isTyping) {
      // Already looping from a previous render — restarting would stutter.
      if (!audio.paused) return;
      // Refused until the document has seen a user gesture; by the time someone
      // is typing at you, that has happened. Silence is the right failure here.
      void audio.play().catch(() => {});
      return;
    }

    audio.pause();
    // Rewind so the next burst starts from the top rather than mid-clip.
    audio.currentTime = 0;
  }, [isTyping, src]);
}
