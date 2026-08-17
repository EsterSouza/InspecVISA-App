---
name: design-inspecvisa
description: O sistema de design do InspecVISA e do Portal TreinaVISA — tokens, primitivos, regras do Manual de Marca 2.0 e as decisões já tomadas. Use SEMPRE que for desenhar, redesenhar ou implementar qualquer tela, componente ou estado visual deste produto (admin ou portal), inclusive protótipo em HTML. Também para revisar contraste, densidade, cor, tipografia e microcopy. Evita reabrir decisão já fechada e evita reler o HANDOFF-FRONTEND.md inteiro.
---

# Sistema de design do InspecVISA

Antes de desenhar qualquer coisa neste repositório, leia este arquivo. Ele existe para
duas coisas: **não reabrir decisão já tomada** e **não reler 500 linhas de handoff**
para descobrir a cor de um badge.

## Regra de ouro

**O que o protótipo já resolveu não é mais decisão.** Os quatro artefatos em
`docs/prototipos/` são a fonte. Se a tela já está desenhada lá, é implementação —
não abra o MCP do DesignMD, não peça opinião, aplique.

| Artefato | Arquivo | O que tem |
|---|---|---|
| A · Fundação | `_src/pages/fe-01-fundacao.html` | os 16 componentes com todos os estados, tokens, medidor de contraste ao vivo, microcopy |
| B · Admin | `_src/pages/fe-02-admin.html` | Painel, Clientes, ficha com abas, Plano de ação, Agendamentos, Execução da inspeção |
| C · Portal | `_src/pages/fe-03-portal.html` | as 6 seções do portal, 1 unidade × 13 unidades |
| D · Onda 4 | `_src/pages/fe-04-onda4.html` | diagnóstico, Início unificado, Solicitações, Roteiros, Biblioteca, Sincronização, Configurações, padrões que faltam, de-para de cor, plano FE-14+ |
| E · Fluxo de inspeção | `_src/pages/fe-05-inspecao.html` | `/new`, execução em 3 colunas, **encerramento** (etapa nova), `/summary`, estados e 375px, a nota fora da paleta, decisões 23–33 · **implementado (FE-23)** |

**Editar só em `_src/`.** Montar com `node docs/prototipos/build.mjs`. Os `.html` da
raiz e de `_publish/` são gerados — o build sobrescreve.
Ver no navegador: `.claude/launch.json` → `prototipos`, porta 5177.

## Tokens

Fonte única: `docs/prototipos/_src/tokens.css` (claro) e `tokens-dark.css` (escuro).
No app React, os mesmos valores estão em `tailwind.config.js`.

| Papel | Token | Valor |
|---|---|---|
| Texto, título, estrutura | `--ink` | `#0B1F3A` navy institucional |
| Apoio, legenda de coluna | `--ink-2` | `#41556F` |
| Metadado e placeholder | `--ink-3` | `#54657B` — **o tom mais claro que existe** |
| Ação principal | `--accent` | `#244A9B` azul TreinaVISA |
| Link em fundo claro | `--accent-ink` | `#1D3D80` |
| Fundo de leitura, item ativo | `--accent-soft` | `#EAF3FC` |
| Teal operacional (ação de sistema) | `--teal` | `#0F6B78` |
| Atenção e prazo | `--amber` | `#D99721` |
| Ícone/indicador âmbar pequeno | `--amber-strong` | `#AE7714` |
| Divisória decorativa | `--border` | `#CBD9EA` |
| Borda de campo (3:1 obrigatório) | `--border-control` | `#7688A2` |

Tipografia: **Sora 500** em título, **Source Sans 3 400/500** em leitura.
Nos protótipos vão embutidas em base64 pelo `build.mjs` (o artefato publicado bloqueia
host externo por CSP). `Source Sans 3` **precisa de aspas** no `fontFamily` do Tailwind —
sem aspas o `3` isolado é CSS inválido e a declaração inteira é descartada.

## Restrições que vêm do Manual de Marca 2.0

O manual "experimental v1.0" está **abolido**. Não citar.

1. **Âmbar é semântico, nunca CTA principal.** Botão de ação continua azul.
2. **Nenhuma informação depende só da cor.** Badge de estado carrega rótulo ou ícone;
   estado de compromisso vai em três canais (cor, forma da borda, palavra).
3. Verde = sucesso, vermelho = erro.
4. **Proibido:** arredondamento excessivo, ícone decorativo repetido, glassmorphism,
   aparência genérica de IA, monoespaçada só para "parecer técnica".
5. Contraste WCAG AA: 4,5:1 texto comum, 3:1 texto grande e borda de controle.
6. Claro e escuro são **um sistema só**.
7. Grafias: TreinaVISA, HUB TreinaVISA, InspecVISA. Nunca "Treina Visa"/"Treinavisa".

## Decisões já tomadas — não reabrir

1. **Navy é texto e estrutura, não bloco de cor.** Sidebar clara (`--surface-sunken`)
   com texto navy, não barra escura.
2. **Duas bordas.** `--border` é decorativa; `--border-control` delimita campo e precisa de 3:1.
3. **Âmbar tem dois tons.** `#D99721` só em preenchimento grande; ícone pequeno usa `--amber-strong`.
4. **Não existe cinza claro de texto.** O menor tom é `--ink-3`, placeholder inclusive.
5. **A largura é uma só:** `--shell-max: 1600px` → `PageShell` no app.
6. **Erro não some sozinho.** Sucesso 4s, atenção 6s, erro só no clique; timer pausa no hover.
7. **Botão pequeno também tem 44px no toque** (`@media (pointer: coarse)`). No app isso mora no
   próprio `Button` (`[@media(pointer:coarse)]:min-h-11`); controle fora do primitivo precisa da
   regra escrita à mão — foi o que faltava no link da norma e no botão de ditado até o FE-23.
8. No portal, acima de 6 unidades no celular os chips viram `<select>`.
9. "Todas as unidades" mostra amostra de 3 por grupo, não tudo.
10. Plano de ação: lista + detalhe, com `situation` e `recommended_action` inteiros.
11. **Toda rota tem identidade própria**, inclusive as não desenhadas.
12. **Um calendário só** (`WeekCalendar`) para portal e admin.
13. Calendário é opção, não substituição: toda agenda mantém Semana / Lista.
14. Régua do calendário 09h–17h, seg a sex; a régua **cresce**, nunca corta.
15. **Início absorve o Painel** (16/08/2026). `/painel` redireciona para `/`. A análise
    desce para a faixa "Desempenho", recolhida.
16. **Diálogo de confirmação:** `role="alertdialog"`, foco abre no **Cancelar**,
    clicar fora **não** fecha, e o rótulo do botão diz a ação ("Excluir solicitação",
    nunca "OK"). Ação catastrófica exige digitar a palavra.
17. **Lista densa:** duas ações cabem na linha; da terceira em diante vão para o menu ⋮,
    com a destrutiva no fim, separada por divisória.
18. **Vazio de filtro ≠ vazio de primeira vez.** Vazio de filtro oferece "limpar filtros"
    e **não** oferece criar — o dado existe, só está escondido.
19. **Configurações salva por seção**, nunca um botão único no fim da página.
20. **A aba ativa entra na URL** (`?aba=arquivos`) — deep link e botão de voltar.

Do Artefato E, **aprovadas pela Ester e implementadas no FE-23 em 16/08/2026**:

23. **A execução não é assistente.** Acordeão por seção, resposta fora de ordem, índice em coluna
    própria. Os quatro resultados são CUMPRE · NÃO CUMPRE · N/A · NO. **"Parcial" não existe.**
24. **A largura não tem exceção**: `InspectionExecution` passa a `--shell-max`; quem limita a
    leitura é a coluna do meio (`68ch`), não a página.
25. **Encerrar e entregar é etapa com nome próprio**, listando os quatro efeitos antes do clique.
26. **A entrega tem recibo permanente** no relatório — aviso passageiro não conta.
27. **Quatro classificações, três cores.** Sem lima; bom e excelente compartilham o verde.
    Os tons de **preenchimento** (`classificationColor`) e os de **texto** (`classificationInk`)
    são diferentes: branco sobre `--amber` dá 2,50:1 e reprova AA. Número, rótulo e selo usam a
    tinta escura; barra e ponto usam o preenchimento.
28. **Controle fixo no celular é rodapé, nunca sobreposição.**
29. **A nota compara com a visita anterior** — em **pontos**, não em %; área contra a mesma área;
    a linha some quando não há visita anterior ou o roteiro mudou.
30. **"Falta escrever" é lista clicável**, não contagem: qual item e qual campo falta.
31. **Sem assinatura do acompanhante no encerramento** — o relatório é fechado em casa. Fica nome
    e função; a assinatura da consultora no `PdfPreviewModal` **não muda**.
32. **Sem vínculo não se encerra** — e o vínculo que conta é a **solicitação apontando para a
    inspeção** (`appointment_requests.inspection_id`), não o agendamento. Três estados, porque
    vincular offline não escreve nada e a agenda mostra verde. "Só gerar o PDF" nunca é bloqueado.
33. **Prazo é só a lista**, com **"Sem prazo definido"** dentro dela — e "sem prazo" é estado
    próprio (selo), nunca ausência silenciosa.
34. **Reincidência não reinicia o prazo** (17/08, usando o fluxo em campo). A data pactuada na
    primeira visita continua valendo; escolher "60 dias" de novo não empurra o vencimento para
    frente. Ela volta a ser negociável quando **vence, ou está a 7 dias de vencer** — aí a
    escolha desta visita passa a valer, inclusive "sem prazo". **Encurtar sempre vale.** A regra
    vive nos dois lados: `resolveRecurringDueDate` (para a tela dizer qual data vale **antes** de
    publicar) e o `on conflict` de `admin_publish_client_action_items` (para nenhum outro caminho
    de publicação reiniciar o relógio em silêncio).

## Duas coisas que a verificação por DOM não pega

Aprendido em 17/08, com quatro defeitos que só apareceram usando o fluxo:

- **Estado derivado que ignora o clique.** `isOpen = filtroLigado || abertas.has(id)` fazia o
  cabeçalho do acordeão não ter efeito nenhum com filtro ligado. Medir a tela parada não
  encontra isso: só clicar duas vezes no mesmo lugar encontra.
- **Efeito que semeia estado sem trava.** Semear "a primeira seção nasce aberta" com dependência
  num `useMemo` que recalcula a cada resposta reabre o que a pessoa acabou de recolher. Semeadura
  é uma vez: `useRef`, não `prev.size === 0`.
- E o item **não pode sumir sob o cursor**: quando terminar de escrever tira o item do filtro,
  ele fica até a pessoa recolher o painel ou trocar de filtro.

## Armadilhas de CSS que já custaram tempo

- **`grid-template-columns: 1fr` é `minmax(auto, 1fr)`.** Com tabela dentro, a coluna não
  encolhe e a página rola de lado no celular. Precisa de `minmax(0, 1fr)` **e** de
  `min-width: 0` no item — as duas coisas.
- **`<dialog>` nativo** já dá trap de foco, `Esc` e devolução do foco. Falta só escrever
  fechar-no-backdrop e trava de rolagem.
- **CSS Grid com posição explícita:** div de fundo sem `gridRow` explícito é reposicionada
  pela auto-colocação quando há item com posição explícita — foi o bug das linhas fantasma
  no `WeekCalendar`.
- **`lucide-react` marca o SVG como `aria-hidden`:** link que vira só ícone fica sem nome
  acessível. Precisa de `aria-label` no link — `Tooltip` é `aria-describedby` e não substitui.

## Como verificar antes de fechar

1. `npm run build` completo. **`tsc --noEmit` limpo não basta** — o Vercel já quebrou assim.
2. `npm run test` (nunca `npx vitest run` cru: o script passa `NODE_OPTIONS` que o npx não herda).
3. No navegador: sem rolagem lateral em **1600, 1280 e 375px**; menor alvo de toque 44px;
   teclado (setas, `Home`/`End`, `Esc`) nos componentes com foco gerenciado.
4. Contraste: o Artefato A mede os pares ao vivo a partir dos tokens vigentes. Em protótipo
   novo, `window.contraste('--ink','--surface')` está exposto pelo `shell.js`.

## Que card já saiu?

**Não deduzir do código nem perguntar.** A tabela **"Onde estamos"**, no topo de
`docs/HANDOFF-FRONTEND.md`, é a única fonte: card entregue tem o título ~~riscado~~ com data e
commit, card aberto tem ⬜. Em 16/08/2026: 18 entregues, 10 na fila (FE-19, FE-20, FE-23, FE-24,
FE-21, FE-22, FE-25, FE-26, FE-12, FE-27 — nessa ordem).

**Ao fechar um card, atualizar no mesmo commit:** a tabela "Onde estamos" (riscar o título do card
e tirá-lo da fila), o "Registro de execução" do handoff, e a linha da rota em
`docs/mapa-paginas-admin.md` se o que a tela faz mudou.

## Relacionados

- `catalogo-designmd` — quando *não* há decisão tomada e é preciso consultar o catálogo. Traz
  também o **Design Arsenal**, offline, que se consulta antes do MCP.
- `docs/HANDOFF-FRONTEND.md` — estado card a card, histórico e registro de execução.
- `docs/auditoria-admin-onda4.md` — o diagnóstico medido que abriu a Onda 4, com o mapa do que
  dele já foi fechado.
