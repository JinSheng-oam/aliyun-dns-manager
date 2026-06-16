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
                        'field-control flex h-10 px-3 py-2 text-sm',
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
