import React from 'react';
import { cn } from '../../lib/utils';
import { useControlAria } from './Field';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Texto ao lado da caixa. Sem ele sai só o controle — aí o `aria-label` é obrigatório. */
  label?: React.ReactNode;
  /** Linha de apoio abaixo do rótulo. */
  hint?: React.ReactNode;
  /** Classe da caixa em si, quando há rótulo (a `className` vai para o invólucro). */
  boxClassName?: string;
}

const boxBase = cn(
  'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary-700',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
  'disabled:cursor-not-allowed'
);

/** Só as props: a `ref` fica no JSX de quem monta o `<input>` — passá-la para uma função
 *  durante o render é o que a regra `react-hooks/refs` proíbe, e com razão: de fora não dá
 *  para saber se a função lê `.current`. */
function controlProps(
  type: 'checkbox' | 'radio',
  className: string | undefined,
  aria: ReturnType<typeof useControlAria>,
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return { type, className: cn(boxBase, className), ...props, ...aria };
}

/** Alvo de toque de 44px: quem recebe o clique é o rótulo inteiro. */
const wrapper = cn(
  'flex cursor-pointer items-start gap-2 text-sm text-navy',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:text-navy-3',
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:items-center'
);

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, boxClassName, ...props }, ref) => {
    const aria = useControlAria(props);
    if (!label) return <input ref={ref} {...controlProps('checkbox', className, aria, props)} />;
    return (
      <label className={cn(wrapper, className)}>
        <input ref={ref} {...controlProps('checkbox', boxClassName, aria, props)} />
        <span className="min-w-0">
          {label}
          {hint && <span className="mt-0.5 block text-xs text-navy-2">{hint}</span>}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

const Radio = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, boxClassName, ...props }, ref) => {
    const aria = useControlAria(props);
    if (!label) return <input ref={ref} {...controlProps('radio', className, aria, props)} />;
    return (
      <label className={cn(wrapper, className)}>
        <input ref={ref} {...controlProps('radio', boxClassName, aria, props)} />
        <span className="min-w-0">
          {label}
          {hint && <span className="mt-0.5 block text-xs text-navy-2">{hint}</span>}
        </span>
      </label>
    );
  }
);
Radio.displayName = 'Radio';

export { Checkbox, Radio };
