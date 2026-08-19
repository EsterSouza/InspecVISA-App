import React from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<Record<string, unknown>>;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
};

/**
 * Dica curta em texto, nunca só ícone: docs/prototipos/_src/components.css
 * `.tip` / `.tip--right`. Aparece no hover E no foco (teclado), some quando
 * nenhum dos dois está ativo — sem JS de posicionamento, só CSS.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const id = React.useId();

  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-inverse px-2 py-1 text-xs font-medium text-inverse-ink opacity-0 shadow-md transition-opacity duration-150',
          'group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
          SIDE_CLASSES[side]
        )}
      >
        {content}
      </span>
    </span>
  );
}
