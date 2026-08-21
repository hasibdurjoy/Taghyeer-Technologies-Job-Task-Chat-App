import { cx } from '@/lib/utils';
import type { ConnectionStatus } from '@/types/chat';

const PRESENTATION: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  connected: { label: 'Live', dot: 'bg-success', text: 'text-success' },
  connecting: { label: 'Connecting', dot: 'bg-accent', text: 'text-accent-deep' },
  disconnected: { label: 'Offline', dot: 'bg-danger', text: 'text-danger' },
};

/**
 * Socket connection state.
 *
 * Worth showing because delivery here is push-based: if the socket is down the
 * user would otherwise have no way to know their messages have stopped arriving.
 */
export function ConnectionIndicator({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const { label, dot, text } = PRESENTATION[status];

  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      <span className="relative flex size-1.5 shrink-0">
        {status === 'connected' && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-success"
            style={{ animation: 'pulse-ring 2.4s ease-out infinite' }}
          />
        )}
        <span aria-hidden className={cx('size-1.5 rounded-full', dot)} />
      </span>
      <span className={cx('text-[0.6875rem] font-medium uppercase tracking-wide', text)}>
        {label}
      </span>
      <span className="sr-only">
        {status === 'connected'
          ? 'Connected — new messages arrive automatically.'
          : status === 'connecting'
            ? 'Connecting to the message service.'
            : 'Disconnected. Reconnecting automatically.'}
      </span>
    </span>
  );
}
