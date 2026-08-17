import React from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Tabela densa com cabeçalho fixo: docs/prototipos/_src/components.css
 * `.table-wrap` / `.table` / `.th-sort`. Composição, não data-table
 * genérico — cada tela monta as próprias colunas, como Card/Modal.
 */
export const TableContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-hidden rounded-lg border border-default bg-surface', className)} {...props}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
);
TableContainer.displayName = 'TableContainer';

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn('w-full border-collapse text-sm', className)} {...props} />
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />
);
TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  /** Linha de agrupamento (ex: plano de ação por unidade): fundo sólido, fica presa logo abaixo do cabeçalho. */
  group?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected, group, ...props }, ref) => (
    <tr
      ref={ref}
      aria-selected={selected || undefined}
      className={cn(
        'border-b border-default last:border-0 transition-colors',
        group
          ? 'sticky top-[38px] z-[5] bg-surface-sunken font-title text-xs font-bold text-navy'
          : 'hover:bg-surface-hover',
        selected && !group && 'bg-primary-50',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right';
  /** Presente só na coluna ordenada; 'none' também aciona o th-sort, sem seta visível. */
  sortDirection?: 'ascending' | 'descending' | 'none';
  onSort?: () => void;
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, align = 'left', sortDirection, onSort, children, ...props }, ref) => {
    const isSorted = sortDirection === 'ascending' || sortDirection === 'descending';
    return (
      <th
        ref={ref}
        scope="col"
        aria-sort={isSorted ? sortDirection : undefined}
        className={cn(
          'sticky top-0 z-10 h-[38px] whitespace-nowrap border-b border-default bg-surface-sunken px-4 text-left text-xs font-semibold text-navy-3',
          align === 'right' && 'text-right',
          className
        )}
        {...props}
      >
        {onSort ? (
          <button
            type="button"
            onClick={onSort}
            className={cn(
              'inline-flex items-center gap-1 bg-transparent p-0 text-xs font-semibold text-inherit transition-colors hover:text-navy',
              isSorted && 'text-primary-700 hover:text-primary-700',
              align === 'right' && 'flex-row-reverse'
            )}
          >
            {children}
            <ArrowUp
              className={cn(
                'h-3 w-3 shrink-0 transition-transform duration-150',
                sortDirection === 'descending' && 'rotate-180',
                !isSorted && 'opacity-0'
              )}
              aria-hidden="true"
            />
          </button>
        ) : (
          children
        )}
      </th>
    );
  }
);
TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right';
  primary?: boolean;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = 'left', primary, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'h-11 px-4 align-middle text-navy-2',
        align === 'right' && 'text-right tabular-nums',
        primary && 'font-semibold text-navy',
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';
