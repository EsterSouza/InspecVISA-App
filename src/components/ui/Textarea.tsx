import React from 'react';
import { cn } from '../../lib/utils';
import { controlClasses, useControlAria } from './Field';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const aria = useControlAria(props);
    return (
      <textarea
        ref={ref}
        className={cn(controlClasses, 'min-h-[80px] resize-y px-3 py-2 leading-normal', className)}
        {...props}
        {...aria}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
