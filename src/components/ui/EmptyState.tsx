import React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
      {...props}
    >
      {icon && <div className="text-navy-3">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-navy">{title}</p>
        {description && <p className="text-sm text-navy-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}
