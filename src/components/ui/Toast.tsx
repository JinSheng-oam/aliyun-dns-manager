'use client';

import React, { createContext, useContext, useState, useCallback, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const isMounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false
    );

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 3000); // Auto close after 3s
    }, [removeToast]);

    const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
    const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
    const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, success, error, info }}>
            {children}
            {isMounted && createPortal(
                <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                    <AnimatePresence>
                        {toasts.map((toast) => (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                                layout
                                className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-xl shadow-lg border backdrop-blur-md flex items-start gap-3 ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                                    toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                                        'bg-blue-500/10 border-blue-500/20 text-blue-200'
                                    }`}
                            >
                                <div className="mt-0.5">
                                    {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-green-400" />}
                                    {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-red-400" />}
                                    {toast.type === 'info' && <Info className="h-5 w-5 text-blue-400" />}
                                </div>
                                <div className="flex-1 text-sm font-medium">{toast.message}</div>
                                <button
                                    onClick={() => removeToast(toast.id)}
                                    className="text-white/40 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
