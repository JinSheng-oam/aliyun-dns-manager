import { InputHTMLAttributes, forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {label && (
          <label
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: error ? 'var(--danger)' : 'var(--muted)',
              paddingLeft: '2px',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={twMerge('field-control', className)}
          style={error ? { borderColor: 'var(--danger)', boxShadow: 'none' } : undefined}
          {...props}
        />
        {error && (
          <p style={{ fontSize: '0.75rem', color: 'var(--danger)', paddingLeft: '2px' }}>{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
