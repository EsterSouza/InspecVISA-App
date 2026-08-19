import { useCallback, useState } from 'react';
import { PromptDialog, type PromptOptions } from './PromptDialog';

/**
 * FE-28 — o estado de um `PromptDialog` compartilhado por todos os pontos de um componente.
 *
 * Vive em arquivo próprio (e não junto do componente, como `useConfirmDialog`) porque
 * `PromptDialog.tsx` tem só dois importadores: separar aqui custou duas linhas de import e
 * devolveu o fast refresh do componente, em vez de mais uma exceção no `eslint.config.js`.
 * É `.tsx` porque o hook monta o próprio diálogo.
 *
 *   const { prompt, promptDialog } = usePromptDialog();
 *   ...
 *   const typed = await prompt({ title: '...', fieldLabel: '...', confirmLabel: '...' });
 *   if (typed === null) return;   // cancelou — mesmo contrato do window.prompt() que substitui
 *   ...
 *   return <>{...}{promptDialog}</>;
 */

interface PendingPrompt extends PromptOptions {
  resolve: (value: string | null) => void;
}

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
