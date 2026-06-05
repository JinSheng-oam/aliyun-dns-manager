import { ButtonHTMLAttributes, forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'default', isLoading, children, disabled, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

        const sizes = {
            default: 'h-10 px-4 py-2',
            sm: 'h-9 px-3',
            lg: 'h-11 px-8',
            icon: 'h-10 w-10',
        };

        const variants = {
            primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 focus:ring-blue-500',
            secondary: 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm focus:ring-white/50',
            danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/30 focus:ring-red-500',
            ghost: 'hover:bg-white/5 text-gray-400 hover:text-white',
        };

        return (
            <button
                ref={ref}
                disabled={isLoading || disabled}
                className={twMerge(baseStyles, sizes[size], variants[variant], className)}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
