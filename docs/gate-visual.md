# Gate visual e de acessibilidade — FE-27

> Aberto em 19/08/2026, com o FE-27. É este documento que autoriza escrever
> **"frontend visual fechado"** — e é ele que diz o que essa frase cobre e o que ela não cobre.

A frase que manda aqui vem da régua de aceite: **build ou lint não substitui inspeção visual e
funcional.** Tudo abaixo é o piso automático. O teto continua sendo olhar.

---

## Como rodar

```bash
npm run check:ui          # estático, segundos, sem navegador
npm run check:contraste   # a cor dos dois temas, lida do src/index.css
npx playwright test gate-visual   # a matriz no navegador (precisa do .env.homolog)
```

Os dois primeiros rodam no CI a cada push, junto do build e do lint. O terceiro precisa de
ambiente publicado e credenciais de homologação, então continua no job `e2e`, sob demanda
(`workflow_dispatch`) — mesma regra que já valia para os outros specs.

---

## Severidade e critério de pronto

| | O que é | No gate |
|---|---|---|
| **P0** | Bloqueia: quebra fluxo principal | reprova |
| **P1** | Falha em fluxo principal ou em acessibilidade | reprova |
| **P2** | Degrada; some no ruído, mas é dívida | lista e segue |
| **P3** | Refinamento | lista e segue |

**Pronto = nenhum P0/P1 aberto e o P2 restante registrado e aceito.**

---

## As três camadas, e por que são três

### (a) Estrutural, no navegador — `e2e/gate-visual.spec.ts`

Independente de dado: vale igual com a base de homologação cheia ou vazia.

| Mede | Régua | Onde |
|---|---|---|
| Rolagem lateral indevida | 0px de excesso | 16 rotas × 4 larguras |
| Alvo de toque | ≥44px (decisão 7) | rotas × 375 e 768, **com dedo emulado** |
| Nome acessível em botão e link | existe | rotas × 4 larguras |
| Foco visível ao navegar por teclado | anel ou contorno | rotas do admin |
| Contraste de cada texto contra o fundo real | 4,5:1 · 3:1 no texto grande | rotas × claro e escuro |
| A tela de entrada não vira com o tema | idêntica nos dois | `/login` |
| O botão de tema troca e persiste | sobrevive ao recarregar | portal |

Dois detalhes que decidem se a régua mede o certo:

- **O dedo é emulado (`hasTouch`), não presumido pela largura.** A decisão 7 cumpre os 44px com
  `[@media(pointer:coarse)]`, e janela estreita com mouse não aciona essa regra. Medir sem toque
  aprovaria tela que no celular tem alvo de 34px — foi exatamente o que aconteceu na primeira
  rodada.
- **O contraste é medido duas vezes e só acusa o que sobrevive às duas.** Contraste ruim é
  estável; o que aparece numa medição e some na outra é quadro de transição. Gate que acusa
  fantasma é gate que alguém desliga.

### (b) Pixel — **recusada, de propósito**

`toHaveScreenshot()` não entra. O `baseURL` aponta para ambiente publicado com banco compartilhado:
snapshot de pixel contra dado real quebra a cada visita nova, vira ruído, e em duas semanas alguém
desliga o gate inteiro. A comparação contra os protótipos aprovados continua sendo revisão humana,
com a matriz na mão — protótipo e app divergem de propósito em dado e conteúdo.

### (c) Estática, no repositório — `scripts/audit-ui.mjs`

Pega o que compila perfeitamente e ainda assim é regressão:

| Regra | Severidade |
|---|---|
| `prefers-reduced-motion` global sumiu do `index.css` | P0 |
| foco removido sem substituto (`outline-none` sem anel) | P1 |
| `<img>` sem `alt` | P1 |
| `target="_blank"` sem `noopener`/`noreferrer` | P1 |
| `onClick` em `div`/`span` sem `role` nem `tabIndex` | P1 |
| branco literal fora de superfície escura fixa | P1 |
| `transition-all` | P2 |
| cor literal (`#RRGGBB`) fora dos tokens | P2 |

Três listas de exceção, todas com o motivo escrito no próprio arquivo: as superfícies escuras
**fixas** (`Login`, visor de foto, `PhotoCapture`), onde o branco literal é a tinta certa; e a cor
que não é interface (assinatura do cliente, `pdfGenerator`, `franchiseReport`) — PDF é papel, e
seguir o tema faria a consultora gerar relatório de fundo navy.

A skill `auditar-ui` do Design Arsenal seria a origem natural deste script, mas o
`design-library` **não estava acessível** nesta máquina em 19/08/2026. A implementação é nossa; a
lista de verificações e a régua P0–P3 vieram do card.

### `scripts/check-contraste-tema.mjs`

Lê os tokens direto do `src/index.css` — não uma cópia — e confere **47 pares por tema** em três
níveis: texto 4,5:1, gráfico 3:1 e **superfície 1,12:1**. O terceiro está fora da WCAG e existe
porque a primeira paleta escura passou em tudo e mesmo assim ficou errada: os "soft" descolavam do
cartão só 1,03:1 e o selo virava mancha sem forma. Também confere se a escala numérica continua
monotônica.

---

## A matriz

Rotas cobertas pela camada (a):

| Superfície | Rotas |
|---|---|
| Admin | Início · Clientes · Inspeções · Agendamentos · Plano de ação · Solicitações · Roteiros · Biblioteca · Sincronização · Configurações |
| Portal | Visão geral · Plano de ação · Solicitações · Documentos · Agenda · Financeiro |
| Sem login | Entrada da equipe · Entrada do cliente · Agendamento público |
| Estado, não rota | Execução do roteiro (`/execute`), **só no dedo** — 375 e 768 |

Larguras: **375 · 768 · 1280 · 1600**. Temas: **claro · escuro**.

**A execução entrou na matriz em 20/08/2026**, junto com a repaginação dela no celular. Ela não
tem URL própria (é `navigate(state)`), então entra por `e2e/apoio/execucao.ts`, que reaproveita a
inspeção em andamento de homologação e só cria uma quando não há nenhuma. Além da varredura de
geometria, o bloco afirma uma coisa que varredura nenhuma pega: **o salto de seção tem de parar
abaixo do cabeçalho fixo de 97px** — sem `scroll-margin-top` o cabeçalho come o título da seção
que a consultora acabou de pedir.

**Continuam fora, e é decisão:** `/summary` depende de inspeção concluída; `/new`,
`/templates/:id` e o editor de roteiro dependem de dado selecionado. Seguem na revisão humana.

---

## O que continua sendo humano

A camada automática não olha para nada disto — e é aqui que a frase do começo vale:

1. **Comparação contra os protótipos aprovados** (`docs/prototipos/`), com a matriz na mão.
2. **Estados de lista** (decisão 18): normal, carregando, vazio de primeira vez, vazio de filtro,
   erro e `disabled`. O gate cobre o estado **normal**; os outros exigem provocar a condição.
3. **Hierarquia, densidade, composição e microcopy** — o que separa "instrumento profissional" de
   "aparência genérica de IA" não passa por régua nenhuma.
4. **Leitor de tela de verdade**: o roteiro está em `docs/roteiro-nvda-voiceover-portal.md`.

---

## Achados da primeira passada (19/08/2026)

Tudo abaixo foi encontrado **pelo gate**, não por leitura de código, e corrigido no mesmo card.

| # | Achado | Severidade |
|---|---|---|
| 1 | O "+" da barra inferior (nova inspeção) não tinha nome acessível — o leitor de tela anunciava "link" e mais nada. O mesmo botão no `Sidebar` já vinha nomeado. | P1 |
| 2 | Os itens da barra inferior tinham 36–39px de largura, contra os 44 da decisão 7. | P1 |
| 3 | Onze controles do portal abaixo de 44px no dedo: os três botões do cabeçalho (34px), as duas chamadas da visão geral, "Ver pendências", o nome da unidade, "Copiar link", "Nova solicitação", o alternador Semana/Lista e as setas de semana (36×36). | P1 |
| 4 | Paginação não voltava para a página 1 ao mudar o filtro em `ServiceRequests`, `LegislationsManager`, `ActionPlan` — limpar o filtro na página 3 devolvia a lista inteira com a paginação parada na cauda. O FE-22 tinha corrigido à mão só em `Clients`/`Inspections`; o conserto foi para dentro do `usePagedList`, que é onde ninguém esquece. | P1 |
| 5 | Treze `transition-all`, incluindo em barra de progresso e no acordeão do checklist, que roda com 100+ itens. | P2 |
| 6 | Oito specs de e2e do P360-015 (08/08) apontavam para o portal de página única, que o FE-09 desmontou. Estavam vermelhos desde então sem ninguém ver: o job `e2e` só roda por `workflow_dispatch`. | P1 |
| 7 | `agenda.spec.ts` mandava `duration_minutes: 45` num intervalo de 30 minutos, então quem recusava o pedido era a checagem de coerência — a regra de 24 horas de antecedência, que é o assunto do teste, **nunca chegava a ser exercida**. | P1 |

| 8 | Âmbar cheio com tinta clara em cima: o selo "Conflito" do `PhotoCapture` (2,5:1) e o avatar de inspeção em andamento do `ClientDetails`. `--amber` é preenchimento **grande**; para preenchimento pequeno com texto existe `--amber-strong`. O mesmo avatar usava `primary-500`, que é anel de foco, com iniciais em cima (3,94:1). | P1 |

Aceitos como P2, registrados aqui e **não** corrigidos:

- `Login.tsx` — `placeholder:text-white/20` sobre o navy dá ~1,5:1. Placeholder não é conteúdo e o
  campo tem rótulo visível próprio; ainda assim é dívida, e mexer nele no meio do FE-12 misturaria
  correção de contraste com troca de tema.
- Véu de modal dividido entre `bg-black/60` (17 lugares) e `bg-deep/60` (2). Funciona nos dois
  temas; são dois pretos diferentes para a mesma função.
