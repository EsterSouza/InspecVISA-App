import React from 'react';
import { cn } from '../../lib/utils';
import { controlClasses, controlSizes, useControlAria, type ControlSize } from './Field';

// `size` nativo do input é largura em caracteres — aqui ele passa a ser a densidade.
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
  /** Ícone à esquerda, dentro do campo (busca, e-mail, telefone). */
  icon?: React.ReactNode;
  /** Layout do invólucro que o ícone cria — largura, `flex-1`, `max-w-*`. */
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, wrapperClassName, size = 'default', ...props }, ref) => {
    const aria = useControlAria(props);
    const input = (
      <input
        type={type}
        ref={ref}
        className={cn(controlClasses, controlSizes[size], icon && 'pl-9', className)}
        {...props}
        {...aria}
      />
    );

    if (!icon) return input;

    return (
      <div className={cn('relative', wrapperClassName)}>
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-3 [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden="true"
        >
          {icon}
        </span>
        {input}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
