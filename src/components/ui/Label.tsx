import React from 'react';
import { cn } from '../../lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    // Artefato D: rótulo é `--ink` semibold; o asterisco de obrigatório usa a tinta
    // escura do vermelho (`--danger-soft-ink`), que passa AA sobre a superfície clara.
    <label ref={ref} className={cn('block text-sm font-semibold text-navy', className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-danger-soft-ink" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
);
Label.displayName = 'Label';

export { Label };
