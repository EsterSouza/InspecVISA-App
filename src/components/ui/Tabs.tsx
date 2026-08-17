import React from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Rotulo acessivel do grupo de abas, ex: "Seções do cliente". */
  'aria-label': string;
}

/**
 * Abas com sublinhado que corre: docs/prototipos/_src/components.css `.tabs`.
 * ARIA completo (tablist/tab, roving tabindex, setas do teclado) — usado hoje
 * à mão em telas como ClientDetails.tsx sem nenhum desses três.
 */
export function Tabs({ items, value, onChange, className, ...rest }: TabsProps) {
  const ariaLabel = rest['aria-label'];
  const listRef = React.useRef<HTMLDivElement>(null);

  const enabledItems = items.filter((item) => !item.disabled);

  const focusTab = (targetValue: string) => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${targetValue}"]`);
    el?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = enabledItems.findIndex((item) => item.value === value);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabledItems.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabledItems.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      const next = enabledItems[nextIndex];
      onChange(next.value);
      focusTab(next.value);
    }
  };

  return (
    <div className={cn('border-b border-default', className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              data-value={item.value}
              id={`tab-${item.value}`}
              aria-controls={`tabpanel-${item.value}`}
              aria-selected={selected}
              disabled={item.disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              className={cn(
                'relative h-[42px] min-w-[80px] whitespace-nowrap px-4 text-sm font-semibold text-navy-3 transition-colors',
                'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-primary-700 after:transition-transform after:duration-200',
                selected ? 'text-primary-700 after:scale-x-100' : 'hover:text-navy',
                item.disabled && 'cursor-not-allowed opacity-40 hover:text-navy-3'
              )}
            >
              {item.label}
              {item.count != null && (
                <span
                  className={cn(
                    'ml-2 rounded px-1.5 py-0.5 text-[11px] tabular-nums',
                    selected ? 'bg-primary-50 text-primary-700' : 'bg-surface-sunken text-navy-3'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  activeValue: string;
}

export function TabPanel({ value, activeValue, className, children, ...props }: TabPanelProps) {
  const hidden = value !== activeValue;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={hidden}
      tabIndex={0}
      className={cn('pt-6', className)}
      {...props}
    >
      {!hidden && children}
    </div>
  );
}
