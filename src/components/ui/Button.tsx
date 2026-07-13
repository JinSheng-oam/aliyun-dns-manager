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
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed select-none';

    const sizes = {
      default: 'h-9 px-4 py-2 text-sm rounded-lg gap-2',
      sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
      lg: 'h-11 px-6 text-[15px] rounded-lg gap-2',
      icon: 'h-9 w-9 rounded-lg',
    };

    const variants = {
      primary:
        'text-white active:scale-[0.98]',
      secondary:
        'active:scale-[0.98]',
      danger:
        'active:scale-[0.98]',
      ghost:
        '',
    };

    // Dynamic colors via inline styles to use CSS custom properties
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--accent)',
        color: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      },
      secondary: {
        backgroundColor: 'var(--surface)',
        color: 'var(--fg)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      },
      danger: {
        backgroundColor: 'var(--danger-light)',
        color: 'var(--danger)',
        border: '1px solid oklch(55% 0.2 20 / 0.15)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--muted)',
      },
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={twMerge(baseStyles, sizes[size], variants[variant], className)}
        style={{
          ...variantStyles[variant],
          '--tw-ring-color': variant === 'danger' ? 'var(--danger)' : 'var(--accent)',
        } as React.CSSProperties}
        {...props}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          if (disabled || isLoading) return;
          if (variant === 'primary') {
            el.style.backgroundColor = 'var(--accent-hover)';
          } else if (variant === 'secondary') {
            el.style.backgroundColor = 'var(--surface-hover)';
            el.style.borderColor = 'var(--border-hover)';
          } else if (variant === 'danger') {
            el.style.backgroundColor = 'oklch(95% 0.03 20)';
          } else if (variant === 'ghost') {
            el.style.backgroundColor = 'var(--surface-hover)';
            el.style.color = 'var(--fg)';
          }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          if (disabled || isLoading) return;
          if (variant === 'primary') {
            el.style.backgroundColor = 'var(--accent)';
          } else if (variant === 'secondary') {
            el.style.backgroundColor = 'var(--surface)';
            el.style.borderColor = 'var(--border)';
          } else if (variant === 'danger') {
            el.style.backgroundColor = 'var(--danger-light)';
          } else if (variant === 'ghost') {
            el.style.backgroundColor = 'transparent';
            el.style.color = 'var(--muted)';
          }
        }}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
