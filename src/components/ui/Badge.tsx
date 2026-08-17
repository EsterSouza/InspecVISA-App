import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary-100 text-primary-800',
    success: 'bg-success-soft text-success-soft-ink',
    warning: 'bg-amber-soft text-amber-soft-ink',
    danger: 'bg-danger-soft text-danger-soft-ink',
    neutral: 'bg-surface-sunken text-navy',
    outline: 'border border-control text-navy',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
