# Handoff — Revisão dos roteiros de Estética (Cards 1-7)

Este documento contém os cards 1-7 e o estado verificado de cada entrega. Os cards pendentes
continuam autossuficientes — uma nova sessão pode executar somente o próximo card sem depender
do histórico das sessões anteriores.

## Estado atual em 03/08/2026

| Card | Estado | Evidência / próximo passo |
|---|---|---|
| 0 — Infraestrutura | **Concluído no código** | Commit `44a7ce1`. Migration criada e validada localmente, mas ainda não aplicada em produção. |
| 1 — Normas estruturantes | **Concluído** | Commit `cabdc03`; resultado consolidado em `legislacao-verificada.md`. |
| 2 — Produtos e equipamentos | **Concluído** | Commit `d13d946`; resultado consolidado em `legislacao-verificada.md`. |
| 3 — Resíduos, trabalho e estrutura | **Concluído** | Commit `d13d946`; resultado consolidado em `legislacao-verificada.md`. |
| 4 — RJ estadual e municipal | **Concluído** | Commit `d13d946`; confirmou LC Rio nº 197/2018, Decreto Rio nº 57.501/2026 e necessidade de suplemento RJ. |
| 5 — Clínica de Estética e Saúde | **Concluído e publicado no código** | Commit `b1b3b41`, `origin/main` confirmado e deployment Vercel de produção concluído. O roteiro ainda não está integrado ao catálogo da aplicação, por decisão do próprio card. |
| 6 — Embelezamento e Beleza | **Concluído e publicado no código** | Commit `550fa38`, `origin/main` confirmado. O roteiro ainda não está integrado ao catálogo da aplicação, por decisão do próprio card. |
| 7 — Integração, migration, seed e validação ponta a ponta | **Pendente** | Pode ser executado somente mediante autorização explícita. |

Contexto mínimo comum a todos:

- Repo: `C:\Users\miche\OneDrive - MSFT\TreinaVISA\App`, branch `main`.
- Stack: React 19 + Vite + TypeScript, Supabase (Postgres), deploy na Vercel em
  `inspecvisa.consultorasanitaria.com.br`, disparado por push na `main`.
- Fonte de verdade dos roteiros é o código em `src/data/`, não o Supabase. O Supabase é
  seedado a partir do código (`TemplateService.seedLegacyTemplates` /
  `TemplateService.updateFullTemplate`, em `src/services/templateService.ts`).
- Testes: `npm test` (vitest). `npm run build` roda `tsc -b && vite build`. Lint do projeto
  inteiro já falha por dívida pré-existente (~425 erros de `no-explicit-any`) — validar só os
  arquivos tocados: `npx eslint <arquivos>`.
- **Restrição inegociável**: há 1 inspeção de estética EM ANDAMENTO no template com id
  `b37caf84-6a02-4c7d-97a1-3aca09e77493` (`[ARQUIVADO] … (v2027)`, 112 itens, só existe no
  Supabase). Esse registro não pode ser tocado — nem renomeado nem ter itens alterados. Os
  roteiros novos nascem com ids novos.
- `client.state` é **texto livre** no banco (`"Rio de Janeiro"` e `"RJ"` coexistem para o mesmo
  estado). Qualquer matcher regional usa `isRioState` de `src/utils/state.ts` (ou a
  `normalizeLocation` local de `src/data/supplementRegistry.ts` para os casos GO/BH que não são
  RJ) — nunca `client.state === 'RJ'`.

## O que o Card 0 já entregou (não refazer)

1. `ChecklistItem.requirementType?: 'legal' | 'good_practice'` em [src/types/index.ts](../../../src/types/index.ts).
   Ausente = `'legal'`. Nenhum item existente foi marcado como `good_practice` — isso é
   trabalho dos Cards 5 e 6.
2. `src/data/supplementRegistry.ts` — registry declarativo de suplementos regionais. Hoje tem
   3 entradas (GO, BH, RJ — todas ILPI). `getEffectiveTemplate` em `src/data/templates.ts`
   itera esse array; não tem mais `if`s hard-coded por estado. Para adicionar o suplemento de
   estética do RJ (Card 7), é só empurrar uma nova entrada `{ supplement, appliesTo, nameSuffix }`
   nesse array — `appliesTo` recebe `(baseTemplate, client)` e decide se o suplemento se aplica.
3. `replacesItemId` implementado em `applySupplement` (`src/data/templates.ts`): um item de
   suplemento com esse campo remove o item apontado (id) de **todas** as seções do roteiro
   efetivo antes de inserir o item local. Use isso para o caso (b) da tabela de dedup abaixo.
4. PDF (`src/utils/pdfGenerator.ts`): itens com `requirementType === 'good_practice'` aparecem
   no relatório como `"Boa prática — não é exigência legal: <fonte>"` em vez de
   `"Base legal: <norma>"`, e são excluídos da página de Referências Legislativas
   (`drawReferencesABNT`).
5. Migration aditiva `supabase/migrations/20260803200000_checklist_items_requirement_type.sql`
   — adiciona `requirement_type` (default `'legal'`, com CHECK) e `legislation_url` em
   `checklist_items`. **Validada sintaticamente em Postgres descartável, mas NÃO aplicada em
   produção** — precisa da confirmação da Ester antes de rodar contra o banco de produção
   (`pfjacmawaigndqclgvpn`). `src/services/templateService.ts` já lê/escreve os dois campos
   novos (`legislationUrl` ⇄ `legislation_url`, `requirementType` ⇄ `requirement_type`) nos
   dois sentidos, então assim que a migration rodar em produção o seed já funciona sem mais
   mudança de código.
6. `src/__tests__/services/checklistIntegrity.test.ts` — roda sobre todo `src/data/templates.ts`
   (todo array `templates`, que hoje cobre estética, ILPI federal, ILPI GO standalone,
   alimentos federal e RJ) e verifica: ids únicos, `description`/`legislation` preenchidos,
   `good_practice` nunca crítica e peso ≤ 2, item crítico sempre peso 10, contagem de itens
   travada por template (`EXPECTED_ITEM_COUNTS`), e ausência de itens quase-duplicados
   (Jaccard de tokens ≥ 0.75) no roteiro efetivo ILPI federal + suplemento RJ / outro estado.
   **Ao criar `roteiro-clinica.ts` e `roteiro-embelezamento.ts` (Cards 5/6), adicione as duas
   entradas em `EXPECTED_ITEM_COUNTS` com a contagem final** — senão o teste não vai travar a
   contagem desses roteiros.

## A regra de deduplicação federal × local

Núcleo do pedido — todos os cards abaixo seguem esta tabela. Para cada par (item federal, item
local) que o inspetor responderia **com a mesma evidência em campo**:

| Situação | Decisão |
|---|---|
| **(a)** Teor idêntico, mesma exigência | Fica só o **federal**. Cita só a norma federal. O suplemento não repete o item. |
| **(b)** Local **mais restritiva** (prazo menor, documento a mais, requisito extra) | Fica a redação **local**, citando **as duas** normas. O item vive **no suplemento**, com `replacesItemId` apontando pro item federal correspondente — ele é substituído, não somado. |
| **(c)** Redações diferentes, **mesmo teor e mesma situação avaliada** | **Um único item**, redação fundida (a mais verificável em campo), com **as duas bases legais** no mesmo campo `legislation`. Fica na base federal; o suplemento não cria item novo. |
| **(d)** Local exige algo que a federal não trata | **Item novo**, exclusivo do suplemento. |

Proibido em qualquer hipótese: dois itens que o inspetor responderia olhando para o mesmo papel
ou para a mesma parede. O caso do licenciamento sanitário cobrado 3× no roteiro do codex
(`clinica-estetica-saude-rj-rio-2026-08`, itens 1.1/8.1/9.1) é exatamente isso — no roteiro novo
vira **um item só**, pelo caso (b) ou (c) conforme a Fase 1 (Cards 1-4) concluir.

## Cards 1-4 — Verificação de vigência (Opus 5, julgamento jurídico)

Julgamento jurídico com alto custo de erro — não delegar a modelo menor. Cada card produz
linhas em `docs/roteiros/estetica/legislacao-verificada.md` (crie o arquivo no Card 1 se não
existir), no formato:

`Norma | Ementa em 1 linha | Vigente? | Revogada por | O que exige (aplicável a estética) | Aplica a clínica? | Aplica a embelezamento? | URL oficial | Consultado em`

Regra absoluta, herdada da skill `visa-legislacao-sanitaria`: **nunca citar de memória** — cada
linha exige consulta a fonte oficial (`gov.br/anvisa`, `bvsms.saude.gov.br`, `planalto.gov.br`,
DOU, diário oficial do município/estado). Sem fonte = a norma **sai** do roteiro.

O roteiro atual (`tpl-estetica-v1`, 114 itens, em `src/data/templates.ts` linhas ~30-272) é o
ponto de partida — cada norma citada nele precisa passar por uma destas linhas antes do Card 5
poder usá-la.

### Card 1 — estruturantes de serviço de saúde
RDC 63/2011, RDC 36/2013, RDC 50/2002, Nota Técnica 02/2024/ANVISA, Portaria de Consolidação
nº 4/2017 (GM/MS), **Portaria 2616/98** (verificar se foi absorvida pela Consolidação — forte
suspeita), RDC 42/2010, Resolução CNS 466/2012, LGPD.

### Card 2 — processamento, produtos e equipamentos
RDC 15/2012, RDC 156/2006, RE 2605/2006, RDC 751/2022, **RDC 864/2024** (confirmar existência e
objeto), Lei 6.360/1976, RDC 67/2007, RDC 56/2009 (bronzeamento artificial), Lei 5.991/1973.

### Card 3 — resíduos, trabalho, estrutura
RDC 222/2018, NR-1, NR-6, NR-7, NR-10, NR-24, NR-32, ABNT NBR 9050, ABNT NBR 13534, Lei
13.589/2018 (PMOC), Lei 9.294/1996, Portaria SVS/MS 344/98, Portaria GM/MS 888/2021 (água).

### Card 4 — RJ estadual e municipal
Resolução SES/RJ nº 1.822/2019 e **Decreto Rio nº 57.501/2026** — este último **precisa ser
tratado como suspeito de alucinação até prova documental**; foi introduzido pelo roteiro do
codex (`clinica-estetica-saude-rj-rio-2026-08`) e não tem fonte registrada em lugar nenhum.
Além disso: confirmar ou refutar a hipótese de que **o município do RJ não tem legislação
sanitária própria para estética/embelezamento** (checar Código Sanitário Municipal, resoluções
da SMS-Rio e o decreto de licenciamento vigente). O resultado decide se `suplemento-rj.ts`
nasce com itens ou se o arquivo nem existe (ver Card 7, passo 2).

Cada card termina com um commit do arquivo `.md` — o produto é a tabela, não código.

## Card 5 — Roteiro Clínica de Estética e Saúde (Sonnet 5, 1 sessão)

Pré-requisito: Cards 1-3 concluídos (tabela em `legislacao-verificada.md` com as normas de
saúde/estética).

Escrever `src/data/estetica/roteiro-clinica.ts` exportando `templateEsteticaClinica:
ChecklistTemplate` com `id: 'tpl-estetica-clinica-v1'`, partindo dos 114 itens de
`src/data/templates.ts` (`tpl-estetica-v1`, linhas ~30-272) e da tabela verificada. Regras:

- Item cuja norma foi verificada como **revogada e não substituída** → remover, registrar a
  remoção neste arquivo (seção "Itens removidos" abaixo, adicione ao final do card).
- Item que sobreviva mas cuja norma mudou de número → atualizar a citação.
- Item sem base legal real (hoje: `'Boas Práticas'`, `'Boas Práticas de Gestão'`, `'Princípios
  de Biossegurança'`, `'Legislação Sanitária Local'`, `'Legislação do Consumidor'` e afins) →
  `requirementType: 'good_practice'`, `weight: 1` ou `2`, `isCritical: false`; o campo
  `legislation` passa a descrever a fonte da recomendação (manual do fabricante, consenso
  técnico), não uma lei inexistente.
- **Padronizar a grafia** das normas numa forma canônica única (proposta: `RDC Anvisa nº
  63/2011`, `NR-32`, `ABNT NBR 9050`) — as ~70 strings atuais colapsam para ~25 normas reais.
  Use `canonicalLegislationKey` / `extractBaseLegislation` de `src/utils/legislationRefs.ts`
  para conferir que duas grafias diferentes colapsam na mesma chave.
- Descrição de item = verificável em campo, uma pergunta por item (padrão dos 114 itens
  atuais — não o padrão telegráfico do roteiro do codex, tipo "Ambiente limpo.").
- Preencher `legislationUrl` com a URL oficial da tabela verificada.

Depois de escrever o arquivo:
1. Registrar `EXPECTED_ITEM_COUNTS['tpl-estetica-clinica-v1'] = <N>` em
   `src/__tests__/services/checklistIntegrity.test.ts` (o teste falha até isso ser feito —
   é o "trava mudança silenciosa").
2. `npm test` verde. Commit + push.

Não registrar ainda em `templates.ts` nem remover `tpl-estetica-v1` — isso é o Card 7 (só
depois que o roteiro de embelezamento também existir).

### Resultado do Card 5 — concluído em 03/08/2026

- Criado `src/data/estetica/roteiro-clinica.ts`, exportando
  `templateEsteticaClinica` com id `tpl-estetica-clinica-v1`.
- Contagem final: **113 itens**, sendo **17 boas práticas** sem peso crítico.
- Todos os itens legais possuem `legislationUrl`; grafias normativas são verificadas com
  `canonicalLegislationKey` e `extractBaseLegislation`.
- O teste de integridade importa o roteiro diretamente antes da integração ao catálogo e trava:
  contagem de 113 itens, perguntas verificáveis, ausência de quase-duplicatas, regras de
  `good_practice`, URLs e grafia canônica.
- Validação executada: **16 arquivos de teste e 119 testes aprovados**; ESLint isolado dos dois
  arquivos TypeScript tocados aprovado.
- Commit e publicação: `b1b3b41` (`Adiciona roteiro clínico de estética revisado`) enviado para
  `origin/main`; SHA remoto confirmado como
  `b1b3b41f47010f884f980b940fcad55b1fbba4c0`.
- Deployment Vercel registrado como `Production / success`; o domínio
  `https://inspecvisa.consultorasanitaria.com.br` respondeu HTTP 200.
- **Deliberadamente não executado neste card:** importação em `templates.ts`, remoção do
  `tpl-estetica-v1`, suplemento RJ, migration em produção, seed no Supabase, arquivamento do
  roteiro remoto intermediário e smoke funcional do novo roteiro. Essas ações permanecem no
  Card 7 e dependem do Card 6.

### Itens removidos no Card 5

- `est-077` — removido porque a RDC Anvisa nº 67/2007 não cria obrigação autônoma para a
  clínica sobre rotulagem de medicamento manipulado; ela permanece apenas como qualificadora
  da preparação alcoólica no item `est-050`, conforme a conclusão do Card 2.
- A RDC Anvisa nº 864/2024 foi retirada da base do item `est-058`, sem remoção do item: o ato
  caducou e tratava de dispensação emergencial de medicamento controlado, não de
  tecnovigilância.

## Card 6 — Roteiro Embelezamento e Beleza (Sonnet 5, 1 sessão)

Pré-requisito: Cards 1-3 concluídos.

`src/data/estetica/roteiro-embelezamento.ts` exportando `templateEsteticaEmbelezamento:
ChecklistTemplate` com `id: 'tpl-estetica-embelezamento-v1'`, para salão, barbearia, manicure,
depilação, sobrancelha — sem profissional de saúde e sem procedimento invasivo.

- Sai: CME/autoclave para artigo crítico, prontuário clínico, RT de nível superior de saúde,
  medicamentos, PSP/RDC 36/2013 — salvo o que os Cards 1-3 apontarem como aplicável a
  estabelecimento de embelezamento.
- Entra/reforça: esterilização de alicate e artigo semicrítico, descarte de perfurocortante,
  lâmina de uso único, higienização de pia e cuba, saneantes regularizados, ventilação em
  cabine de esmaltação/acetona, PGRSS proporcional, controle de vetores.
- **Caso híbrido** (salão que faz micropigmentação, aplicação de toxina, lash lifting): o item
  que ativa a exigência de saúde deve estar no roteiro de embelezamento como item crítico de
  encaminhamento ("realiza procedimento invasivo? então aplica-se o roteiro de clínica"), sem
  duplicar o conteúdo do outro roteiro.
- Mesmas regras de grafia, `requirementType` e verificabilidade do Card 5.

Mesmo fechamento do Card 5: registrar `EXPECTED_ITEM_COUNTS['tpl-estetica-embelezamento-v1']`,
`npm test` verde, commit + push.

### Resultado do Card 6 — concluído em 03/08/2026

- Criado `src/data/estetica/roteiro-embelezamento.ts`, exportando
  `templateEsteticaEmbelezamento` com id `tpl-estetica-embelezamento-v1`.
- Contagem final: **28 itens** em seis blocos, com requisitos legais dotados de URL oficial e
  boas práticas sem peso crítico.
- O caso híbrido foi registrado como encaminhamento crítico para o roteiro de Clínica de
  Estética e Saúde, sem duplicar as exigências clínicas.
- O teste de integridade importa o roteiro diretamente antes da integração ao catálogo e trava:
  contagem de 28 itens, perguntas verificáveis, ausência de quase-duplicatas, regras de
  `good_practice`, URLs e grafia canônica.
- Validação executada: **16 arquivos de teste e 127 testes aprovados**; ESLint isolado de
  `roteiro-embelezamento.ts` e `checklistIntegrity.test.ts` aprovado.
- Commit e publicação: `550fa38` (`Adiciona roteiro de embelezamento e beleza`) enviado para
  `origin/main`; SHA remoto confirmado como
  `550fa38a0eecd645f2c0b06ed6814423d1ac979e`.
- **Deliberadamente não executado neste card:** importação em `templates.ts`, remoção do
  `tpl-estetica-v1`, suplemento RJ, migration em produção, seed no Supabase, arquivamento do
  roteiro remoto intermediário e smoke funcional. Essas ações continuam no Card 7.

## Card 7 — Integração, suplemento RJ, seed e deploy (Sonnet 5, 1 sessão)

Pré-requisito: Cards 4, 5 e 6 concluídos.

1. Em `src/data/templates.ts`: importar `templateEsteticaClinica` e
   `templateEsteticaEmbelezamento`, adicioná-los ao array `templates`, **remover** o objeto
   `tpl-estetica-v1` do array. Em `getTemplateById()` (mesmo arquivo), mapear `tpl-estetica-v1
   | tpl-estetica | tpl-estetica-federal` → `tpl-estetica-clinica-v1` (mecanismo já existe para
   outros ids, só seguir o padrão).
2. Se o Card 4 confirmou legislação municipal do RJ para estética: criar
   `src/data/estetica/suplemento-rj.ts` (`ChecklistSupplement`, id `sup-estetica-rj-v1`) e
   adicionar uma entrada em `src/data/supplementRegistry.ts` — `appliesTo: (template, client) =>
   template.id === 'tpl-estetica-clinica-v1' && isRioState(client.state)` (importar `isRioState`
   de `../utils/state`). Use `replacesItemId` para os casos (b) da tabela de dedup. Se o Card 4
   **não** confirmou legislação municipal própria: não criar o arquivo, registrar a conclusão
   aqui embaixo ("RJ — sem suplemento municipal de estética: ...") — o registry já está pronto
   para o primeiro município que tiver.
3. Seed para o Supabase: reusar `TemplateService.seedLegacyTemplates` /
   `TemplateService.updateFullTemplate` (`src/services/templateService.ts:341+`). Conferir
   antes se o dedupe por nome (`existingNames` em `seedLegacyTemplates`) cobre o caso dos dois
   templates novos (nomes diferentes de `tpl-estetica-v1`, então não colidem); se algo não
   servir, ajustar o método existente em vez de escrever script novo.
4. **Arquivar** `clinica-estetica-saude-rj-rio-2026-08` (0 inspeções): renomear com prefixo
   `[ARQUIVADO]` — mecanismo já usado, filtrado em `src/pages/NewInspection.tsx:370`. **Não
   deletar.** **Não tocar** em `b37caf84-6a02-4c7d-97a1-3aca09e77493` (inspeção em andamento).
5. `npm test`, `npm run build`, verificar a tela de nova inspeção e um PDF gerado no preview.
   Commit, `git push origin main` (dispara deploy Vercel em
   `inspecvisa.consultorasanitaria.com.br`).

### Verificação ponta a ponta (Card 7)

Pelo preview do app: abrir nova inspeção com um dos clientes de estética do RJ e confirmar que
(a) aparecem exatamente os dois roteiros novos e nenhum arquivado; (b) o roteiro de clínica traz
o suplemento RJ só para cliente do RJ (se o Card 4 confirmou que ele existe); (c) o PDF mostra
"Boa prática — não é exigência legal" nos itens marcados e não os lista nas Referências
Legislativas; (d) o score não conta o licenciamento sanitário mais de uma vez.

### Migration em produção

A migration `20260803200000_checklist_items_requirement_type.sql` (Card 0) precisa rodar em
produção antes do seed do Card 7 — senão o seed grava `requirement_type`/`legislation_url` em
colunas que não existem. **Pedir confirmação explícita da Ester antes de aplicar em produção**
(projeto `pfjacmawaigndqclgvpn`).
