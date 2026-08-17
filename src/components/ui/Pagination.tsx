import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  /** Página atual, base 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Quando informados junto de pageSize, mostra "1–20 de 134" à esquerda. */
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

function getPageList(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const keep = new Set<number>([1, 2, pageCount - 1, pageCount, page - 1, page, page + 1]);
  const sorted = Array.from(keep)
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}

/**
 * Paginação: docs/prototipos/_src/components.css `.pagination` / `.page-btn`.
 * Some sozinha com uma página só (nada a paginar).
 */
export function Pagination({ page, pageCount, onPageChange, totalItems, pageSize, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = getPageList(page, pageCount);
  const rangeLabel =
    totalItems != null && pageSize
      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)} de ${totalItems}`
      : null;

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-default bg-surface px-4 py-2 text-sm text-navy-3',
        className
      )}
    >
      <p className={cn(!rangeLabel && 'sr-only')}>{rangeLabel}</p>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="flex h-[30px] w-[30px] items-center justify-center rounded text-navy-3 transition-colors hover:bg-surface-active hover:text-navy disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, index) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-navy-3">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                'h-[30px] min-w-[30px] rounded px-2 text-sm font-semibold tabular-nums transition-colors',
                p === page ? 'bg-primary-700 text-white' : 'text-navy-3 hover:bg-surface-active hover:text-navy'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Próxima página"
          className="flex h-[30px] w-[30px] items-center justify-center rounded text-navy-3 transition-colors hover:bg-surface-active hover:text-navy disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
