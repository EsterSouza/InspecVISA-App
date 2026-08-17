import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Papel ARIA do `<dialog>` — `ConfirmDialog` (FE-15) usa `alertdialog`. */
  role?: 'dialog' | 'alertdialog';
  /**
   * Clicar no backdrop fecha por padrão. `ConfirmDialog` desliga isto: em ação
   * sem volta, fechar por engano ao clicar fora é perda de dado (decisão 16).
   */
  closeOnBackdrop?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  role = 'dialog',
  closeOnBackdrop = true,
}: ModalProps) {
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

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // <dialog> dispara "close" tanto no Esc quanto no close() programático —
  // mantém onClose em sincronia quando o navegador fecha por conta própria.
  const handleClose = () => {
    if (isOpen) onClose();
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (closeOnBackdrop && event.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      role={role}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className={cn(
        'w-full max-w-lg overflow-hidden rounded-xl bg-surface p-0 text-navy shadow-2xl',
        'backdrop:bg-black/50',
        'animate-in fade-in zoom-in-95 duration-200',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-default px-6 py-4">
        <div className="text-lg font-semibold text-navy">{title}</div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-navy-3 transition-colors hover:bg-surface-active hover:text-navy-3"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>

      {footer && <div className="border-t border-default bg-surface-sunken px-6 py-4">{footer}</div>}
    </dialog>
  );
}
