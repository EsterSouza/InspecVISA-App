import React from 'react';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number; // 0 to 100
  colorClass?: string;
  className?: string;
  heightClass?: string;
}

export function ProgressBar({ value, colorClass = 'bg-primary-500', className, heightClass = 'h-2' }: ProgressBarProps) {
  const safeValue = Math.min(Math.max(value, 0), 100);
  
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-surface-sunken", heightClass, className)}>
      <div
        className={cn("h-full transition-[width] duration-500 ease-out", colorClass)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
