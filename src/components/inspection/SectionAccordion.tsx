import React from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SectionAccordionProps {
  title: React.ReactNode;
  totalItems: number;
  evaluatedItems: number;
  compliesCount: number;
  notCompliesCount: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  /** Expansão controlada — usada pelo índice de seções da execução (FE-23). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function SectionAccordion({
  title,
  totalItems,
  evaluatedItems,
  compliesCount,
  notCompliesCount,
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
}: SectionAccordionProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolled;
  const setIsExpanded = (next: boolean) => {
    if (expanded === undefined) setUncontrolled(next);
    onExpandedChange?.(next);
  };

  const isComplete = evaluatedItems === totalItems && totalItems > 0;
  const isCritical = notCompliesCount > 0;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-default bg-surface shadow-sm transition-all">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface-hover",
          isComplete ? "bg-surface-sunken/50" : "bg-surface"
        )}
      >
        <div className="flex-1 pr-4">
          <div className="flex items-center space-x-2">
            <h3 className={cn(
              "text-lg font-semibold",
              isComplete ? "text-navy-2" : "text-navy"
            )}>
              {title}
            </h3>
            {isComplete && <CheckCircle className="h-5 w-5 text-success" />}
            {isCritical && !isComplete && <AlertTriangle className="h-4 w-4 text-danger" />}
          </div>
          <div className="mt-1 flex items-center space-x-3 text-sm text-navy-2">
            <span className={isComplete ? "font-medium text-success-soft-ink" : ""}>
              {evaluatedItems} / {totalItems} avaliados
            </span>
            {evaluatedItems > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-navy-3" />
                <span className="font-medium text-success-soft-ink">{compliesCount} conformes</span>
                <span className="h-1 w-1 rounded-full bg-navy-3" />
                <span className={notCompliesCount > 0 ? "font-medium text-danger-soft-ink" : ""}>
                  {notCompliesCount} não conformes
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Expand Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-navy-2">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Content */}
      <div 
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-default bg-surface-sunken p-4 sm:p-6 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
