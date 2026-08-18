import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { PublicHeader } from './PublicHeader';

/**
 * Largura do que o cliente vê **sem login** — irmã do `PageShell` (1600px, admin).
 * docs/HANDOFF-FRONTEND.md § FE-26: aqui a leitura é em coluna única, então a
 * largura é de leitura, não de painel. 760px é o menor valor em que o calendário
 * de 7 colunas ainda mostra "N vagas" sem abreviar; o texto corrido dentro dela
 * continua limitado a 68ch (decisão 24).
 */
export const PUBLIC_SHELL_MAX = 'max-w-[760px]';

/** Casca das duas superfícies públicas: fundo, marca, coluna de leitura e rodapé. */
export function PublicShell({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader widthClassName={PUBLIC_SHELL_MAX} />
      <main className={cn('mx-auto w-full flex-1 px-4 py-8 pb-16 sm:px-6', PUBLIC_SHELL_MAX, className)} {...props}>
        {children}
      </main>
      <footer className="border-t border-default bg-surface">
        <div className={cn('mx-auto w-full px-4 py-6 sm:px-6', PUBLIC_SHELL_MAX)}>
          <p className="font-title text-sm font-semibold text-navy">InspecVISA · HUB TreinaVISA</p>
          <p className="mt-1 max-w-[68ch] text-sm text-navy-2">
            Esta página é sua e não pede senha. Para ver todas as suas unidades, o plano de ação e
            as entregas em um lugar só, entre no{' '}
            <Link to="/cliente" className="font-semibold text-accent-ink underline underline-offset-2 hover:no-underline">
              Portal do Cliente
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
