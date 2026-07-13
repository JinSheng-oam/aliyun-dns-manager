'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  variant: 'default' | 'danger';
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmContextValue>((options) => {
    resolverRef.current?.(false);

    setPendingConfirm({
      title: options.title,
      description: options.description,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      variant: options.variant || 'default',
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPendingConfirm(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {pendingConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            className="w-full max-w-md rounded-2xl border p-6 shadow-xl animate-in zoom-in-95 duration-150"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <div className="flex items-start gap-4">
              <div
                className="rounded-xl p-2.5 shrink-0"
                style={{
                  backgroundColor:
                    pendingConfirm.variant === 'danger' ? 'var(--danger-light)' : 'var(--accent-light)',
                  color: pendingConfirm.variant === 'danger' ? 'var(--danger)' : 'var(--accent)',
                }}
              >
                {pendingConfirm.variant === 'danger' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="confirm-dialog-title"
                  className="text-lg font-semibold"
                  style={{ color: 'var(--fg)' }}
                >
                  {pendingConfirm.title}
                </h2>
                <p
                  id="confirm-dialog-description"
                  className="mt-2 whitespace-pre-line text-sm leading-6"
                  style={{ color: 'var(--muted)' }}
                >
                  {pendingConfirm.description}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {pendingConfirm.cancelText}
              </Button>
              <Button
                type="button"
                variant={pendingConfirm.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {pendingConfirm.confirmText}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);

  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }

  return confirm;
}
