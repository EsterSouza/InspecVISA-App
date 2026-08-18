import { cva } from 'class-variance-authority';

/**
 * Aparência do `Button` em um módulo próprio: o `<Link>` do react-router não
 * pode ser embrulhado no primitivo (ele não é `<button>`), mas precisa da mesma
 * pele — e o lint de fast-refresh não deixa o componente exportar constante.
 */
export const buttonVariants = cva(
  // Decisão 7: botão pequeno também tem 44px no toque. Em ponteiro grosso (dedo)
  // a altura mínima sobe, sem mudar nada no desktop.
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11',
  {
    variants: {
      variant: {
        default: 'bg-primary-700 text-white hover:bg-primary-800 shadow-sm',
        secondary: 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200',
        outline: 'border border-control bg-transparent hover:bg-surface-hover text-navy-2',
        ghost: 'hover:bg-surface-active hover:text-navy',
        danger: 'bg-danger text-white hover:bg-danger-hover shadow-sm',
        success: 'bg-success text-white hover:bg-success-soft-ink shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false,
    },
  }
);

