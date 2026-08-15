import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Largura única do admin: docs/HANDOFF-FRONTEND.md § FE-05 — substitui os
 * `mx-auto max-w-3xl|4xl|5xl|6xl|7xl` reescritos à mão em ~15 páginas.
 */
export const PageShell = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8', className)} {...props} />
  )
);
PageShell.displayName = 'PageShell';
