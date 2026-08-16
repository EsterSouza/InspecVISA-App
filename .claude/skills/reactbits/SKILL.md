---
name: reactbits
description: O que é o React Bits (reactbits.dev), o que dele serve e o que NÃO serve para o InspecVISA, com a lista curta do que vale copiar e o custo de dependência de cada um. Use quando alguém propuser usar React Bits, quando faltar um componente que o nosso sistema não tem (passo a passo, carrossel, dock), ou quando for desenhar página pública de marketing da TreinaVISA.
---

# React Bits — o que serve e o que não serve

`https://reactbits.dev` · aberto, código copiável, você fica dono do código.
Não é biblioteca NPM: copia-se o componente para dentro do projeto.

## O veredito, primeiro

**A maior parte do React Bits não serve para o InspecVISA**, e não é por preconceito —
é o que o próprio projeto diz de si: *"This is not your typical component library, which
means you won't find a set of generic buttons, inputs, or other common UI elements here…
these components are here to help you stand out and make a statement visually."*

São ~150 componentes, e o inventário é: 30 animações de texto (Glitch Text, Scrambled
Text, Falling Text), 40 fundos animados (Aurora, Plasma, Galaxy, Liquid Chrome, Dither) e
uma leva de efeitos de cursor e cartões com brilho (Splash Cursor, Magic Bento, Spotlight
Card, Fluid Glass, Glass Surface, Metallic Paint).

Isso colide de frente com três coisas nossas:

1. **O Manual de Marca 2.0 proíbe** glassmorphism, ícone decorativo repetido,
   arredondamento excessivo e "aparência genérica de IA". Fluid Glass, Glass Surface,
   Glass Icons, Magic Bento e a maior parte dos fundos caem exatamente aí.
2. **O InspecVISA é ferramenta de trabalho.** A consultora fica horas na mesma tela
   lendo item de checklist. Fundo animado e texto que se remonta competem com o dado.
3. **O padrão `stats-cards` do catálogo é explícito:** *"Don't animate the primary number
   counting up on load; it looks flashy but slows comprehension and annoys on repeat
   visits."* Ou seja, `Count Up` e `Counter` estão fora dos nossos indicadores.

O próprio React Bits avisa: *"Using more than 2-3 components on a page is not advised."*

## Custo de dependência — pesar sempre antes

O app **não tem** `framer-motion`, `gsap`, `three`, `@react-three/*` nem `ogl` hoje
(conferido no `package.json`). Boa parte dos componentes do React Bits depende de um
desses. Copiar um componente pode significar adicionar uma biblioteca de animação
inteira ao bundle de um app que a consultora abre em campo, muitas vezes em 4G.

**Regra:** só entra componente que (a) resolva um problema que já temos, e (b) não traga
dependência nova — ou cuja dependência valha por si.

## A lista curta — o que de fato vale olhar

| Componente | Para quê aqui | Situação |
|---|---|---|
| **Stepper** | `NewInspection` é um wizard e **nunca foi desenhado** (consta na auditoria da Onda 4). É o único caso em que temos a necessidade e não temos o componente | **Candidato real.** Usar como referência de estrutura e reescrever com os nossos tokens — depende de `framer-motion`, que não temos |
| **Animated List** | entrada suave de item em lista longa | Marginal: os nossos tokens de motion (`--dur-*`, `--ease-*`) com `prefers-reduced-motion` já cobrem, sem dependência |
| **Fade Content** / **Animated Content** | revelar bloco ao entrar na viewport | Marginal, mesmo motivo. `IntersectionObserver` + uma transição resolve |
| **Dock** / **Card Nav** / **Pill Nav** | navegação | **Não.** Já temos rail + drawer decididos e implementados (FE-06) |
| **Counter** / **Count Up** | indicadores | **Não** — contraria o padrão `stats-cards` |
| Fundos, textos animados, efeitos de cursor, tudo com "Glass" no nome | — | **Não** no produto |

## Onde o React Bits *poderia* caber de verdade

Não no admin nem no portal: numa **página pública de marketing da TreinaVISA** — venda
de curso, captação, lançamento. Ali o objetivo é chamar atenção, não sustentar leitura
longa, e um fundo animado discreto tem função. Se esse projeto existir, esta skill vira
útil de fato; até lá, o uso no InspecVISA é praticamente nulo.

## Como usar, se for usar

1. Escolher o componente e abrir a página dele: `https://reactbits.dev/components/<slug>`.
   A página tem "Copy for AI" e alternador JS/TS e CSS/Tailwind.
2. **Não colar direto.** Reescrever com os nossos tokens (`design-inspecvisa`): nada de
   cor literal, raio dentro da escala (`--radius-sm/md/lg`), duração e curva dos nossos.
3. Envolver toda animação em `@media (prefers-reduced-motion: reduce)`.
4. Conferir contraste depois — muitos deles pressupõem fundo escuro.
5. Rodar `npm run build` completo e conferir o tamanho do bundle antes e depois.

## Relacionados

- `design-inspecvisa` — os tokens e as regras que qualquer componente copiado tem que obedecer.
- `catalogo-designmd` — para padrão de componente, o DesignMD é a fonte, não o React Bits:
  ele traz comportamento de teclado, variantes e *don'ts*, que é o que falta no React Bits.
