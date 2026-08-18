import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

interface PublicHeaderProps {
  /**
   * Largura da faixa interna: a marca alinha com a coluna da página que vem
   * abaixo — 1152px no portal logado, `PUBLIC_SHELL_MAX` nas superfícies sem
   * login. Antes eram 1280px fixos, que não batiam com nenhuma das duas.
   */
  widthClassName?: string;
}

/**
 * Cabeçalho das superfícies sem login e do portal. FE-26: a marca deixou de ser
 * o `<h1>` da página — o `<h1>` é o título da tarefa que a pessoa veio fazer.
 */
export function PublicHeader({ widthClassName = 'max-w-6xl' }: PublicHeaderProps) {
  return (
    <header className="border-b border-default bg-surface">
      <div className={cn('mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6', widthClassName)}>
        <Link
          to="/cliente"
          className="-mx-2 inline-flex min-h-11 items-center gap-3 rounded-md px-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <img src="/logo-claro-192.png" alt="" aria-hidden="true" className="h-9 w-9 rounded-md" />
          <span className="leading-tight">
            <span className="block font-title text-lg font-semibold text-navy">InspecVISA</span>
            <span className="block text-xs font-medium text-navy-2">HUB TreinaVISA</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
