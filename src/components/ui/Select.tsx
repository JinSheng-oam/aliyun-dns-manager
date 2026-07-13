'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, options, onValueChange, ariaLabel, className, disabled }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const isDisabled = disabled || options.length === 0 || options.every((option) => option.disabled);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={twMerge('relative w-full', className)}>
      <button
        type="button"
        className="field-control flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        style={isOpen ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px oklch(56% 0.18 255 / 0.12)' } : undefined}
      >
        <span className="truncate">{selectedOption?.label || options[0]?.label || '请选择'}</span>
        <ChevronDown
          className={twMerge('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
          style={{ color: 'var(--muted)' }}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[70] mt-1.5 max-h-64 overflow-auto rounded-lg border p-1 text-sm shadow-xl animate-in fade-in zoom-in-95 duration-100"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className="flex w-full items-center rounded-md px-3 py-2 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--fg)',
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                  opacity: option.disabled ? 0.4 : 1,
                }}
                onClick={() => {
                  if (option.disabled) return;
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !option.disabled) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !option.disabled) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
