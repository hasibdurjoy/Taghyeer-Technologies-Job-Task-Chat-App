'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation step for actions that can't be undone.
 *
 * Used for removing someone from a group and for leaving one — both are
 * irreversible from the actor's side (there is no rejoin, and no un-remove), so
 * a misclick shouldn't be enough to trigger them.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  isDestructive = false,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel} title={title} description={description} className="sm:max-w-md">
      <div className="flex justify-end gap-2 px-5 py-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button
          variant={isDestructive ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          isLoading={isPending}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
