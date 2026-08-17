import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyLinkButtonProps {
  url: string;
  /** Vai no título/aria-label: "Copiar link de X" / "Link copiado para X". */
  label: string;
  /**
   * `full` (padrão) escreve "Copiar link"; `compact` escreve só "Link" — pra caber em linha de
   * lista sem virar ícone mudo. Ícone sozinho, sem nenhuma palavra, não é auto-explicativo: quem
   * olha não sabe se aquilo copia, abre ou compartilha.
   */
  variant?: 'full' | 'compact';
  className?: string;
}

const fullClassName = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-default px-3 text-xs font-semibold text-navy-2 hover:bg-surface-hover hover:text-primary-700';
const compactClassName = 'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-default px-2 text-[11px] font-semibold text-navy-2 hover:bg-surface-hover hover:text-primary-700';

/** Botão de copiar link com feedback local — mesmo padrão usado em `ClientPortalManagement`. */
export function CopyLinkButton({ url, label, variant = 'full', className }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const compact = variant === 'compact';

  const copy = () => {
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? `Link copiado — ${label}` : `Copiar link público (sem senha) — ${label}`}
      aria-label={copied ? `Link copiado — ${label}` : `Copiar link público (sem senha) — ${label}`}
      className={className || (compact ? compactClassName : fullClassName)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : compact ? 'Link' : 'Copiar link'}
      {copied && <span className="sr-only" aria-live="polite">Link copiado</span>}
    </button>
  );
}
