import { InputHTMLAttributes, forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="text-sm font-medium text-gray-300 ml-1">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={twMerge(
                        'flex h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-black/30',
                        error && 'border-red-500/50 focus:ring-red-500/50',
                        className
                    )}
                    {...props}
                />
                {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
