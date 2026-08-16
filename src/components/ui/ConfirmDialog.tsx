import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

/**
 * FE-15 — substitui `window.confirm()`. Três regras que o nativo não dá
 * (decisão 16, `docs/HANDOFF-FRONTEND.md`): foco abre no Cancelar, nunca no
 * botão que destrói; clicar fora não fecha, porque em ação sem volta fechar
 * por engano é perda de dado; e o rótulo do botão diz a ação ("Excluir
 * solicitação", nunca "OK"). Três variantes: simples, com lista de
 * consequências, e com digitação da palavra para a ação catastrófica.
 *
 * Uso normal é via `useConfirmDialog()`, que devolve um `confirm()` que se
 * comporta como o `window.confirm()` que substitui — só que assíncrono:
 *
 *   const { confirm, confirmDialog } = useConfirmDialog();
 *   ...
 *   async function excluir() {
 *     const ok = await confirm({ title: '...', confirmLabel: 'Excluir item' });
 *     if (!ok) return;
 *     ...
 *   }
 *   return <>{...}{confirmDialog}</>;
 */

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Cor do botão de confirmar. `danger` (padrão) para ações destrutivas. */
  tone?: 'danger' | 'default';
  /** Variante "com lista de consequências". */
  consequences?: string[];
  /** Variante "com digitação": a consultora precisa digitar esta palavra pra habilitar o botão. */
  confirmWord?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  consequences,
  confirmWord,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTyped('');
    // O `showModal()` do Modal.tsx roda antes deste efeito (efeito de filho
    // dispara antes do de pai) e foca o primeiro elemento focável por conta
    // própria — este efeito devolve o foco pro Cancelar em seguida.
    cancelRef.current?.focus();
  }, [isOpen]);

  const needsTyping = Boolean(confirmWord);
  const canConfirm = !needsTyping || typed.trim() === confirmWord;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdrop={false}
      role="alertdialog"
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'default'}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        {description && <div>{description}</div>}

        {consequences && consequences.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            {consequences.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}

        {needsTyping && (
          <div className="pt-1">
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Digite <span className="font-mono font-bold text-gray-900">{confirmWord}</span> para confirmar
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Gerencia o estado de um `ConfirmDialog` compartilhado por todos os pontos de confirmação de um componente. */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> =>
    new Promise((resolve) => setPending({ ...options, resolve }));

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const confirmDialog = (
    <ConfirmDialog
      isOpen={pending !== null}
      title={pending?.title ?? ''}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel ?? 'Confirmar'}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      consequences={pending?.consequences}
      confirmWord={pending?.confirmWord}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, confirmDialog };
}
