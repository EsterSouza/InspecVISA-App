---
name: reactbits
description: Nossa cópia completa e local dos 166 componentes do React Bits — código-fonte, índice por categoria e a dependência de cada um. Use para qualquer efeito visual, animação, fundo animado, tipografia animada, carrossel, dock, passo a passo ou interação de cursor, em qualquer produto nosso (InspecVISA, portal, landing pages da TreinaVISA e produtos futuros). Consultar SEMPRE esta pasta, nunca o site nem o MCP deles.
---

# React Bits — biblioteca local completa

**166 componentes, 315 arquivos, 6,6 MB, tudo em disco.** Não precisa abrir o site
nem chamar MCP nenhum: o código está aqui.

```
.claude/skills/reactbits/componentes/
  INDICE.md          ← comece aqui: tabela por categoria com tamanho e dependência
  LICENCA.md         ← MIT + Commons Clause
  Animacoes/         37
  Componentes/       45
  Fundos/            51
  Texto-animado/     33
```

**Como achar:** abra `componentes/INDICE.md`. Ele tem, por categoria, uma tabela com
componente, arquivos, tamanho e **de qual pacote depende**. Depois leia direto
`componentes/<Categoria>/<Nome>/<Nome>.jsx`.

**Como atualizar:** `node scripts/biblioteca/coletar-reactbits.mjs`
(retomável, pula o que já existe; `--forcar` rebaixa tudo). Ele regera o índice e as
dependências a partir dos imports reais, não de suposição.

## Licença

**MIT + Commons Clause — livre para uso pessoal e comercial.** Podemos usar em produto
nosso e em cliente. O Commons Clause proíbe **revender a coleção como produto** — ou seja,
não montar e vender "um pacote de componentes". Manter o aviso de copyright ao
redistribuir. Texto completo em `componentes/LICENCA.md`.

## A informação que decide tudo: dependência

O nosso app **não tem nenhuma** biblioteca de animação instalada. Por isso o índice
separa primeiro os que entram sem somar nada ao bundle.

**39 componentes só com React e CSS** — os únicos que entram em qualquer lugar sem discussão:

`BorderGlow` · `ClickSpark` · `CursorGrid` · `CurvedInput` · `CurvedLoop` · `DepthText` ·
`DotField` · `DriftWall` · `EchoText` · `ElectricBorder` · `Folder` · `FuzzyText` ·
`GlareHover` · `GlassIcons` · `GlassSurface` · `GlitchText` · `GooeyNav` · `GradualBlur` ·
`LetterGlitch` · `Lightning` · `LineSidebar` · `LogoLoop` · `Magnet` · `MagnetLines` ·
`MetallicPaint` · `Noise` · `OptionWheel` · `ParticleText` · `PixelCard` · `PixelSwap` ·
`ProfileCard` · `ScrollExpand` · `ShapeGrid` · `SplashCursor` · `SplitFlapText` ·
`SpotlightCard` · `StarBorder` · `TextPressure` · `Waves`

O resto puxa: `ogl` (45), `gsap` (35), `three` (23), `motion` (20), `@react-three/fiber` (8),
`@react-three/drei` (5), e uma cauda de pacotes com 1 a 4 usos cada. Tabela completa no índice.

## Onde usar

- **Landing pages e páginas de produto da TreinaVISA** — é para isso que a coleção existe.
  Fundo animado, tipografia cinética, cartão com brilho: chamar atenção é a função da página.
  Aqui a coleção inteira está disponível.
- **InspecVISA e portal do cliente** — o Manual de Marca 2.0 proíbe glassmorphism e
  "aparência genérica de IA", e a consultora fica horas lendo item de checklist. Na prática
  sobra pouco: `Stepper` (o wizard de `NewInspection` nunca foi desenhado), `FadeContent` e
  `AnimatedContent`. Não é regra, é o que costuma sobreviver à revisão.
- **Um alerta do próprio React Bits:** *"Using more than 2-3 components on a page is not
  advised"* — mais que isso pesa e atrapalha.

## Regras de uso, valem sempre

1. **Não colar cor literal.** Reescrever com os tokens de `design-inspecvisa`: cor, raio
   (`--radius-sm/md/lg`), duração (`--dur-1/2/3`) e curva (`--ease-*`) saem de lá.
2. **Toda animação dentro de `@media (prefers-reduced-motion: reduce)`.**
3. **Conferir contraste depois** — muitos pressupõem fundo escuro.
4. **Medir o bundle antes e depois** com `npm run build`, sempre que o componente trouxer
   dependência nova.
5. Componente com `three`/`ogl` desenha em WebGL: conferir no celular antes de subir, e ter
   um estado estático de reserva.

## Relacionados

- `design-inspecvisa` — os tokens e as regras que qualquer componente copiado tem que obedecer.
- `catalogo-designmd` — para **padrão** de componente (comportamento de teclado, variantes,
  *don'ts*), a fonte é o DesignMD. O React Bits é efeito visual, não especificação de UX.
- `biblioteca-design` — a coleção de sistemas de design (paletas e tipografia) para landing pages.
