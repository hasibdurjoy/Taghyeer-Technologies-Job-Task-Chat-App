'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Narrow enough to stay useful — names and timestamps still fit on one line. */
export const SIDEBAR_MIN_WIDTH = 260;
/** Wide enough for long group titles without the list dominating the window. */
export const SIDEBAR_MAX_WIDTH = 560;
/** Matches the `lg:w-96` the list used before it became resizable. */
export const SIDEBAR_DEFAULT_WIDTH = 384;

const STORAGE_KEY = 'messengo:sidebar-width';
/** One arrow press. Coarse enough to cross the range without holding the key forever. */
const KEYBOARD_STEP = 16;
/** The list may never take more than half the window, whatever the stored width says. */
const MAX_VIEWPORT_FRACTION = 0.5;

/** The bound right now: the constant, pulled in on a window too narrow for it. */
function currentMaxWidth(): number {
  if (typeof window === 'undefined') return SIDEBAR_MAX_WIDTH;
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth * MAX_VIEWPORT_FRACTION),
  );
}

function clampTo(value: number, max: number): number {
  return Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, value));
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

interface UseResizableSidebarResult {
  width: number;
  /** Upper bound right now — the constant, or half the window when that is narrower. */
  maxWidth: number;
  isResizing: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  /** Back to the default; wired to a double-click on the handle. */
  reset: () => void;
}

/**
 * Drag-to-resize state for the conversation list.
 *
 * Desktop-only by construction: on mobile the list is a full-width pane rather
 * than a column, so the caller applies this width from the `md` breakpoint up
 * and never renders the handle below it.
 *
 * The stored width is read in a lazy initializer rather than restored in an
 * effect. `ChatLayout` mounts only once the session has been read from the
 * browser, so its first render is always client-side — there is no server HTML
 * for a localStorage read to disagree with, and this avoids a frame at the
 * default width before the real one lands.
 */
export function useResizableSidebar(): UseResizableSidebarResult {
  const [maxWidth, setMaxWidth] = useState(currentMaxWidth);
  const [width, setWidth] = useState(() => clampTo(readStoredWidth(), currentMaxWidth()));
  const [isResizing, setIsResizing] = useState(false);

  // Pointer handlers are set up once per drag and would otherwise close over the
  // width and bound from the render that started it.
  const widthRef = useRef(width);
  const maxWidthRef = useRef(maxWidth);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    maxWidthRef.current = maxWidth;
  }, [maxWidth]);

  const persist = useCallback((value: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
    } catch {
      // Private browsing or a full quota. A forgotten width is not worth an error.
    }
  }, []);

  // A window narrow enough to squeeze the conversation out pulls the bound in
  // with it, dragging the current width along if it no longer fits. No initial
  // call needed — the state above already starts at the right bound.
  useEffect(() => {
    const sync = () => {
      const limit = currentMaxWidth();
      setMaxWidth(limit);
      setWidth((current) => Math.min(current, limit));
    };

    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // A drag must not leave a text selection or an I-beam cursor behind as the
  // pointer crosses the panes.
  useEffect(() => {
    if (!isResizing) return;

    const { body } = document;
    const previousCursor = body.style.cursor;
    const previousUserSelect = body.style.userSelect;
    body.style.cursor = 'col-resize';
    body.style.userSelect = 'none';

    return () => {
      body.style.cursor = previousCursor;
      body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Only the primary button drags; a right-click should open the menu.
      if (event.button !== 0) return;
      event.preventDefault();

      const handle = event.currentTarget;
      const startX = event.clientX;
      const startWidth = widthRef.current;
      const { pointerId } = event;

      // Capture routes every move to the handle even when the pointer outruns
      // it, which it will — the width stops at the bounds and the cursor doesn't.
      handle.setPointerCapture(pointerId);
      setIsResizing(true);

      const handleMove = (moveEvent: PointerEvent) => {
        setWidth(clampTo(startWidth + (moveEvent.clientX - startX), maxWidthRef.current));
      };

      const handleEnd = () => {
        handle.removeEventListener('pointermove', handleMove);
        handle.removeEventListener('pointerup', handleEnd);
        handle.removeEventListener('pointercancel', handleEnd);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        setIsResizing(false);
        // Written once per drag rather than once per pixel of movement.
        persist(widthRef.current);
      };

      handle.addEventListener('pointermove', handleMove);
      handle.addEventListener('pointerup', handleEnd);
      handle.addEventListener('pointercancel', handleEnd);
    },
    [persist],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const max = maxWidthRef.current;
      const next = (() => {
        switch (event.key) {
          case 'ArrowLeft':
            return clampTo(widthRef.current - KEYBOARD_STEP, max);
          case 'ArrowRight':
            return clampTo(widthRef.current + KEYBOARD_STEP, max);
          case 'Home':
            return SIDEBAR_MIN_WIDTH;
          case 'End':
            return max;
          default:
            return null;
        }
      })();

      if (next === null) return;
      // Arrow keys would otherwise scroll the pane behind the handle.
      event.preventDefault();
      setWidth(next);
      persist(next);
    },
    [persist],
  );

  const reset = useCallback(() => {
    const next = clampTo(SIDEBAR_DEFAULT_WIDTH, maxWidthRef.current);
    setWidth(next);
    persist(next);
  }, [persist]);

  return { width, maxWidth, isResizing, onPointerDown, onKeyDown, reset };
}
