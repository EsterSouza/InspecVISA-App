import React from 'react';
import { cn } from '../../lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label ref={ref} className={cn('block text-sm font-medium text-navy-2', className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
  )
);
Label.displayName = 'Label';

export { Label };
