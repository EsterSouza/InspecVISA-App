import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Label } from './Label';

/**
 * Contexto do campo composto. `Input`, `Select`, `Textarea` e `Checkbox` leem daqui
 * o `id`, o `aria-describedby` da ajuda/erro e o `aria-invalid` — assim nenhuma tela
 * precisa repetir a fiação de acessibilidade a cada campo. Prop explícita sempre ganha.
 */
type FieldContextValue = {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return React.useContext(FieldContext);
}

/**
 * Aparência compartilhada por `Input`, `Select` e `Textarea`. Uma cópia só, para que
 * altura, borda, foco, erro e alvo de toque não divirjam entre os três.
 * Decisão 7: 44px no toque também no campo, não só no botão.
 */
export const controlClasses = cn(
  'w-full rounded-md border border-control bg-surface text-sm text-navy transition-colors',
  'placeholder:text-navy-3',
  'enabled:hover:border-navy-3',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-700',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger-soft',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-navy-3',
  'read-only:bg-surface-sunken',
  '[@media(pointer:coarse)]:min-h-11'
);

/**
 * Duas densidades, as mesmas do `Button`: a padrão e a `sm` das listas densas do FE-17.
 * Ter a pequena aqui evita que cada tela densa reinvente altura e `padding` no `className`.
 */
export type ControlSize = 'default' | 'sm';

export const controlSizes: Record<ControlSize, string> = {
  default: 'h-10 px-3 py-2',
  sm: 'h-8 px-2.5 py-1 text-xs',
};

/** Junta o que veio da prop com o que o `Field` fiou — a prop explícita ganha. */
export function useControlAria(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-required'?: React.AriaAttributes['aria-required'];
  required?: boolean;
}) {
  const field = useFieldContext();
  return {
    id: props.id ?? field?.controlId,
    'aria-describedby': props['aria-describedby'] ?? field?.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field?.invalid ? true : undefined),
    // O asterisco do rótulo é `aria-hidden` — sem isto o leitor de tela não teria
    // como saber que o campo é obrigatório.
    'aria-required':
      props['aria-required'] ?? (field?.required && !props.required ? true : undefined),
  };
}

export interface FieldProps {
  label?: React.ReactNode;
  /** Sobrescreve o id gerado — só quando algo de fora precisa apontar para o controle. */
  htmlFor?: string;
  hint?: React.ReactNode;
  /** Texto do erro. Presente = campo inválido; vem sempre com ícone, nunca só a borda. */
  error?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Rótulo + controle + ajuda + erro — o campo composto do Artefato D
 * (`docs/prototipos/_src/pages/fe-04-onda4.html`, seção "Campo de formulário").
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const ctx = React.useMemo<FieldContextValue>(
    () => ({ controlId, describedBy, invalid: Boolean(error), required: Boolean(required) }),
    [controlId, describedBy, error, required]
  );

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      {label && (
        <Label htmlFor={controlId} required={required}>
          {label}
          {optional && <span className="ml-1.5 text-xs font-normal text-navy-3">(opcional)</span>}
        </Label>
      )}
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {hint && (
        <p id={hintId} className="text-xs text-navy-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1 text-xs font-semibold text-danger-soft-ink">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
