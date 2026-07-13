'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useSyncExternalStore } from 'react';
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

const typeStyles: Record<ToastType, React.CSSProperties> = {
  success: {
    backgroundColor: 'var(--success-light)',
    borderColor: 'oklch(62% 0.18 145 / 0.25)',
    color: 'oklch(35% 0.1 145)',
  },
  error: {
    backgroundColor: 'var(--danger-light)',
    borderColor: 'oklch(55% 0.2 20 / 0.2)',
    color: 'oklch(35% 0.12 20)',
  },
  info: {
    backgroundColor: 'var(--accent-light)',
    borderColor: 'oklch(56% 0.18 255 / 0.2)',
    color: 'oklch(40% 0.12 255)',
  },
};

const iconColors: Record<ToastType, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--accent)',
};

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
    setTimeout(() => removeToast(id), 3000);
  }, [removeToast]);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);
  const contextValue = useMemo(
    () => ({ addToast, success, error, info }),
    [addToast, success, error, info]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {isMounted && createPortal(
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.96 }}
                layout
                className="pointer-events-auto min-w-[300px] max-w-md rounded-xl border px-4 py-3 flex items-start gap-3 shadow-lg"
                style={typeStyles[toast.type]}
              >
                <div className="mt-0.5 shrink-0">
                  {toast.type === 'success' && <CheckCircle className="h-5 w-5" style={{ color: iconColors.success }} />}
                  {toast.type === 'error' && <AlertCircle className="h-5 w-5" style={{ color: iconColors.error }} />}
                  {toast.type === 'info' && <Info className="h-5 w-5" style={{ color: iconColors.info }} />}
                </div>
                <div className="flex-1 text-sm font-medium">{toast.message}</div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
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
