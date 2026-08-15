import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Lado de onde a gaveta desliza. Padrão direita (detalhe, filtro). */
  side?: 'right' | 'left';
  className?: string;
}

/**
 * Gaveta lateral em <dialog> nativo — mesmo padrão de Modal.tsx (trap de
 * foco, Esc e devolução de foco de graça; só escreve fechar-no-backdrop e a
 * trava de rolagem). docs/prototipos/_src/components.css `dialog.drawer`.
 */
export function Drawer({ isOpen, onClose, title, children, footer, side = 'right', className }: DrawerProps) {
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

  const handleClose = () => {
    if (isOpen) onClose();
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className={cn(
        'h-dvh max-h-dvh w-full max-w-[420px] overflow-hidden bg-white p-0 text-gray-900 shadow-2xl',
        'backdrop:bg-navy/50',
        'my-0',
        side === 'right'
          ? 'ml-auto mr-0 border-l border-gray-200 animate-in slide-in-from-right duration-200'
          : 'ml-0 mr-auto border-r border-gray-200 animate-in slide-in-from-left duration-200',
        className
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-none items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0 text-base font-semibold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex-none rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && <div className="flex-none border-t border-gray-200 bg-gray-50 px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}
