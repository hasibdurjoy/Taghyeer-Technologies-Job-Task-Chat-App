'use client';

import { SIDEBAR_MIN_WIDTH } from '@/hooks/useResizableSidebar';
import { cx } from '@/lib/utils';

interface SidebarResizerProps {
  width: number;
  maxWidth: number;
  isResizing: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onReset: () => void;
}

/**
 * The drag handle between the conversation list and the open conversation.
 *
 * It doubles as the divider between the two panes, so the list no longer draws
 * its own right border — two lines a pixel apart would read as a seam.
 *
 * Focusable and driven by the arrow keys as well as the pointer: a control that
 * only responds to dragging is unusable without a mouse.
 */
export function SidebarResizer({
  width,
  maxWidth,
  isResizing,
  onPointerDown,
  onKeyDown,
  onReset,
}: SidebarResizerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize conversation list"
      aria-valuenow={Math.round(width)}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={Math.round(maxWidth)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      title="Drag to resize · double-click to reset"
      className={cx(
        // `touch-none` keeps a touch drag from scrolling the pane instead.
        'group relative hidden w-1.5 shrink-0 cursor-col-resize touch-none md:block',
        // The handle sits outside the panes, so its own focus ring would be
        // clipped to 6px of width; the bar below stands in as the indicator.
        'focus:outline-none',
      )}
    >
      {/* Hairline by default, thickening into the accent on hover, focus, or drag. */}
      <span
        aria-hidden
        className={cx(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all',
          isResizing
            ? 'w-0.5 bg-accent'
            : 'w-px bg-ink-100 group-hover:w-0.5 group-hover:bg-accent group-focus-visible:w-0.5 group-focus-visible:bg-accent',
        )}
      />
    </div>
  );
}
