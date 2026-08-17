import React from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * `<h1>` + subtítulo + ações: docs/HANDOFF-FRONTEND.md § FE-05 — mesmo
 * cabeçalho reescrito à mão em ~15 páginas do admin (ex: src/pages/Clients.tsx,
 * src/pages/Inspections.tsx).
 */
export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)} {...props}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {description && <p className="text-sm text-navy-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
