import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nome acessível da folha. Aparece escrito só quando `showTitle`. */
  title: string;
  showTitle?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Folha que sobe de baixo — a forma de menu e de escolha no celular.
 *
 * É `<dialog>`, não `<div>` fixo (decisão 37): trap de foco, `Esc` e devolução do
 * foco vêm de graça, e o backdrop nativo fica acima de tudo — inclusive dos
 * cabeçalhos de seção grudentos, que atravessavam um overlay em `z-40`.
 */
export function BottomSheet({ isOpen, onClose, title, showTitle = false, children, className }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!isOpen && dialog.open) {
      dialog.close();
      document.body.style.overflow = 'unset';
    }

    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={() => { if (isOpen) onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      className={cn(
        // `m-0 mt-auto` desfaz o `margin:auto` do user-agent, que centraliza o
        // diálogo: a folha precisa encostar na borda de baixo.
        'm-0 mt-auto max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-[18px] bg-surface p-0 text-navy',
        'backdrop:bg-deep/45',
        className,
      )}
    >
      <div className="px-3 pt-2" style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto mb-3 mt-1.5 h-1 w-[38px] rounded-full bg-default" aria-hidden="true" />
        {showTitle && <h2 className="mb-2.5 px-1 font-title text-xs font-bold text-navy">{title}</h2>}
        {children}
      </div>
    </dialog>
  );
}
