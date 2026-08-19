# Mapa do roteiro — da fonte ao plano de ação

> Medido em 16/08/2026, lendo o código. Entregue pelo **COND-01**
> ([HANDOFF-CONDICIONAIS.md](HANDOFF-CONDICIONAIS.md)), mas serve a qualquer trabalho que toque
> roteiro, execução, relatório ou nota — não só ao motor de condicionais.
> **Nenhuma alteração funcional foi feita para produzir este mapa.**

## O caminho, e o que trafega em cada seta

```
  roteiro-fonte                         ChecklistTemplate
  ├─ src/data/*.ts (estático)           id 'tpl-*', seções e itens com id estável
  └─ Supabase (editável)                id uuid; TemplateService.getFullTemplate()
        │
        │  TemplateService.syncAllTemplatesToDexie() → db.templates (Dexie)
        ▼
  composição — getEffectiveTemplate()   src/data/templates.ts:383
        │                               (cópia profunda; 6 regras, na ordem da tabela abaixo)
        ▼
  EffectiveTemplate                     ChecklistTemplate já filtrado — mesmo tipo, sem marca
        │                               de que foi filtrado nem por quê
        ▼
  nova inspeção — NewInspection.tsx     grava Inspection com templateId, clientId, city, state,
        │                               clientCategory, foodTypes, dados de ILPI
        ▼
  execução — InspectionExecution.tsx    recompõe o template a CADA render (useMemo), duas vezes:
        │                               effectiveTemplate (papel, full=false) e
        │                               collaborationTemplate ('ambos', full=true)
        │                               + composeChecklistTemplate(): injeta os itens ad-hoc
        ▼
  respostas — db.responses (Dexie)      InspectionResponse.itemId é string solta:
        │                               não há FK para checklist_items
        ▼
  sync — InspectionBundleSyncService    envia respostas e fotos; o roteiro NÃO viaja no bundle de
        │                               execução (chega pelo sync de templates). No bundle de
        │                               relatório viaja `inspection.reportTemplateSnapshot`
        ▼
  congelamento — ao CONCLUIR            InspectionExecution.tsx:816 e :865
        │                               reportTemplateSnapshot = collaborationTemplate || effectiveTemplate
        ▼
  fechamento — InspectionSummary.tsx    resolveReportTemplate(base, inspection, responses)
        │                               src/utils/reportTemplate.ts:72
        ▼
  nota — calculateScore()               src/utils/scoring.ts — recebe as SEÇÕES do template
        │                               resolvido + as respostas
        ▼
  PDF / inspection_report_versions      gera do mesmo `displayTemplate` da tela
        ▼
  plano de ação — client_action_items   só respostas `not_complies`; publicação exige
                                        `linkedRequest` (ver achado A10)
```

## As 6 regras de aplicabilidade que já existem

Todas dentro de `getEffectiveTemplate` (`src/data/templates.ts:383`), nesta ordem:

| # | Passo | Linha | O que decide | Fonte da decisão |
|---|---|---|---|---|
| 1 | Seções extras de alimentos | `:398` | acrescenta seções por tipo de alimento + UF | `client.foodTypes`, `client.state` |
| 2 | Suplementos regionais | `:406` | acrescenta/substitui itens por UF e município | `supplementRegistry`, predicado **em código** |
| 3 | Filtro por tipo de alimento | `:414` | remove seção que não casa | `section.applicableFoodTypes` — **campo declarativo no dado** |
| 4 | Filtro por papel (ILPI) | `:423` | remove seção de nutrição ou de saúde | `settings.consultantRole` + **palavra no título** |
| 5 | Filtro de aposentados | `:427` | remove item aposentado antes do corte | `item.retiredAt` vs `inspection.createdAt` |
| 6 | Ordenação final | `:435` | ordena seções | `section.order` |

E uma sétima, que vive **fora** do `getEffectiveTemplate`: `ChecklistItem.isRJOnly`
(`types/index.ts:132`), avaliada dentro de `getExtraSections`
(`templates_alimentos_segmentos.ts:865` — `if (item.isRJOnly && !isRJ) return false`). Ou seja:
**funciona, mas só para as seções extras de alimentos.** Nos 9 itens do suplemento ILPI RJ a flag é
**redundante** — o suplemento inteiro já é liberado só para o RJ pelo `isRioState`. Distribuição
real: 12 ocorrências nos dados (9 ILPI RJ redundantes · 2 de alimentos que realmente filtram ·
1 explicitamente `false`).

> **Duas dessas regras estão inertes hoje** — descoberto pelo `COND-02` ao reproduzi-las: a regra 1
> nunca casa, porque `segmentSectionMap` usa um vocabulário de segmento que o cadastro abandonou
> (achado **A11**), e a regra 3 não tem dado nenhum, porque nenhuma seção declara
> `applicableFoodTypes` (achado **A12**). A regra 6 (`isRJOnly`) roda **dentro** da regra 1: como a
> única seção que ainda carrega é a artesanal, e ela não tem item `isRJOnly`, a flag não filtra
> nada hoje — os dois itens que ela filtraria (`sor-003`, `jap-011`) estão em seções que nunca
> entram. Isso corrige em precisão, não em direção, o que o COND-01 registrou: a lógica está certa,
> o alcance é zero.

## Achados

### A1 · Item sem resposta vale "conforme" no MARP — que hoje ninguém mostra

`src/utils/scoring.ts:8-11`:

```ts
const binaryScore = (id: string) => {
  const res = responseMap.get(id);
  if (!res || (res.result as string) === 'not_evaluated') return 3;  // 3 = conforme
```

**Onde isso NÃO chega** — conferido linha a linha em 16/08/2026, e é a parte tranquilizadora:

- `scorePercentage` usa denominador `complies + not_complies` **respondidos** (`:120-125`). Item
  sem resposta **não infla o percentual**.
- `classification` deriva do `scorePercentage` (`:194`). Também não infla.
- É esse par que o PDF imprime na capa (`pdfGenerator.ts:794-827`), que o `ScorePanel` mostra e que
  o portal recebe via `calculateAreaScores` (que reusa o `calculateScore`).
- A capa do PDF ainda escreve **"X de Y itens avaliados"** — o relatório é honesto sobre o que
  ficou sem resposta.

**Onde chega:** só nos índices `ic`, `inc`, `cr` e `rp` de `calcMARPValues`, que são calculados
global e por seção — e **não são exibidos em lugar nenhum hoje** (o rótulo "Classificação de risco
(MARP)" do `ScorePanel` e do PDF mostra a `classification`, derivada do percentual, não esses
índices).

**Portanto:** é uma armadilha latente, não um número errado no ar. Vira número errado no minuto em
que alguém exibir IC/INC/CR/RP — e, para o motor de condicionais, continua sendo a regra que impede
"pendente de condição" de entrar no conjunto avaliado. Agravante que se mantém: crítico entra por
**média geométrica** (`:23`), então um item mal classificado move o índice inteiro.

**Dado real (produção, leitura em 16/08/2026):** de 31 inspeções concluídas, **3** têm menos
respostas que o roteiro tem itens — 80, 24 e 5 itens sem resposta. Nenhuma resposta gravada como
`not_evaluated`. Ou seja, o cenário existe de verdade; só não contamina o número publicado.

### A2 · O congelamento tem um fallback que o desliga

> **✅ Resolvido pelo COND-03 (18/08/2026).** A revisão é congelada na criação (lazy-freeze para o
> legado em andamento), a árvore congelada é sempre a completa, e `resolveReportTemplate` de inspeção
> em andamento lê o snapshot em vez de recompor do vivo. O caminho legado só sobrevive para relatório
> concluído pré-COND-03 e passou a registrar aviso visível quando o snapshot não cobre.

- O snapshot é gravado **ao concluir** (`InspectionExecution.tsx:816`), com
  `collaborationTemplate || effectiveTemplate`. Se a composição de colaboração falhar, o `catch`
  (`:388`) devolve o template cru e o `||` pode congelar a árvore **filtrada por papel**.
- `resolveReportTemplate` (`reportTemplate.ts:82`) só usa o snapshot se ele cobrir **todas** as
  respostas avaliadas; senão chama `buildLegacyCompletedReportTemplate`, que **recompõe a partir do
  roteiro vivo**.

Com branches condicionais, respostas preservadas de caminhos desativados passam a existir por
projeto — e o snapshot deixa de cobri-las por definição. O caminho "reconstrói do vivo" viraria o
normal. **É por isso que o congelamento subiu para o COND-03.**

### A3 · O contexto já está congelado; a regra não

A inspeção guarda `city`, `state`, `clientCategory`, `foodTypes` e os dados de ILPI
(`NewInspection.tsx:266-279`), e tanto a execução (`:374`, `:386`) quanto o relatório
(`reportTemplate.ts:87`) passam **a inspeção** no lugar do cliente. Ou seja: **mudar o cadastro do
cliente depois não muda a árvore de uma inspeção antiga** — metade da regra 9.2 do handoff já vale
hoje.

O que **não** está congelado: o roteiro (lido vivo do Dexie/Supabase por `templateId`), os
suplementos (código, avaliados a cada render) e o `retiredAt` (lido do item atual).

### A4 · A execução mantém duas árvores ao mesmo tempo

> **✅ Resolvido pelo COND-03 (18/08/2026).** Existe uma árvore só, a completa (`composeCanonicalTemplate`).
> O papel virou `filterSectionsByRoleForDisplay`, aplicado só em `visibleSections`.

`effectiveTemplate` (papel da consultora, `full=false`) é o que ela **vê**; `collaborationTemplate`
(`'ambos'`, `full=true`) é o que vira **snapshot** e o que o painel de colaboração usa. São duas
composições independentes do mesmo roteiro, recalculadas a cada mudança de `responses`.

Com condicionais, isso viraria duas árvores condicionais.

**Decidido pela Ester em 16/08/2026:** existe **uma** árvore, a completa; o papel vira filtro de
exibição ([contrato § 6.6](contrato-aplicabilidade.md)). Isso resolve o achado A2 pela raiz — se o
snapshot é sempre a árvore completa, ele cobre todas as respostas por construção, e o fallback que
reconstrói do roteiro vivo pode ser **removido** no `COND-03` em vez de mantido.

### A5 · Duas regras casam por texto, não por id

- `applySupplement` (`templates.ts:340-344`): acha a seção-alvo por `id` **ou pelo título
  normalizado** — porque roteiro do banco tem id uuid e `sec-fed-12` nunca bate.
- `filterSectionsByRole` (`:308-315`): decide o que é seção de nutrição por **palavra no título**
  (`nutri`, `aliment`, `dieta`, `cardápio`, `refei`) quando o id não bate.

Renomear uma seção muda silenciosamente qual roteiro a consultora vê. Sob o motor novo, regra é
por id — e essas duas viram dívida a migrar.

### A6 · Erro na composição é conservador, porém invisível

`InspectionExecution.tsx:376` e `:388`: se `getEffectiveTemplate` lançar, o `catch` devolve o
template **sem nenhum filtro** e escreve `console.error`. A direção está certa (mostrar demais é
melhor que esconder requisito), mas ninguém fica sabendo. O `COND-02`/`COND-08` mantêm a direção e
tornam o estado **visível**.

### A7 · Itens ad-hoc entram no template depois da composição

`composeChecklistTemplate` (`src/utils/customItems.ts:80`) injeta, como itens do template, as
respostas marcadas como item personalizado (`customItemMeta.state === 'active'`). Eles **não
existem no roteiro-mestre** — logo nunca podem ser alvo nem fonte de condição.

### A8 · Existem seções sintéticas no relatório

`sec-report-recovered` e `sec-previous-pendencies` (`reportTemplate.ts:8-14`) são removidas do
snapshot ao exibir. Não vêm do roteiro e ficam fora do motor.

### A9 · Aposentado: execução e relatório divergem numa inspeção em andamento

> **✅ Resolvido pelo COND-03 (18/08/2026).** `resolveReportTemplate` de inspeção em andamento passou a
> aplicar o mesmo corte (`createdAt`) que a execução, via `composeCanonicalTemplate`. Coberto por
> `src/__tests__/services/cond03CanonicalFreeze.test.ts`.

A execução passa `filterRetiredAsOf = inspection.createdAt` (`:375`, `:387`); o
`resolveReportTemplate` de inspeção **em andamento** (`reportTemplate.ts:86-91`) chama
`getEffectiveTemplate` **sem** o corte. Para a mesma inspeção aberta, a execução esconde um item
aposentado depois do início e o Resumo mostra.

Consequência hoje é pequena (item aposentado sem resposta aparece vazio no resumo); com o `COND-09`
exigindo conjuntos idênticos, isso reprova. **Achado de trabalho para o COND-03**, não corrigido
aqui.

### A10 · Publicação do plano de ação depende de vínculo, e falha calada

`InspectionSummary.tsx:427-428`: sem `linkedRequest`, o bloco inteiro de publicação não roda.
Já catalogado como achado de dados fora do escopo do frontend
([HANDOFF-FRONTEND.md](HANDOFF-FRONTEND.md) § Fora de escopo, item 4) e retomado pelo `FE-23`.

### A11 · As seções extras de alimentos nunca carregam — o vocabulário não bate

Achado do `COND-02` (16/08/2026), ao montar a suíte de equivalência da regra 1.

`segmentSectionMap` (`templates_alimentos_segmentos.ts:60`) é indexado por nomes antigos
(`restaurante_lanchonete`, `sorveteria`, `padaria_confeitaria`, `mercado_hortifruti`,
`acougue_peixaria`, `japones_pescado_cru`, `dark_kitchen_delivery`, `buffet_catering`,
`industria_artesanal`). O que o cadastro grava em `client.foodTypes` é `FoodEstablishmentType`
(`types/index.ts:12`): `servico_alimentacao`, `panificacao_confeitaria`, `mercado_varejo`,
`manipulacao_carnes`, `pescados_crus`, `dark_kitchen`, `bebidas_sorvetes`, `catering_eventos`,
`industria_artesanal`. O formulário de cliente grava exatamente essas chaves (`Clients.tsx:395`),
com `servico_alimentacao` como padrão (`:119`).

**Interseção: um só** — `industria_artesanal`. Medido:

```
getExtraSections(todos os 9 tipos do cadastro, 'RJ') → ['sec-extra-artesanal']
```

Ou seja: padaria, mercado, açougue/peixaria, japonês, delivery, buffet e sorveteria **nunca**
recebem a seção extra do segmento. Não é o motor escondendo requisito — é o vocabulário de duas
gerações do cadastro que nunca foi reconciliado. **Direção do erro é a pior possível**: exigência
sanitária que deixa de ser avaliada, sem aviso.

Efeito colateral: o `isRJOnly` das seções extras (regra 6) deixa de alcançar qualquer item, porque
os dois itens marcados (`sor-003` na sorveteria, `jap-011` no japonês) estão em seções que nunca
carregam.

Não corrigido aqui (o `COND-02` não escreve fora do pacote de domínio). Corrigir é trocar as chaves
do mapa pelas de `FoodEstablishmentType` — e conferir antes, com a Ester, se as seções extras
deveriam mesmo estar aparecendo nas inspeções de alimentos já feitas.

### A12 · `applicableFoodTypes` não tem nenhum dado

Também do `COND-02`. O campo existe no tipo (`types/index.ts:98`) e é lido em `templates.ts:417`,
mas **nenhuma seção do repositório o declara** — nem os roteiros estáticos, nem o carregador dos
roteiros do banco (que nunca preenche o campo). A regra 3 da tabela acima é, hoje, um `no-op`:
`!section.applicableFoodTypes` é sempre verdadeiro e a seção passa.

Isso não muda o que o handoff diz dela: continua sendo **o protótipo declarado do schema**
(alvo + operador "pertence a uma lista" + valor), e foi assim que o `COND-02` a generalizou. Só não
existe comportamento em produção dependendo dela — o que torna a migração do `COND-03` mais barata
do que parecia.

## Como manter isto vivo

Ao mexer em `getEffectiveTemplate`, `resolveReportTemplate`, `scoring.ts`, no congelamento ou na
publicação: atualizar este mapa **no mesmo commit**. Ele é a base do
[contrato de aplicabilidade](contrato-aplicabilidade.md).
