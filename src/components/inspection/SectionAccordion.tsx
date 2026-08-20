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
  const pct = totalItems > 0 ? Math.round((evaluatedItems / totalItems) * 100) : 0;

  return (
    // No celular a seção não é cartão: é uma faixa da lista, e o cabeçalho gruda
    // logo abaixo do cabeçalho compacto (46px + 50px). `overflow-hidden` fica só
    // no desktop — num ancestral ele mata o `sticky` do filho.
    <div className="mb-0 overflow-visible border-y border-default bg-surface transition-colors lg:mb-4 lg:overflow-hidden lg:rounded-xl lg:border lg:shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className={cn(
          "sticky top-[97px] z-[2] box-border flex min-h-11 w-full items-center gap-2 border-b border-default bg-surface-sunken px-3 py-2 text-left transition-colors",
          "lg:static lg:min-h-0 lg:justify-between lg:gap-0 lg:border-b-0 lg:p-4 lg:hover:bg-surface-hover",
          isComplete ? "lg:bg-surface-sunken/50" : "lg:bg-surface"
        )}
      >
        <div className="min-w-0 flex-1 lg:pr-4">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "truncate font-title text-xs font-bold lg:font-sans lg:text-lg lg:font-semibold",
              isComplete ? "text-navy-2" : "text-navy"
            )}>
              {title}
            </h3>
            {isComplete && <CheckCircle className="hidden h-5 w-5 shrink-0 text-success lg:block" />}
            {isCritical && !isComplete && <AlertTriangle className="hidden h-4 w-4 shrink-0 text-danger lg:block" />}
          </div>

          {/* Celular: a barra de progresso substitui as três contagens escritas. */}
          <span className="mt-[5px] block h-1 overflow-hidden rounded-full bg-surface lg:hidden">
            <span
              className={cn('block h-full rounded-full', isComplete ? 'bg-success' : 'bg-primary-700')}
              style={{ width: `${pct}%` }}
            />
          </span>

          <div className="mt-1 hidden items-center space-x-3 text-sm text-navy-2 lg:flex">
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

        {/* Celular: contagem avaliada e NC em linha, ao lado do título. */}
        <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-navy-2 lg:hidden">
          {evaluatedItems}/{totalItems} <span className="sr-only">avaliados</span>
        </span>
        <span className={cn(
          'shrink-0 text-[10.5px] font-bold tabular-nums lg:hidden',
          isCritical ? 'text-danger-soft-ink' : 'text-navy-2',
        )}>
          {notCompliesCount} <span className="sr-only">não conformes</span>
          <span aria-hidden="true">NC</span>
        </span>
        <span className="shrink-0 text-navy-2 lg:hidden" aria-hidden="true">
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>

        {/* Expand Icon */}
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-navy-2 lg:flex">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Content */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col bg-surface lg:space-y-6 lg:border-t lg:border-default lg:bg-surface-sunken lg:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
