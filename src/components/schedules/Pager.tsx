import { Button } from '../ui/Button';

interface PagerProps {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}

export function Pager({ page, totalPages, onChange }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className="text-xs font-semibold text-navy-3" aria-live="polite">
        Página {page} de {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}
