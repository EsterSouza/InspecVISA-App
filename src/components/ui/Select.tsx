import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { controlClasses, controlSizes, useControlAria, type ControlSize } from './Field';

// `size` nativo do select é o número de linhas visíveis — aqui ele passa a ser a densidade.
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  /** Layout do invólucro que a seta cria — largura, `flex-1`, `max-w-*`. */
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, wrapperClassName, size = 'default', ...props }, ref) => {
    const aria = useControlAria(props);
    return (
      <div className={cn('relative', wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            controlClasses,
            controlSizes[size],
            'appearance-none',
            size === 'sm' ? 'pr-7' : 'pr-9',
            className
          )}
          {...props}
          {...aria}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-navy-3',
            size === 'sm' ? 'right-2' : 'right-3'
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
