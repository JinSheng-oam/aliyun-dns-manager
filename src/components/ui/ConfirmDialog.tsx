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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md">
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-dialog-title"
                        aria-describedby="confirm-dialog-description"
                        className="glass w-full max-w-md rounded-3xl border-white/15 bg-slate-950/88 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] animate-in fade-in zoom-in-95 duration-200"
                    >
                        <div className="flex items-start gap-4">
                            <div className={`rounded-2xl p-3 ${pendingConfirm.variant === 'danger'
                                ? 'bg-red-500/12 text-red-300'
                                : 'bg-blue-500/12 text-blue-300'
                                }`}>
                                {pendingConfirm.variant === 'danger'
                                    ? <AlertTriangle className="h-5 w-5" />
                                    : <ShieldAlert className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">
                                    {pendingConfirm.title}
                                </h2>
                                <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-gray-400">
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
