import React from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  /** Say exactly what will happen, and what won't. */
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button; Cancel gets the focus so Enter doesn't destroy anything. */
  destructive?: boolean;
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={busy ? () => undefined : onCancel}
    title={title}
    maxWidth="440px"
    footer={
      <>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={busy}
          data-autofocus={destructive || undefined}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          size="sm"
          onClick={onConfirm}
          loading={busy}
          data-autofocus={!destructive || undefined}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div style={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-main)' }}>{message}</div>
  </Modal>
);
