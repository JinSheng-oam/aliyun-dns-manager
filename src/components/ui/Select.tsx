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

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    return (
        <div ref={rootRef} className={twMerge('relative w-full', className)}>
            <button
                type="button"
                className="field-control flex h-10 items-center justify-between gap-2 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
            >
                <span className="truncate">{selectedOption?.label || options[0]?.label || '请选择'}</span>
                <ChevronDown className={twMerge('h-4 w-4 shrink-0 text-blue-200/80 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
                <div
                    id={listboxId}
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-[70] mt-2 max-h-64 overflow-auto rounded-xl border border-blue-300/20 bg-slate-950/95 p-1 text-sm text-gray-100 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
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
                                className={twMerge(
                                    'flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors',
                                    isSelected ? 'bg-blue-500/18 text-blue-100' : 'text-gray-300 hover:bg-white/8 hover:text-white',
                                    option.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-gray-300'
                                )}
                                onClick={() => {
                                    if (option.disabled) return;
                                    onValueChange(option.value);
                                    setIsOpen(false);
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
