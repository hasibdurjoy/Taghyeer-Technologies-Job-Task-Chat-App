'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Lives in `public/`, so it is served from the app's own origin. */
const SOUND_SRC = '/messenger_sound.mp3';

/**
 * Plays a short sound when a message arrives.
 *
 * The element is created once and reused: constructing an `Audio` per message
 * would re-fetch the file and lose the autoplay permission earned below.
 *
 * Browsers refuse programmatic playback until the document has seen a user
 * gesture, and a chat can receive its first message before the user has clicked
 * anything. Priming the element on the first interaction satisfies the policy
 * for the rest of the session — including while the tab sits in the background,
 * which is where a notification sound matters most.
 */
export function useNotificationSound(src: string = SOUND_SRC) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioRef.current = audio;

    const unlock = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);

      // Muted so priming is inaudible; the gesture still counts.
      audio.muted = true;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {})
        .finally(() => {
          audio.muted = false;
        });
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.pause();
      audioRef.current = null;
    };
  }, [src]);

  return useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Rewind first so a burst of messages pings each time, rather than the
    // second call being swallowed while the first is still playing.
    audio.currentTime = 0;
    // Playback can still be refused — no gesture yet, or the OS/tab is muted.
    // A missed notification sound is not worth surfacing to the user.
    void audio.play().catch(() => {});
  }, []);
}
