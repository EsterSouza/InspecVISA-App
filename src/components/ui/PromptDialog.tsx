import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field } from './Field';
import { Textarea } from './Textarea';

/**
 * FE-28 — substitui `window.prompt()`. `ConfirmDialog` (FE-15) resolve "confirmar uma ação";
 * este resolve "digitar um texto para uma ação" — o texto costuma ir para o cliente, então tem
 * as mesmas exigências de marca e acessibilidade que a caixa nativa não dá.
 *
 * Uso via `usePromptDialog()`, que devolve um `prompt()` com o mesmo contrato do
 * `window.prompt()` que substitui — `null` resolvido = cancelou:
 *
 *   const { prompt, promptDialog } = usePromptDialog();
 *   ...
 *   const typed = await prompt({ title: '...', fieldLabel: '...', confirmLabel: '...' });
 *   if (typed === null) return;
 *   ...
 *   return <>{...}{promptDialog}</>;
 */

export interface PromptOptions {
  title: string;
  description?: ReactNode;
  fieldLabel: ReactNode;
  /** Aparece junto do campo, antes de qualquer tentativa de confirmar — não é mensagem de erro. */
  hint?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  confirmLabel: string;
  cancelLabel?: string;
  /** `alertdialog` (padrão) para ação que o cliente vê na hora; `dialog` para o resto. */
  role?: 'dialog' | 'alertdialog';
}

interface PromptDialogProps extends PromptOptions {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function PromptDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  description,
  fieldLabel,
  hint,
  placeholder,
  defaultValue = '',
  required = false,
  confirmLabel,
  cancelLabel = 'Cancelar',
  role = 'alertdialog',
}: PromptDialogProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(defaultValue);
    fieldRef.current?.focus();
  }, [isOpen, defaultValue]);

  const canConfirm = !required || value.trim().length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdrop={false}
      role={role}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={() => onConfirm(value.trim())} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-navy-2">
        {description && <div>{description}</div>}
        <Field label={fieldLabel} hint={hint} required={required} optional={!required}>
          <Textarea
            ref={fieldRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
          />
        </Field>
      </div>
    </Modal>
  );
}

interface PendingPrompt extends PromptOptions {
  resolve: (value: string | null) => void;
}

/** Gerencia o estado de um `PromptDialog` compartilhado por todos os pontos de um componente. */
export function usePromptDialog() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  // Estável, mesmo motivo do `useConfirmDialog`: quem chama pode guardar `prompt` em
  // dependência de `useCallback` sem recriar a cada render.
  const prompt = useCallback(
    (options: PromptOptions): Promise<string | null> =>
      new Promise((resolve) => setPending({ ...options, resolve })),
    []
  );

  const settle = (value: string | null) => {
    pending?.resolve(value);
    setPending(null);
  };

  const promptDialog = (
    <PromptDialog
      isOpen={pending !== null}
      title={pending?.title ?? ''}
      description={pending?.description}
      fieldLabel={pending?.fieldLabel ?? ''}
      hint={pending?.hint}
      placeholder={pending?.placeholder}
      defaultValue={pending?.defaultValue}
      required={pending?.required}
      confirmLabel={pending?.confirmLabel ?? 'Confirmar'}
      cancelLabel={pending?.cancelLabel}
      role={pending?.role}
      onCancel={() => settle(null)}
      onConfirm={(value) => settle(value)}
    />
  );

  return { prompt, promptDialog };
}
