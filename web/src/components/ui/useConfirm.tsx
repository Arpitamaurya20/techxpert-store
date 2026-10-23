import { useCallback, useState } from 'react';
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog';

interface Pending {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

/**
 * Awaitable replacement for `window.confirm`. Render `dialog` once in the screen, then:
 *   if (!(await confirm({ title, message, confirmLabel, destructive: true }))) return;
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? (
    <ConfirmDialog isOpen {...pending.options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;

  return { confirm, dialog };
}
