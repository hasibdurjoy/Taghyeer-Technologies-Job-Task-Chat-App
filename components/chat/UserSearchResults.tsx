'use client';

import { Check, Info, Loader2, Search, UserRoundSearch } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { cx } from '@/lib/utils';
import type { User } from '@/types/chat';

interface UserSearchResultsProps {
  term: string;
  results: User[];
  isSearching: boolean;
  error: string | null;
  hasSearched: boolean;
  truncated: boolean;
  phoneSearchLimited: boolean;
  onRetry: () => void;
  onSelect: (user: User) => void;
  /** Ids already chosen — rendered with a check and a pressed state. */
  selectedIds?: string[];
  /** Ids already accounted for — labelled so the row reads as informative, not broken. */
  existingIds?: string[];
  /** Badge text for an `existingIds` match. */
  existingLabel?: string;
  /** When true, `existingIds` rows can't be picked (they're already members). */
  disableExisting?: boolean;
  busyId?: string | null;
}

/**
 * Result list shared by both dialogs.
 *
 * The hints about case-sensitivity and phone lookup are deliberate: the upstream
 * search matches names by case-sensitive prefix and phones by exact equality, so
 * without guidance an empty result looks like a broken feature.
 */
export function UserSearchResults({
  term,
  results,
  isSearching,
  error,
  hasSearched,
  truncated,
  phoneSearchLimited,
  onRetry,
  onSelect,
  selectedIds = [],
  existingIds = [],
  existingLabel = 'Existing chat',
  disableExisting = false,
  busyId = null,
}: UserSearchResultsProps) {
  if (!term.trim()) {
    return (
      <EmptyState
        icon={<UserRoundSearch className="size-5" />}
        title="Find someone to message"
        description="Search by name, or paste a phone number exactly as it was registered."
      />
    );
  }

  if (isSearching && results.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-500">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Searching…
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Search failed" message={error} onRetry={onRetry} />;
  }

  if (hasSearched && results.length === 0) {
    return (
      <EmptyState
        icon={<Search className="size-5" />}
        title="No people found"
        description={
          phoneSearchLimited
            ? 'The directory can only match a phone number that is typed exactly as registered — and it cannot look up numbers starting with “+”. Try searching by name instead.'
            : 'Names are matched from the beginning and are case-sensitive, so try the exact spelling — for example “Ada” rather than “ada”.'
        }
      />
    );
  }

  return (
    <div>
      {phoneSearchLimited && (
        <p className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent-deep">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Phone numbers starting with “+” can&apos;t be searched by the directory. These results
          come from matching the digits alone.
        </p>
      )}

      <ul className="space-y-0.5 px-2 pb-2">
        {results.map((user) => {
          const isSelected = selectedIds.includes(user.id);
          const isExisting = existingIds.includes(user.id);
          const isBusy = busyId === user.id;
          const isLocked = disableExisting && isExisting;

          return (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => onSelect(user)}
                disabled={isBusy || isLocked}
                aria-pressed={selectedIds.length > 0 ? isSelected : undefined}
                className={cx(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  isLocked
                    ? 'cursor-default opacity-60'
                    : 'disabled:cursor-wait hover:bg-paper-dim active:bg-ink-100',
                  isSelected && 'bg-ink-100',
                )}
              >
                <Avatar name={user.name} seed={user.id} size="sm" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium leading-tight text-ink-950">
                    {user.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-400">{user.phone}</span>
                </span>

                {isExisting && !isSelected && (
                  <span className="shrink-0 rounded-full bg-paper-dim px-2 py-0.5 text-[0.6875rem] font-medium text-ink-500">
                    {existingLabel}
                  </span>
                )}

                {isBusy && <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-ink-500" />}

                {isSelected && (
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {truncated && (
        <p className="px-5 pb-3 text-xs text-ink-400">
          Showing the first 50 matches. Narrow your search to see more specific results.
        </p>
      )}
    </div>
  );
}
