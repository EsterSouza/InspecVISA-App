# Handoff único — InspecVISA

**Última atualização:** 15/08/2026 (BRT), com o roteiro publicado de estética e terapias integrativas
para São Paulo capital ·
**Branch:** `main`, sincronizada com `origin/main` · O estado da seção 2 foi verificado em 03/08/2026,
com as correções de 04/08 e 05/08 anotadas nas tabelas.

### Resultado publicado — 15/08/2026 — roteiro de estética e terapias integrativas · São Paulo capital

- Commit funcional `1721047` publicado em `main`; a Vercel confirmou o mesmo SHA em produção no
  domínio canônico. Não houve seed, migration remota nem reescrita de roteiros ou inspeções.
- O roteiro-base federal `tpl-estetica-clinica-v1` permanece inalterado com 114 itens. O suplemento
  SP/SP substitui oito itens federais por versões locais mais específicas, acrescenta três
  condicionais locais e uma seção de cinco boas práticas sem equivalente, total efetivo de 122 itens.
- O suplemento só se aplica quando UF = SP e município = São Paulo, inclusive no roteiro seedado
  com UUID. Outros municípios paulistas não recebem legislação da capital.
- Enquadramento verificado: CVS 1/2024 (licenciamento), CVS 15/1999 (norma técnica, com Apêndice I
  revogado), CVS 5/2025 (PICS 8690-9/01, risco I), SMS 266/2025 com Anexo I rev. 39/2026 e
  SMS/COVISA 404/2024 (DCFF). Matriz e ressalvas em
  `docs/roteiros/estetica/legislacao-sp-integrativas.md`.
- A relação real de terapias, equipamentos e formação dos executantes não consta do cadastro; o
  roteiro mantém acupuntura, invasividade e estética médica como itens condicionais, sem presumir
  escopo profissional.
- Validação final: build aprovado, suíte completa serial com 49 arquivos/379 testes e smoke de
  produção HTTP 200. O bundle publicado contém o marcador exclusivo
  `sup-estetica-sp-capital-v1`.

### Resultado local — 12/08/2026 — EMAIL-01, confirmação de agendamento

- Implementado localmente, ainda sem commit, push, migration remota, deploy ou envio real.
- Em compromisso vinculado, `public.clients.email` passou a ser a única fonte de destinatário;
  e-mail da solicitação, da conta do portal e payload do navegador não são fallback. Solicitação
  sem `client_id` mantém `appointment_requests.email` apenas como contato provisório.
- A entrega agora tem estados `pending/sending/sent/missing_recipient/failed`, aquisição atômica,
  retry e deduplicação. Logs antigos com `email_sent = false` voltam a `pending` pela migration
  `20260812184947_canonical_appointment_email_delivery.sql`.
- A Edge Function valida a sessão e o acesso ao tenant, monta o link pelo domínio canônico no
  servidor e não devolve erro SMTP bruto. O painel diferencia falha, ausência de e-mail, envio em
  andamento e envio já realizado, com ação acessível de nova tentativa.
- Todos os dez caminhos SMTP usam assunto ASCII curto e sanitizado para evitar o MIME bruto visto
  no Hostinger. Testes: 48 arquivos/358 testes, build e `git diff --check` aprovados; as suítes SQL
  `appointment_notifications_and_timeline` e `appointment_availability` passaram em Postgres 16.
- Pendente de autorização separada: aplicar migration, implantar as Edge Functions e o frontend,
  fazer smoke em caixas controladas e só então reenviar a confirmação da Eliana.

### Correção urgente — 12/08/2026 — separação Saúde/Nutrição nas pendências

- Commit funcional: `c07c48d`. O compositor não cria mais a seção artificial
  “Pendências de inspeções anteriores” nem usa UUID como título. Pendências continuam nos itens e
  seções normais quando pertencem ao roteiro efetivo.
- Na abertura de inspeções, a semeadura agora respeita o recorte profissional selecionado. Itens e
  extras de Nutrição não são pré-carregados na execução de Saúde, e vice-versa.
- Auditoria somente leitura no Supabase confirmou que o UUID da captura pertence à seção
  “Serviço de Nutrição” do roteiro ILPI. Nenhum dado, resposta ou relatório histórico foi apagado
  ou reescrito; não foi necessária nova migration.
- Validação: 45 arquivos/346 testes e build local aprovados; CI obrigatório
  `31597671823` aprovado (build, testes e suítes SQL); produção confirmou o SHA `c07c48d`.
  Smoke autenticado focado da equipe: 10/10 em Chrome desktop e Pixel 5. O workflow E2E completo
  `31597845420` repetiu a pendência externa já conhecida: 32/50, com os 18 testes do Portal
  falhando; os testes da equipe passaram.

### Resultado — 12/08/2026 — plano de ação automático e itens extras persistentes

- Commits: `e93962a` (implementação), `9adde97` (rollout inicial) e `1e91d27`
  (edição posterior de descrição, criticidade e peso dos itens extras).
- Toda abertura/reabertura de inspeção em andamento deriva pendências de todo o histórico
  concluído da unidade; NC abre/atualiza, conforme fecha, N/A/NO/sem resposta não fecha.
  A semeadura é somente dos itens ausentes e preserva respostas, textos e fotos em andamento.
- Itens extras têm ID, seção, ordem, criticidade, peso e estado persistentes; exclusão é lógica.
  Enquanto a inspeção está em andamento, o botão acessível de edição reabre o formulário completo
  e permite alterar descrição, criticidade e peso sem trocar ID nem renumerar o item. Somente
  extras legados de inspeções em andamento são normalizados. Relatórios concluídos e
  versões congeladas não recebem backfill nem reescrita.
- Finalização sincroniza o rascunho, reconcilia evidências confirmadas e pendências em uma RPC
  transacional/idempotente e só então marca a inspeção concluída e congela o relatório.
- Produção: migration `20260812112448_automatic_action_plan_custom_items` aplicada no projeto
  `pfjacmawaigndqclgvpn`. Pós-check: 3 inspeções e 349 respostas ativas preservadas; nenhum dos
  extras concluídos recebeu metadata; `anon` não executa as RPCs novas/de bundle.
- Recheck final de produção: 3 inspeções em andamento, agora com 359 respostas e 2 metadata de
  extras; o aumento ocorreu durante o uso externo/teste da nova versão e foi preservado. Continuam
  zero respostas concluídas com metadata nova: nenhum relatório histórico foi reescrito.
- Validação local final: `npm test` — 45 arquivos/344 testes; `npm run build` — passou. PDF sintético
  real — 4 páginas A4, com extra crítico e pendência de roteiro anterior confirmados por leitura
  de todas as páginas. O lint global segue falhando pela dívida anterior (504 erros, inclusive
  binários em `_local-nao-versionado`); nenhum erro novo bloqueou TypeScript/build.
- CI do SHA final: build, 344 testes e todas as suítes SQL em Postgres 16 passaram no run
  `31594340026`. A Vercel publicou `1e91d27` em produção e o `build-info.json` do domínio canônico
  confirma esse SHA.
- Smoke autenticado do SHA final: `e2e/staff.spec.ts` passou 10/10 tanto localmente quanto no
  Actions, cobrindo Chrome desktop e Pixel 5, login válido/inválido e isolamento por tenant.
  O workflow completo `31594487292` ficou 32/50 porque os 18 testes dependentes do Portal usam
  códigos secretos do Actions divergentes do fixture local; os testes de build/PWA e todos os de
  staff passaram. Os códigos não foram copiados entre sistemas sem autorização específica.

Este documento substitui e torna obsoletos:

- `docs/HANDOFF_P360_PENDENCIAS.md`
- `docs/portal-360/HANDOFF.md`
- `docs/portal-360/CARDS.md`
- `docs/roteiros/estetica/HANDOFF.md`

Os quatro foram removidos nesta mesma alteração. O histórico continua no git
(`git show e6518b7:docs/portal-360/CARDS.md`). Permanece válido, como **insumo** e não como
handoff, o arquivo `docs/roteiros/estetica/legislacao-verificada.md`.

---

## 1. Como usar este documento

Cada card é **autossuficiente**: dá para abrir uma sessão nova, ler só a seção 2, a seção 3 e o
card, e executar. Não é preciso ler o histórico de nenhuma sessão anterior.

Regras que valem para todos os cards, sem exceção:

1. **Nada é aplicado em produção sem autorização explícita da Ester na conversa.** Migrations,
   seeds, `update`/`delete` em dados reais e deploy entram nessa regra. Escrever o arquivo de
   migration e testá-lo localmente não exige autorização; aplicá-lo exige.
2. **Um card por sessão.** Se durante a execução aparecer trabalho que pertence a outro card,
   registrar no relatório final e não executar.
3. **Não commitar arquivos fora do escopo do card.** O worktree costuma ter PDFs e planilhas de
   trabalho da Ester na raiz; preservar.
4. Ao terminar, atualizar a tabela de estado da seção 4 deste arquivo e escrever, no próprio card,
   um bloco `### Resultado — <data>` com: o que foi feito, evidência de teste, SHA do commit e o
   que foi deliberadamente deixado de fora.

### Modelos

A coluna "modelo" é recomendação, não imposição.

| Modelo | Quando |
|---|---|
| **Opus 5** | Migration, RLS, RPC, Storage, segurança, decisão sanitária/normativa, mapeamento semântico com julgamento técnico. |
| **Sonnet 5** | Feature de UI bem especificada, componente, teste, refatoração com critério de aceite objetivo. |
| **Haiku 4.5** | Varredura mecânica, catalogação, levantamento sem decisão. |

---

## 2. Estado verificado em 03/08/2026

Tudo abaixo foi confirmado por consulta direta ao código e ao Supabase de produção nesta data.
Não é planejamento; é o que está no ar.

### 2.1 Repositório

- **Local: `C:\Saas\App`** — fora do OneDrive desde 03/08/2026. Ver 2.2.
- `main` = `origin/main` = `e6518b7` ("Integrate estética inspection templates").
- `npm test`: **16 arquivos, 135 testes, todos passando**.
- `npm run build`: **passa** (bundle PWA com 72 entradas de precache, ~4,4 MB).
- `npm run lint`: **falha** com ~425 erros preexistentes, majoritariamente
  `@typescript-eslint/no-explicit-any`. Não bloqueia build nem testes.

### 2.2 Incidente do OneDrive — 03/08/2026 · resolvido

O repositório vivia em `C:\Users\miche\OneDrive - MSFT\TreinaVISA\App`, dentro de pasta
sincronizada. Nesta data houve **duas ondas** de conflito de sincronização (≈13:23 e ≈21:25) que:

- sobrescreveram **35 arquivos rastreados** com versões de abril, junho e julho, salvando o
  conteúdo correto em cópias `*-consutorias.*`;
- deixaram **14 cópias órfãs** adicionais de uma onda anterior — que, descobriu-se, tinham sido
  **commitadas** em `f095fcb`;
- corromperam o diretório `.git`, criando as branches falsas `main-consutorias` e
  `origin/main-consutorias` e cópias de `index`, `FETCH_HEAD`, `COMMIT_EDITMSG` e `logs/`.

Tudo foi recuperado em 03/08/2026 22:35: os arquivos voltaram ao HEAD, as 49 cópias e as refs
falsas foram removidas, e testes e build voltaram a passar. **Nenhum commit foi perdido** — a
verificação mostrou que cada cópia `-consutorias` era byte a byte idêntica ao HEAD, e o HEAD já
estava publicado em `origin/main`.

**A causa foi tratada.** A Ester moveu o repositório para `C:\Saas\App`, fora de qualquer pasta
sincronizada, em 03/08/2026 22:58. A integridade foi verificada no destino: 135 testes e build
passando, `.env` e arquivos de trabalho preservados, `git fsck` limpo, nenhuma branch falsa e
nenhuma cópia `-consutorias`. Ver INFRA-01, concluído.

Se este documento for lido a partir de um caminho dentro do OneDrive, **pare** — é cópia velha.

### 2.3 Migrations aplicadas em produção

Projeto Supabase de produção: `pfjacmawaigndqclgvpn`. Tenant principal:
`60191f17-6733-4439-9fd4-cceace47bf30`.

Confirmado presente no banco:

| Objeto | Situação |
|---|---|
| `checklist_items.requirement_type` | ✅ existe |
| `checklist_items.legislation_url` | ✅ existe |
| `client_portal_settings` | ✅ existe |
| `appointment_blocks` | ✅ existe |
| `client_portal_invoices` | ✅ existe |
| `client_portal_payment_acknowledge` (função) | ✅ existe desde 04/08/2026 — PROD-01 |
| `client_portal_audit_event` (função) | ✅ existe desde 04/08/2026 — PROD-01 |
| `client_portal_audit_events` (tabela) | ✅ existe desde 04/08/2026 — PROD-01 |
| `client_action_items` (tabela + 3 RPCs) | ✅ existe desde 07/08/2026 — P360-010 |
| `client_portal_account_features` (+ travas do portal) | ✅ existe desde 07/08/2026 — PORT-01 |
| `client_action_evidence` (+ bucket privado e 4 RPCs) | ✅ existe desde 07/08/2026 — P360-011 |
| `public_report_*` (link aberto do relatório) + autoria da evidência | ✅ existe desde 07/08/2026 — PORT-02 |
| `client_service_requests` (+ eventos, bucket privado e 6 RPCs) | ✅ existe desde 08/08/2026 — P360-012 |
| `admin_backfill_client_action_items` (projeção retroativa) | ✅ existe desde 08/08/2026 — adendo do P360-010; rodado em 16 visitas |

A migration `checklist_items_requirement_type` consta **duas vezes** no ledger remoto, sob as
versões `20260803205941` e `20260803221936`. O schema está correto; o ledger é que está sujo.

O ledger inteiro foi auditado em 04/08/2026 contra o schema real — arquivo por arquivo, objeto por
objeto — e **corrigido no mesmo dia**. Ver [`docs/migrations-status.md`](migrations-status.md). As 23
versões de arquivo agora constam no ledger; a duplicata acima foi apagada.

### 2.4 Roteiros de estética

Os roteiros novos **já estão semeados em produção** e os antigos já foram marcados como arquivados.

| Roteiro | ID | Seções | Itens |
|---|---|---|---|
| Clínica de Estética e Saúde — 08/2026 | `0c55f120-81e9-45d7-8ef5-04437d22a9a3` | 12 | 113 |
| Embelezamento e Beleza — 08/2026 | `7c4bb5d6-84fa-40b1-8804-519314be8627` | 6 | 28 |
| [ARQUIVADO] Estética e Beleza (v2027) | `b37caf84-6a02-4c7d-97a1-3aca09e77493` | 12 | 112 |
| [ARQUIVADO] Estética e Beleza | `51947053-51b1-446a-96ee-38543ebb1f99` | 12 | 114 |
| [ARQUIVADO] Clínica de Estética e Saúde RJ/Rio | `clinica-estetica-saude-rj-rio-2026-08` | 9 | 52 |

Seções do roteiro novo de clínica, na ordem: Documentação e Regularização (16), Saúde e Segurança
do Trabalhador (6), Infraestrutura Física (13), Processamento de Artigos (12), Biossegurança (7),
Segurança do Paciente (8), Equipamentos e Produtos (14), Gestão de Resíduos (7), Controle de
Vetores e Qualidade da Água (3), Processamento de Roupas (4), Requisitos Gerais (18), Gestão da
Qualidade (5).

### 2.5 A inspeção em andamento

Existe **uma única** inspeção com status `in_progress` em todo o banco:

| Campo | Valor |
|---|---|
| ID | `548466d6-ee61-42da-b844-76fbbfa679ce` |
| Cliente | MEIRE BEAUTY CLINIC |
| Consultora | Ester Caiafa |
| Data | 31/07/2026 |
| Roteiro | `b37caf84…` — **[ARQUIVADO] Estética e Beleza (v2027)** |
| Respostas | 124 (121 `item_id` distintos) |
| Com resultado preenchido | 124 |
| Com descrição da situação | 18 |
| Com ação corretiva | 13 |

Dos 121 `item_id` distintos, **112 correspondem a itens do roteiro arquivado** e 9 são órfãos
(provavelmente de suplemento ou de versão anterior). É essa inspeção que a Ester quer migrar para
o roteiro novo. Ver **EST-01**.

### 2.6 Referências legislativas — resolvido em 05/08/2026 (REF-01, REF-02, REF-03)

Esta seção registrava o problema; hoje registra o estado. Os números abaixo são de 05/08/2026,
depois do REF-02.

| Medida | Antes (03/08) | Depois (05/08) |
|---|---|---|
| Registros na biblioteca de legislações | 42 | **79** (78 no REF-02 + Lei 5.991/1973 no REF-04) |
| Atos citados pelos roteiros **vivos** | estimados em ~170 | **41** medidos |
| Desses, presentes na biblioteca | 13 (32%) | **41 (100%)** |
| Itens legais em código sem URL de legislação | 387 | **0**, travado por teste |
| Registros sem UF quando a norma é regional | 3 | **0**, travado por teste |
| Norma revogada citada como vigente | 1 (COFEN 358/2009) | **0** |

O "~170" era estimativa manual anterior ao inventário; o número real, medido pelo REF-01 e
corrigido pelo REF-02, é 41 atos nos roteiros vivos e 5 adicionais só em roteiros arquivados.

**A fonte de verdade passou a ser o código:** [`src/data/legislationLibrary.ts`](../src/data/legislationLibrary.ts).
O item do roteiro não carrega mais a URL — ela é resolvida pela chave canônica contra a biblioteca
(`legislationUrlForItem`, em `src/utils/legislationRefs.ts`). `checklist_items.legislation_url`
continua existindo como override manual. A evidência de vigência de cada ato está em
[`docs/referencias/biblioteca.md`](referencias/biblioteca.md).

O REF-02 removeu uma cópia defasada de `extractBaseLegislation` que vivia dentro de
`pdfGenerator.ts` e nunca recebeu as correções do REF-01 — era ela que fazia a página de
referências listar a mesma lei municipal cinco vezes, uma por artigo citado.

> **Atenção — o REF-07 (14/08) inverteu a regra do REF-03.** O REF-03 fazia
> `drawReferencesABNT` citar também a norma **sem** verbete na biblioteca, para não omitir a base
> de uma exigência. Na prática isso produzia citação inventada: `formatABNT` deduzia o órgão por
> regex e carimbava `BRASIL.` em qualquer texto, então "Critério técnico de higiene das mãos"
> saía como norma federal e a Portaria IVISA-RIO 002/2020 (municipal, citada por 102 itens)
> virava ato do Ministério da Saúde. **Hoje só entra na seção quem tem verbete curado**; quem não
> tem é listado no modal de geração como "sem fonte cadastrada", para virar trabalho de curadoria
> em vez de texto errado. Ver 2.7.

**O que o REF-02 deixou aberto, e o REF-04 fechou** (06/08): os 48 itens `legal` que continuavam sem
URL não tinham problema de resolução — a citação simplesmente não nomeava ato ("Boas Práticas",
"Normas do Corpo de Bombeiros"). 47 deles estão em roteiros `[ARQUIVADO]` e 1 no ILPI Goiás. Ver
REF-04 para a tabela de decisões. Registre-se, porque é fácil confundir: **`requirement_type` não
entra no cálculo do score** — `scoring.ts` usa só `weight` e `isCritical`; o campo só muda o rótulo e
a página de referências do PDF.

### 2.7 Referências — o que o REF-07 mudou (14/08/2026)

Três queixas da consultora: o relatório citava norma que a inspeção não avaliou, citava norma
inexistente, e fora do RJ não trazia legislação estadual nenhuma.

| Onde | Antes | Agora |
|---|---|---|
| `PdfPreviewModal` | injetava **toda** a biblioteca que casasse UF+segmento, pré-marcada, mesmo sem item citar | marcadas só as citadas por item avaliado (`citedLegislations`); o resto vira sugestão **desmarcada** |
| `formatABNT` | deduzia autoria por regex; fallback `BRASIL. <texto>` | autoria vem de `legislations.authority`; sem verbete, não é citada |
| `LegislationStatus` | `vigente \| vigente_com_alteracoes` | ganhou `revogada` + `replaced_by`; revogada sai das sugestões e o PDF marca a substituta |
| `isLegislationApplicable` | 3 apelidos de estado, sem normalizar acento | `toUF()` com as 27 UFs (`src/utils/state.ts`); `Clients.tsx` virou `<select>` |
| casamento com a biblioteca | substring nos dois sentidos — "RDC 15/2012" achava "RDC 156/2006" | chave canônica, igual ao PDF desde o REF-02 |

**A causa da queixa "inventado pela IA" não era IA** — não há nenhuma no repo. Eram os fallbacks
determinísticos acima. Vale repetir isso a quem retomar o assunto.

Dois scripts novos, ambos sem Supabase: `scripts/ref07-lacunas.ts` (o que os roteiros citam e a
biblioteca não tem) e `scripts/ref07-valida-links.ts` (URLs quebradas — ele separa "quebrado" de
"inacessível", porque bvsms/planalto derrubam a conexão em rede com filtro de saída, e tratar os
dois como link morto daria mais falso positivo que achado).

**Decreto Rio nº 45.585/2018 — revogado, e sem substituto de conteúdo.** Caiu em 02/02/2026 pelo
art. 72, I do Decreto Rio nº 57.501/2026, e era citado por 24 itens do roteiro de Serviços de
Alimentação (Município RJ). O 57.501 **não serve para reapontar**: ele regulamenta licenciamento,
infrações e fiscalização, e seus anexos são tabelas de risco por segmento — enquanto os itens
citavam a numeração do *roteiro anexo* ao 45.585 (5.5.9, 6.4.1, 7.1…), que é requisito técnico.
20 itens ficaram com a norma vigente que já citavam junto, 1 passou para a Portaria IVISA-RIO
002/2020 Art. 97, e **3 seguem sem base vigente**, marcados com comentário no código
(`rj-f-087`, `rj-exc-010`, `rj-exc-011`). Detalhe e evidência em
[`docs/referencias/biblioteca.md`](referencias/biblioteca.md).

`docs/referencias/inventario.csv` é de 05/08 e **está desatualizado** — não use como fonte.

---

## 3. Contexto técnico mínimo

- **Stack:** React 19 + Vite + TypeScript, Zustand, Dexie (offline), Supabase (Postgres + RPCs
  `security definer`), jsPDF. Deploy na Vercel em `inspecvisa.consultorasanitaria.com.br`,
  disparado por push na `main`.
- **Cliente Supabase único** (`src/lib/supabase.ts`) atende o app interno **e** as páginas
  públicas. Consequência: se houver sessão de staff no navegador, as RPCs públicas são chamadas
  com papel `authenticated`, não `anon`. **Toda RPC pública precisa de grant para os dois papéis.**
  Já quebrou em produção uma vez por causa disso.
- **Testes:** `npm test` (vitest). Testes SQL em `supabase/tests/*.test.sql` rodam em Postgres puro:

  ```bash
  docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test postgres:16-alpine
  ```

  Depois `docker cp supabase pgtest:/work` e
  `MSYS_NO_PATHCONV=1 docker exec -w //work/tests pgtest psql -U postgres -d test -v ON_ERROR_STOP=1 -f <arquivo>.test.sql`.

- **Atribuição por consultora** é feita por `consultant_name`/`consultant_names`, **não** por
  `user_id`. Não trocar um pelo outro.
- **Padrão de migration:** `security definer`, `set search_path = ''`,
  `revoke all ... from public`, `grant execute ... to anon, authenticated`.

---

## 4. Mapa de cards

| Card | Título | Modelo | Esforço | Depende de | Estado |
|---|---|---|---|---|---|
| **INFRA-01** | Tirar o repositório do OneDrive | — | baixo | — | ✅ **concluído 03/08** |
| **INFRA-02** | Reconciliar o ledger de migrations | Opus 5 | médio | — | ✅ **concluído 04/08** |
| **EST-01** | Migrar respostas da inspeção em andamento | Opus 5 | alto | — | ✅ **concluído 03/08** |
| **EST-02** | Verificar suplemento RJ de estética | Sonnet 5 | baixo | — | ✅ **concluído 05/08** |
| **REF-01** | Catalogar os atos citados | Haiku 4.5 | médio | — | ✅ **concluído 05/08** |
| **REF-02** | Sanear a biblioteca e ligá-la aos roteiros | Opus 5 | alto | REF-01 (concluído) | ✅ **concluído 05/08** · aplicado em produção (migration + backfill) |
| **REF-03** | Fontes consultadas e links no relatório | Sonnet 5 | médio | REF-02 (só para enriquecer, não bloqueia) | ✅ **concluído 05/08** |
| **REF-04** | Curar itens legais que citam texto genérico | Opus 5 | baixo | REF-02 (concluído) | ✅ **concluído 06/08** · aplicado em produção |
| **REF-05** | Curar `requirement_type` em ILPI e alimentos | Opus 5 | médio | REF-04 (concluído) | 🟡 **precondição concluída 06/08** · curadoria pendente |
| **PROD-01** | Aviso de pagamento quebrado no portal | Opus 5 | médio | — | ✅ **concluído 04/08** |
| **PROD-02** | Auditoria do portal não grava nada | Opus 5 | baixo | — | ✅ **concluído 04/08** |
| **REF-06** | Ligação resposta ↔ item quebrada | Opus 5 | alto | — | ✅ **concluído 06/08** · aplicado em produção (2 cargas) |
| **REF-07** | Referências: só o que foi usado, autoria curada, UF das 27 | Opus 5 | alto | REF-02 (concluído) | ✅ **concluído 15/08** · aplicado em produção (migration `20260814185610` + itens do 45.585 + os 3 itens sem base vigente resolvidos com decisão da Ester) |
| **REL-01** | Mostrar no relatório o que o cliente já cumpre | Opus 5 | baixo | — | ✅ **concluído 06/08** |
| **AGD-01** | Visita retroativa + ordem/paginação do painel de solicitações | Opus 5 | baixo | — | ✅ **concluído 06/08** · 1 linha recriada em produção |
| **EMAIL-01** | Destinatário canônico e entrega confiável dos e-mails de agendamento | Opus 5 | alto | — | ✅ **concluído 15/08** · migration e as 10 Edge Functions já estavam em produção batendo com o código local; smoke test real feito com a Eliana (agendamento `99ac7381…`), `delivery_status = sent` confirmado no banco |
| **P360-008** | Detalhe, notificações e calendário | Sonnet 5 | alto | — | ✅ **concluído 06/08** · aplicado em produção; achada e corrigida edge function `client-appointment-assets` desatualizada (v4→v5, sem os campos do P360-004) |
| **P360-009** | Início do portal por próximas ações | Sonnet 5 | alto | P360-008 | ✅ **concluído 07/08/2026** |
| **P360-010** | Projeção segura do plano de ação | Opus 5 | alto | — | ✅ **concluído 07/08/2026** · aplicado em produção; prova de ponta a ponta feita no app com conta de teste, depois apagada |
| **PORT-01** | Central de acesso do portal por conta | Opus 5 | alto | P360-010 | ✅ **concluído 07/08/2026** · aplicado em produção (migration + edge function v6) |
| **P360-011** | Evidências do cliente e revisão técnica | Opus 5 | alto | P360-010 | ✅ **concluído 07/08/2026** · aplicado em produção (migration + bucket privado + 2 edge functions); prova de ponta a ponta feita contra produção, depois apagada |
| **PORT-02** | Link do relatório por unidade e autoria da evidência | Opus 5 | alto | P360-011 | ✅ **concluído 07/08/2026** · aplicado em produção; provado contra a visita real da Icaraí |
| **REL-03** | Evidência do cliente na nova vistoria e no relatório final | Opus 5 | alto | PORT-02 | ✅ **concluído 07/08/2026** · só código (sem migration); fecha o ciclo sanitário |
| **PORT-03** | O cliente declara a situação do item (inclusive "não fiz") | Opus 5 | médio | PORT-02 | ✅ **concluído 07/08/2026** · aplicado em produção |
| **P360-012** | Solicitações estruturadas de consultoria | Opus 5 | alto | — | ✅ **concluído 08/08/2026** · aplicado em produção (2 migrations + bucket privado + 2 edge functions); inclui o backfill retroativo do plano de ação, com 306 pendências projetadas em 16 unidades |
| **P360-013** | Painel operacional das consultoras | Sonnet 5 | alto | 010, 011, 012 | ✅ **concluído 08/08/2026** · aplicado em produção (migration só de funções, sem tabela nova); rota `/painel` nova, sem mexer no Dashboard existente |
| **P360-014** | Acessibilidade e responsividade | Sonnet 5 | médio | superfícies estáveis | ✅ **concluído 08/08/2026** · sem migration, frontend puro |
| **P360-015** | E2E, rollout e prova de produção | Opus 5 | alto | onda a publicar | ✅ **concluído 08/08/2026** · sem migration; CI, Playwright, smoke e tenant de homologação criados em produção |
| **DEBT-01** | Margem pública de 4 h por tipo | Sonnet 5 | médio | — | ✅ **concluído 04/08** |
| **DEBT-02** | Dívida de lint | Sonnet 5 | médio | — | 🟡 **em andamento 17/08/2026** · 531 → 251; fatia 0 (tudo que não é `no-explicit-any`), `src/services` e `src/pages` zeradas, teto por área cobrado no CI |
| **PORT-04** | Tutorial do portal por conta do cliente | Opus 5 | baixo | — | ✅ **concluído 08/08/2026** · aplicado em produção (1 migration); o campo do tenant vira padrão |
| **SEC-01** | Endurecer o que a revisão do P360-015 encontrou | Opus 5 | médio | P360-015 (concluído) | ✅ **concluído 08/08/2026** · aplicado em produção (2 migrations), autorizado pela Ester; 50 execuções E2E depois do revoke |
| **DEBT-03** | Pontas soltas do repositório | Haiku 4.5 | baixo | — | ✅ **concluído 05/08** |

Ordem sugerida: **REF-05**, depois a onda do **Portal 360**. O REF-06 saiu na frente porque era
integridade de dado de cliente real e crescia com o tempo; foi concluído em 06/08, e a precondição
que segurava o REF-05 também.
(INFRA-01, INFRA-02, EST-01, EST-02, PROD-01, PROD-02, PROD-03, REF-01, REF-02, REF-03, REF-04 e
DEBT-03 já saíram da fila.)

Cards P360-001 a P360-007 foram concluídos e não aparecem aqui.

## 4.1 Divisão por modelo

São **10 cards pendentes** (EST-02, REF-01, REF-02, REF-03 e DEBT-03 concluídos em 05/08; REF-04 em 06/08). A divisão abaixo é
o critério de despacho: abra a sessão com o modelo indicado e cole o card correspondente.

### Opus 5 — 6 cards

Tudo que toca **banco, segurança ou decisão normativa**. O erro aqui é caro e silencioso: uma RPC
sem grant correto quebra só para quem está logado, uma norma revogada citada como vigente vira
laudo errado, e um mapeamento de item malfeito reescreve a inspeção de uma cliente real.

| Card | Por que Opus 5 |
|---|---|
| **REF-05** | Decisão normativa item a item em ILPI e alimentos. A reconciliação do roteiro já saiu. |
| **REF-06** | Concluído em 06/08. Mantido aqui só como registro do critério de despacho. |
| **P360-010** | RLS, projeção de dados sanitários, isolamento entre tenants. |
| **P360-011** | Storage privado, URL assinada, upload autenticado por token. |
| **P360-012** | Tabelas novas tenant-scoped, rate limit, permissão por papel. |
| **P360-015** | Revisão final de segurança e prova de produção. |

### Sonnet 5 — 5 cards

**Feature de UI e refatoração com critério de aceite objetivo.** Escopo fechado, o resultado se vê
na tela e o teste diz se está certo.

| Card | Por que Sonnet 5 |
|---|---|
| **P360-008** | Geração de `.ics`, templates de e-mail, timeline condicional. Muita mecânica, pouca decisão. |
| **P360-009** | Decomposição de página e regra de prioridade determinística. |
| **P360-013** | Painel agregado sobre estruturas que os cards anteriores já terão criado. |
| **P360-014** | Acessibilidade e responsividade — critério objetivo e verificável por ferramenta. |
| **DEBT-02** | Fatiar `any` por diretório, um PR por fatia, sem mudar comportamento. |

> **P360-015 é a exceção da regra.** Os testes E2E podem ser escritos por Sonnet 5, mas a revisão
> de segurança, migrations e prova de produção tem de ser feita com Opus 5.

### Haiku 4.5 — 0 cards

Não há cards pendentes hoje na categoria "varredura mecânica, sem decisão" — REF-01 e DEBT-03, os
dois que existiam, foram concluídos em 05/08.

### O que não delegar por modelo, e sim à Ester

Três pontos de decisão que nenhum modelo resolve sozinho, e que os cards marcam como parada
obrigatória:

Hoje não há nenhum. A parada do REF-02 — acordar a meta de cobertura da biblioteca — foi cumprida em
05/08/2026: a Ester escolheu "100% dos roteiros vivos" e a biblioteca como fonte única de URL.

EST-01 e PROD-01 já haviam passado por essa parada: o mapa de migração foi aprovado item a item em
03/08/2026 e, em 04/08/2026, a Ester decidiu manter o aviso de pagamento e criar a função.

E a regra que vale para todos: **nada é aplicado em produção sem autorização explícita dela.**

---

# Bloco 0 — Ambiente

## INFRA-01 — Tirar o repositório do OneDrive ✅ concluído

**Executado pela Ester em 03/08/2026.** Mantido aqui como registro; não há trabalho pendente.

O repositório saiu de `C:\Users\miche\OneDrive - MSFT\TreinaVISA\App` e passou a viver em
**`C:\Saas\App`**, fora de qualquer pasta sincronizada. A pasta antiga não existe mais — foi um
`move`, não um `clone`, o que preservou o worktree inteiro, incluindo as alterações ainda não
commitadas.

### Verificação no destino, em 03/08/2026 22:58

| Item | Resultado |
|---|---|
| `npm test` | ✅ 16 arquivos, 135 testes |
| `npm run build` | ✅ built in 8.88s |
| `git fsck --connectivity-only` | ✅ limpo (só objetos "dangling", que são normais) |
| `git status -sb` | ✅ `main...origin/main`, sem divergência |
| Branches | ✅ só `main`, `origin/main` e `claude/hardcore-goodall-901dbf`; nenhuma ref falsa |
| Arquivos `*-consutorias*` | ✅ nenhum |
| `.env`, `.env.example`, `.env.vercel.*` | ✅ preservados |
| `node_modules` | ✅ veio junto, sem precisar de `npm ci` |
| Arquivos de negócio da raiz | ✅ os 8 PDFs/XLSX/JSON preservados, incluindo as planilhas da ANVISA |

### O que ficou pendente deste card

Nada de técnico. Resta apenas, quando a Ester quiser: conferir se o OneDrive não guarda uma cópia
órfã do projeto na nuvem que volte a sincronizar sozinha. É ação na conta dela, não no repositório.

---

## INFRA-02 — Reconciliar o ledger de migrations com o Supabase remoto ✅ concluído em 04/08/2026

**Modelo:** Opus 5 · **Entrega:** [`docs/migrations-status.md`](migrations-status.md)

**Por que:** `supabase_migrations.schema_migrations` não bate com `supabase/migrations/`. É a razão
de PROD-01 e PROD-02 terem passado despercebidos por meses.

### Divergências conhecidas

- **Aplicada duas vezes:** `checklist_items_requirement_type`, sob `20260803205941` e
  `20260803221936`. O schema está correto; o ledger tem a entrada duplicada.
- **Locais que não constam no remoto**, entre outros:
  `20260611091522_client_portal_access_email_calendar`,
  `20260611101800_client_portal_access_links_and_folder`,
  `20260611132931_persist_consultant_settings`,
  `20260611202749_lock_down_public_portal_token_access`,
  `20260612101234_portal_account_contact_and_payment_due_date`,
  `20260612113611_client_contacts_and_payment_links`.
- **Supersedida em 04/08/2026:** `20260613125641_client_portal_audit` não deve ser aplicada. O
  conteúdo dela foi reescrito e aplicado como `20260805010139` + `20260805010218` (ver PROD-01); o
  arquivo de junho ficou no repositório só como histórico, com aviso no topo.
- **Aplicadas sob outra versão:** `20260709060000` → `20260709082424`;
  `20260717090000` → `20260717135804`; `20260802115342_portal_public_request_purpose` registrada
  como versão `20260803162735` com o nome do arquivo inteiro.
- Existe uma pasta legada `migrations/` na raiz (numeração `001_`, `002_`…), separada de
  `supabase/migrations/`. Determinar se está morta.

### Implementação

1. Para **cada** arquivo em `supabase/migrations/`, verificar se o **conteúdo** está no banco —
   comparando funções, colunas, constraints e grants reais — e não apenas se a versão consta no
   ledger. Vários foram aplicados por outro caminho e depois sobrescritos.
2. Produzir `docs/migrations-status.md` com: arquivo local → aplicado? → sob qual versão →
   observação → ação recomendada.
3. Classificar a pasta `migrations/` da raiz como viva ou morta, com evidência.
4. **Não aplicar nada em massa.** Várias dessas migrations recriam funções que foram redefinidas
   depois; reaplicar reverteria comportamento em produção.
5. Só depois, propor à Ester: `supabase migration repair` para realinhar versões, ou apenas
   documentar a divergência.

Ferramentas: MCP Supabase `list_migrations` e `execute_sql`, **somente leitura** neste card.

### Critérios de aceite

- `docs/migrations-status.md` cobre 100% dos arquivos de `supabase/migrations/`.
- Cada linha tem evidência de consulta ao schema real, não suposição.
- Nenhuma migration foi aplicada durante este card.
- A duplicata de `checklist_items_requirement_type` tem recomendação explícita.

### Resultado — 04/08/2026

O documento está em [`docs/migrations-status.md`](migrations-status.md): 23 arquivos, cada um
verificado por objeto no banco — coluna, função com assinatura e `search_path`, gatilho, policy,
índice, constraint, grant e bucket — e não pelo número da versão. Para as funções redefinidas várias
vezes, a prova foi marcador de conteúdo dentro de `pg_get_functiondef`.

**O schema de produção estava certo; o ledger é que estava sujo.** 7 arquivos de junho não
constavam, 12 constavam sob outra versão, 1 estava duplicado.

**O achado que importava:** um `supabase db push` teria tentado aplicar 19 dos 23 arquivos. Entre
eles, `20260613125641_client_portal_audit`, que **reverteria o PROD-01** — voltaria
`search_path = public` nas duas funções e recriaria as policies de update e delete na trilha de
auditoria — e `20260627120000_portal_area_scores`, que devolveria `client_portal_overview` à versão
de junho, sem pasta principal, scores por área nem estatísticas de NC.

**Corrigido em 04/08/2026, com autorização da Ester**, escrevendo só na tabela de registro: as 7
ausentes inseridas, as 12 divergentes renomeadas para a versão do arquivo, a duplicata apagada.
Hoje as 23 versões de arquivo constam no ledger e um `db push` não teria nada a aplicar.

**Segundo achado:** a entrada `026b_create_appointment_suspend_guard` está no ledger e **não tem
arquivo em lugar nenhum** — foi aplicada direto em produção e nunca commitada. A guarda de suspensão
de agendamento sobreviveu por acaso: as três migrations de agosto que redefiniram
`client_portal_create_appointment` carregaram `scheduling_suspended` adiante. Bastava uma delas ter
sido escrita sem a guarda para a suspensão parar de funcionar em silêncio.

**A pasta `migrations/` da raiz é histórica, não morta.** Último commit em 18/06/2026. 4 arquivos são
cópias byte a byte de arquivos em `supabase/migrations/`; os outros 29 são o único registro de coisas
que estão em produção (multi-tenant, RLS, bucket de fotos, o sync em lote com 3.189 linhas em
`sync_jobs`). Não apagar, não rodar — renomear para `migrations-legadas/` com um README.

**Ainda pendente, e é só repositório:** renomear a pasta `migrations/` da raiz para
`migrations-legadas/` com um README, e remover as 4 cópias byte a byte que ela tem de arquivos de
`supabase/migrations/`.

Nenhuma migration de schema foi aplicada durante este card — as escritas foram exclusivamente na
tabela `supabase_migrations.schema_migrations`.

---

# Bloco 1 — Estética

## EST-01 — Migrar as respostas da inspeção em andamento para o roteiro novo

**Modelo:** Opus 5 · **Esforço:** alto · **Depende de:** — (INFRA-01 já concluído)

**Pedido da Ester, em nome dela:** *"gostaria de migrar minhas respostas no roteiro de estética em
andamento para o novo roteiro que criamos."*

**Alvo:** inspeção `548466d6-ee61-42da-b844-76fbbfa679ce` (MEIRE BEAUTY CLINIC), hoje no roteiro
arquivado `b37caf84…` (112 itens), a ser levada para `0c55f120…` — Clínica de Estética e Saúde
(113 itens). Dados completos na seção 2.5.

### O que torna este card difícil

O roteiro novo foi **reescrito**, não editado. Medição feita em 03/08/2026: entre os 112 itens do
roteiro antigo e os 113 do novo há **zero correspondência textual exata**. Os itens antigos são
afirmações ("Possui Alvará ou Licença Sanitária vigente…") e os novos são perguntas ("Possui
Licença Sanitária vigente e compatível com as atividades declaradas?").

A boa notícia é que os roteiros são **estruturalmente paralelos**: mesma categoria, seções
equivalentes e em ordem semelhante. O mapeamento é viável, mas exige julgamento sanitário item a
item. **Não é tarefa de `LIKE` nem de similaridade de string** — um falso positivo aqui reescreve
o laudo de uma cliente real.

### Implementação

1. **Levantar** os 112 itens do roteiro antigo e os 113 do novo, com seção, texto, `weight`,
   `is_critical` e `requirement_type`.
2. **Propor o mapeamento** `item_antigo → item_novo` em `docs/estetica/mapa-migracao.md`, uma linha
   por item, com uma destas classificações:
   - `equivalente` — mesma exigência, redação diferente. A resposta migra como está.
   - `desmembrado` — um item antigo virou dois ou mais novos. Definir para qual migra e por quê.
   - `fundido` — vários antigos viraram um novo. Definir a regra de precedência do resultado.
   - `sem correspondência` — item antigo não existe mais (ex.: `est-077`, removido no Card 5 por
     falta de base legal autônoma). A resposta **não** migra.
   - `novo sem resposta` — item novo sem antecedente. Fica em branco para a Ester responder.
   Cada linha carrega um nível de confiança (`alta` / `revisar`).
3. **Submeter o mapa à Ester para revisão**, destacando primeiro os `revisar`, os `fundido` e os
   `sem correspondência`. **Não prosseguir sem o aval dela.** Este é o ponto de parada obrigatório
   do card.
4. Só depois de aprovado, escrever o script de migração, que deve:
   - preservar `result`, `situation_description`, `corrective_action`, `responsible`, `deadline`,
     `custom_description` e as fotos vinculadas;
   - **não apagar nada**: criar as respostas novas e manter as antigas via `deleted_at`, para que a
     migração seja reversível;
   - tratar os 9 `item_id` órfãos explicitamente, em vez de ignorá-los em silêncio;
   - ser idempotente — rodar duas vezes não pode duplicar resposta.
5. **Antes de tocar em produção:** exportar um backup em JSON das 124 respostas atuais e guardá-lo
   fora do repositório.
6. Ensaiar num Postgres descartável ou numa cópia da inspeção. **Pedir autorização à Ester** antes
   de executar em produção.
7. Depois de migrar, conferir na aplicação: a inspeção abre no roteiro novo, as 18 descrições e as
   13 ações corretivas estão nos itens certos, as fotos continuam vinculadas, e o score por área
   é recalculado.

### Testes

- Contagem: respostas migradas + não migradas justificadas = 121 `item_id` distintos.
- Nenhuma resposta migrada aponta para item de outro roteiro.
- Reexecução do script não cria duplicata.
- As 18 descrições e as 13 ações corretivas continuam íntegras e no item correspondente.
- Fotos continuam acessíveis.
- Reversão testada: `deleted_at` desfeito devolve o estado original.

### Critérios de aceite

- O mapa foi revisado e aprovado pela Ester **antes** da execução.
- Nenhuma resposta foi perdida ou silenciosamente descartada.
- A migração é reversível e há backup fora do repositório.
- A Ester consegue continuar a inspeção no roteiro novo sem retrabalho nos itens equivalentes.

### Fora de escopo

Migrar inspeções finalizadas (as 18 de ILPI e as demais). Se a Ester quiser depois, vira card
próprio — laudo já entregue ao cliente não se reescreve sem decisão dela.

### Resultado parcial — 03/08/2026

**Etapas 1 e 2 concluídas. Parada no ponto de revisão obrigatório (etapa 3).**

O mapa está em [`docs/estetica/mapa-migracao.md`](../estetica/mapa-migracao.md). Nada foi escrito
no banco.

Levantamento: as 12 seções dos dois roteiros correspondem uma a uma, na mesma ordem — três apenas
mudaram de nome. Isso tornou o mapeamento muito mais limpo do que a medição de similaridade
textual sugeria.

- **106 itens** com equivalência direta e confiança alta.
- **6 itens** exigem decisão da Ester, detalhados na seção 5 do mapa.
- **2 itens novos** ficam em branco (memorial descritivo; aterramento elétrico).
- Os **9 "órfãos"** não eram órfãos: são itens extras criados durante a inspeção, identificados por
  `extra|<id-da-seção>|<id>`. Como o identificador embute a seção, precisam ter o prefixo reescrito
  para a seção equivalente do roteiro novo, senão somem.
- As **3 duplicatas** (itens 1.1, 1.2 e 1.3) são pares rascunho/versão final. O app já resolve com
  `getLatestResponsesByItem`; a proposta é migrar a mais recente e preservar a antiga com
  `deleted_at`.

**O achado que mais importa:** o item 7.15 do roteiro antigo — rótulo de medicamentos manipulados,
crítico, peso 10, marcado como **não conforme** — **não tem equivalente no roteiro novo**. A seção
7 caiu de 15 para 14 itens e foi este que saiu. Sem decisão explícita, essa NC desaparece do
relatório. Proposta: fundir em 7.8, que também está como NC.

Além disso, a reclassificação de 17 itens como `good_practice` altera o score da inspeção **sem
que nenhuma resposta mude**. O impacto está tabulado na seção 2 do mapa.

### Resultado final — 03/08/2026 · concluído

A Ester revisou, decidiu os 6 itens e autorizou a execução. **Migração feita em produção.**

Duas das decisões dela não eram de migração, e sim mudanças no **roteiro**, aplicadas antes:

- **`est-002` (CNAE) passou a crítico e legal**, peso 10 — *"se não tiver, o negócio está
  irregular"*. Reancorado na RDC Anvisa nº 63/2011, a mesma do `est-001`.
- **`est-077` (medicamentos manipulados) foi reintroduzido**, contrariando a remoção do Card 5.
  A Ester foi informada do fundamento registrado em `legislacao-verificada.md` — a RDC 67/2007
  obriga a farmácia, não a clínica — e manteve a decisão. O item voltou reescrito do ponto de
  vista de quem é inspecionado (procedência e validade do manipulado em uso), citando
  RDC 63/2011 como obrigação da clínica e RDC 67/2007 como norma de origem.

O roteiro foi de 113 para **114 itens**, em código e no banco. `EXPECTED_ITEM_COUNTS` atualizado;
135 testes passando.

**Resultado da migração:** 124 de 124 respostas preservadas, **zero órfãs**, 18 descrições, 13
ações, 21 NCs e as 8 fotos intactas. Os 9 extras foram remapeados para as seções equivalentes.

**Achado que mudou o desenho durante a execução:** as fotos se vinculam a `response_id`, não a
`item_id`. Criar respostas novas — como o plano previa — deixaria as 8 fotos órfãs. A migração foi
feita **atualizando `item_id` no lugar**, o que preservou as fotos e a identidade das respostas.
Vale lembrar disso em qualquer migração futura de respostas.

Backup em `C:\Saas\backups\respostas-meire-beauty-548466d6-pre-migracao-2026-08-03.json`.

**Entrega automática ao portal:** já existia e já estava programada em `InspectionSummary.tsx`,
mas nunca disparava porque `appointment_requests.inspection_id` estava nulo. O campo foi
preenchido. Ao finalizar a inspeção online, o app agora publica o PDF, os scores e as estatísticas
de NC no portal da cliente sozinho. Detalhes na seção 9 do mapa.

---

## EST-02 — Verificar o suplemento RJ de estética ✅ concluído em 05/08/2026

**Modelo:** Sonnet 5 · **Esforço:** baixo

`src/data/estetica/suplemento-rj.ts` existe no código, referencia
`baseTemplateId: 'tpl-estetica-clinica-v1'` e está registrado em `src/data/supplementRegistry.ts`.
O levantamento de 03/08/2026 **não encontrou** um template de suplemento correspondente entre os
roteiros semeados no banco.

### Implementação

1. Determinar como suplementos são resolvidos em tempo de execução — se pelo registro em código
   (`supplementRegistry`) ou por linha no banco. Ler `src/services/templateService.ts` e
   `src/data/supplementRegistry.ts` antes de concluir.
2. Se for só código: confirmar que uma inspeção de clínica de estética em cliente do RJ recebe os
   itens do suplemento, e cobrir com teste.
3. Se exigir dado no banco: descrever o que falta semear. **Não semear sem autorização.**
4. Confirmar que `isRioState()` é usado na detecção de UF — `client.state` é texto livre e
   comparação direta com `'RJ'` já causou bug antes.

### Critérios de aceite

- Está documentado se o suplemento RJ funciona hoje, com evidência.
- Se não funciona, o que falta está descrito sem ter sido aplicado.
- Existe teste cobrindo a aplicação do suplemento para cliente do RJ.

### Resultado — 05/08/2026

**O suplemento RJ funciona hoje, por código, sem precisar de nada no banco.** A resolução é toda em
`supplementRegistry` (`src/data/supplementRegistry.ts`): `isEsteticaClinicaTemplate` casa o roteiro
tanto pelo `id` estático (`tpl-estetica-clinica-v1`) quanto pelo `name` — o que cobre o roteiro
semeado no Supabase, que tem `id` UUID mas mantém o mesmo `name`. Confirmado por consulta direta à
produção: `select name from checklist_templates where id = '0c55f120-…'` devolve exatamente
`"Roteiro de Inspeção — Clínica de Estética e Saúde"`, igual ao `name` hardcoded em
`src/data/estetica/roteiro-clinica.ts`. `isRioState(client.state)` já é o que a entrada usa — não
há comparação direta com `'RJ'`.

Achado a mais: **já existia teste cobrindo exatamente esse caso**, incluindo o cenário de UUID do
Supabase — `src/__tests__/services/checklistIntegrity.test.ts`, describe `'integração dos roteiros
de estética'`, teste `'aplica o suplemento ao roteiro de clínica seedado com UUID do Supabase'`
(linha ~209). Não foi preciso escrever teste novo; ele já passa nos 138 testes da suíte.

Nada foi alterado neste card — foi só verificação, como pedia o escopo. Nenhuma leitura em produção
foi além de um `select` de uma coluna de um template.

---

# Bloco 2 — Referências e banco de referências

## REF-01 — Catalogar os atos normativos citados nos roteiros ✅ concluído em 05/08/2026

**Modelo:** Haiku 4.5 · **Esforço:** médio

Tarefa de levantamento, sem decisão normativa. Números de partida na seção 2.6.

### Implementação

1. Extrair de `checklist_items.legislation_name` todas as referências, separando por `;`.
2. Normalizar com as funções que já existem em `src/utils/legislationRefs.ts` —
   `extractBaseLegislation` e `canonicalLegislationKey`. **Reusar, não reescrever.**
3. Produzir `docs/referencias/inventario.csv` com: chave canônica, grafias encontradas, quantos
   itens citam, em quais roteiros, se existe em `legislations`, e a URL quando houver.
4. Marcar as grafias divergentes do mesmo ato (ex.: "RDC 502/2021", "RDC ANVISA nº 502/2021").
5. Não corrigir nada, não inserir nada, não decidir vigência.

### Critérios de aceite

- O inventário cobre 100% dos itens com `legislation_name` preenchido.
- Cada linha traz a contagem de itens que a citam.
- Grafias divergentes do mesmo ato estão agrupadas.
- Nenhuma escrita em `legislations` ou `checklist_items`.

### Resultado — 05/08/2026

Entregue em [`docs/referencias/inventario.csv`](referencias/inventario.csv). Só leitura no Supabase
de produção (as duas consultas usadas estão documentadas no cabeçalho de
[`scripts/ref01-build-inventory.ts`](../scripts/ref01-build-inventory.ts), que reusa
`extractBaseLegislation` e `canonicalLegislationKey` de `src/utils/legislationRefs.ts`). Nenhuma
escrita em `legislations` ou `checklist_items`.

**Os 918 itens de checklist têm `legislation_name` preenchido — 100% de cobertura**, sem nenhum
item vazio. `extractBaseLegislation` reconheceu ao menos uma referência em todos os 918 (nenhum caiu
em "sem extração"). Total de 1.235 citações (item × ato citado), agrupadas em **57 chaves
canônicas**.

**O achado que mudou a leitura do número "~170" da seção 2.6 — e que foi corrigido na mesma sessão.**
Aquele "~170 atos normativos distintos (aprox.)" era uma estimativa manual anterior a este
inventário. A primeira versão deste inventário media só 62 chaves, bem abaixo do esperado — e a causa
raiz não era que existissem poucos atos: era um bug real em `canonicalLegislationKey` (usada também
ao vivo por `PdfPreviewModal.tsx` para deduplicar a lista de legislações do relatório). A função
extraía o "número" do ato pegando a primeira sequência de dígitos do texto, sem âncora no tipo do
ato; quando o texto bruto começava com "Art. N" antes da citação real — comum nos roteiros de ILPI,
que citam artigo e lei juntos —, o número do artigo era capturado no lugar do número da lei. Caso
concreto: a **Lei Municipal nº 1.812/2014** (RJ, citada em 19 itens) aparecia fragmentada em 5
chaves diferentes (`LEI|276|2014`, `LEI|277|2014`, `LEI|278|2014`, `LEI|279|2014`, `LEI|289|2014`) —
uma por artigo citado, em vez de uma chave só. A causa começava em `extractBaseLegislation`: o padrão
de `Lei` só reconhecia os qualificadores "Federal", "Estadual" e "Complementar"; "Municipal" não
estava na lista, o regex não casava, e o texto inteiro caía no caminho de reserva sem normalização.

O relatório inicial deste card **não corrigiu** o bug — a instrução era reusar as funções como
estavam. A Ester acionou a tarefa de correção sinalizada em segundo plano na mesma conversa, então o
fix entrou ainda em 05/08, com `docs/referencias/inventario.csv` **regerado** para refletir o número
certo:

- `extractBaseLegislation`: qualificador de `Lei` passou a reconhecer também "Municipal" e
  "Ordinária", e ganhou um grupo opcional para sigla de UF entre o qualificador e o número (cobre
  "Lei Municipal RJ nº 8.618/2024").
- `canonicalLegislationKey`: a busca do número passou a começar **depois** da posição do tipo
  reconhecido (`RDC`/`LEI`/`PORTARIA`/etc.), não do início da string — defesa em profundidade para
  qualquer outro texto que caia no caminho de reserva no futuro sem que um "Art. N" antes do tipo
  vire o número errado.
- `src/__tests__/utils/legislationRefs.test.ts` (novo, 6 casos): reproduz o caso da Lei Municipal
  1.812/2014 com artigos diferentes, cobre "Lei Municipal RJ nº ...", "Lei Ordinária ...", confirma
  que os qualificadores que já funcionavam (Federal, Estadual, sem qualificador, "Art. N da Lei...")
  continuam corretos, e testa `canonicalLegislationKey` isolada com texto bruto não limpo.

**Resultado da correção:** as 19 respostas da Lei Municipal 1.812/2014 se uniram em uma única chave
(`LEI|1812|2014`). O inventário caiu de 62 para **57 chaves canônicas** — 5 a menos, exatamente as
que eram fragmentos indevidos da mesma lei. `npm test`: 20 arquivos, **152 testes**, todos passando
(146 de antes + 6 novos). Nenhuma outra citação mudou de agrupamento — conferido comparando o CSV
antes/depois do fix, e os testes existentes de `checklistIntegrity.test.ts` (que também usam essas
duas funções) continuam passando sem alteração.

**Ainda vale para o REF-02, mesmo com o fix:** 57 provavelmente ainda não é o número final — a
correção resolveu especificamente o padrão "Art. N antes do tipo reconhecido"; outras variações de
grafia não previstas pelos 9 padrões de `extractBaseLegislation` continuam caindo no caminho de
reserva sem normalização plena. O REF-02 não deve tomar 57 como definitivo — vale revisar as linhas
com `grafias_encontradas` heterogêneas antes de cadastrar na biblioteca.

**Outros pontos do CSV, para quem for usá-lo no REF-02:**

- A linha `OUTRO||` (110 itens) não é um ato — é o balde de textos sem forma normativa reconhecível
  ("Boas Práticas", "Critério técnico de..."), majoritariamente de itens `good_practice`, que por
  definição não têm base legal vigente. Não entra na contagem de atos a cadastrar.
- 17 das 57 chaves já têm correspondência em `legislations` (`existe_em_legislations = sim`) — a
  cobertura real sobre os atos *de fato reconhecidos* já é maior do que os "10 de ~170" que a seção
  2.6 registrava, porque a base de comparação mudou.
- Nenhuma colisão de chave canônica **dentro da própria** tabela `legislations` (duas entradas da
  biblioteca virando a mesma chave) — checado e não ocorre hoje.
- Os roteiros arquivados (prefixo `[ARQUIVADO]`) continuam na coluna "roteiros" de propósito: um ato
  citado só em roteiro arquivado ainda merece entrar na biblioteca, porque inspeções antigas usam
  esse roteiro no relatório.

**Evidência:** `npm test` — 20 arquivos, 152 testes, todos passando. `npm run build` — passa. Os
dumps brutos usados como entrada (`ref01-raw.json`, `ref01-legislations.json`) não foram versionados
— são snapshot de produção, não fonte de verdade do repositório; o cabeçalho do script documenta
como regerá-los.

---

## REF-02 — Sanear a biblioteca de legislações e ligá-la aos roteiros

**Modelo:** Opus 5 · **Esforço:** alto · **Depende de:** REF-01

**Pedido da Ester:** *"precisamos ajeitar as referências e o banco de referências do app."*

Hoje a biblioteca tem 42 registros para ~170 atos citados, e só 10 se encontram. É esse abismo que
faz o relatório omitir referências (seção 2.6).

### Implementação

1. Partir do inventário do REF-01, priorizando por número de itens que citam cada ato.
2. Para cada ato, preencher em `legislations`: `name` canônico, `summary`, `url` oficial, `uf`
   (nulo quando federal) e `segments`.
3. **Verificar vigência antes de cadastrar.** Norma revogada não entra como vigente. Usar a skill
   `visa-legislacao-sanitaria`, que existe justamente para isso e proíbe citar norma de memória.
   `docs/roteiros/estetica/legislacao-verificada.md` já traz o resultado dessa verificação para os
   atos de estética — aproveitar, não refazer.
4. Preencher `checklist_items.legislation_url` nos 801 itens sem URL, a partir da biblioteca já
   saneada.
5. Corrigir os 32 registros sem UF e os 16 sem segmento.
6. Criar teste travando o invariante: **todo item com `requirement_type = 'legal'` tem
   `legislation_url`**. Boas práticas seguem sem URL, por definição.
7. Entregar em fatias, uma migration por fatia, começando pelos atos mais citados. **Cada
   aplicação em produção exige autorização.**

### Testes

- Todo item `legal` tem `legislation_url` não vazio.
- Nenhuma URL retorna 404 (amostragem com registro do que foi verificado).
- Chave canônica não colide entre atos distintos.
- Reexecução da carga não duplica registro.

### Critérios de aceite

- A cobertura da biblioteca sobre os atos citados sai de ~6% para um número acordado com a Ester,
  medido e registrado.
- Nenhuma norma revogada foi cadastrada como vigente.
- O invariante de `legislation_url` está travado por teste.
- A biblioteca continua editável pela `LegislationsManager` sem regressão.

### Fora de escopo

Reescrever o texto dos itens dos roteiros. Aqui se mexe em referência, não em pergunta.

### Resultado — 05/08/2026 · concluído no código; **a carga em produção aguarda autorização**

**Meta acordada com a Ester nesta sessão:** cobrir 100% dos atos citados pelos roteiros vivos
(opção recomendada entre três, decidida com o inventário em mãos). Os atos citados apenas por
roteiro arquivado ficaram registrados e fora da carga.

**O número real é menor do que a seção 2.6 estimava.** Não são ~170 atos: são **41** nos 6 roteiros
vivos e nos 4 suplementos regionais, mais 5 que só aparecem em roteiro arquivado. A biblioteca
cobria 13 desses 41; hoje cobre 41 de 41.

**A entrega:**

1. **`src/data/legislationLibrary.ts` (novo)** — 78 entradas, cada uma com ementa, URL oficial, UF,
   segmentos, situação de vigência e data da verificação. `legislationService.ts` passou a derivar
   dela o fallback local, em vez de manter a lista embutida.
2. **Ligação por chave canônica.** `resolveLegislationUrl` / `legislationUrlForItem` em
   `legislationRefs.ts`. O item cita a norma em texto livre e herda a URL da biblioteca. Com isso,
   os mapas `URLS` duplicados dentro dos roteiros de estética (99 + 19 + 1 referências) foram
   removidos — a divergência entre o `datalegis` dos roteiros e o `bvsms` da biblioteca acabou.
3. **Migration `20260805200700_ref02_legislation_library.sql`** — 41 updates e 37 inserts, gerada
   por `scripts/ref02-build-migration.ts` a partir da biblioteca. Casa por chave canônica, não por
   nome: `"Decreto Nº 57501 DE 30/01/2026"` e `"Decreto Rio nº 57.501/2026"` são o mesmo ato, e um
   upsert por nome criaria duplicata. Não apaga nada — a `LegislationsManager` continua editável e
   a linha "Constituição da República Federativa do Brasil", que ninguém cita, fica intacta.
   **Também não sobrescreve ementa mais rica:** a checagem antes de aplicar mostrou que várias
   ementas do banco foram ampliadas à mão (a da Lei 8.842/1994 tem 479 caracteres e explica a
   vedação de permanência de quem precisa de assistência permanente); a biblioteca só substitui
   quando o banco tem menos texto. **Aplicada em produção em 05/08/2026 com autorização da Ester.**
4. **Backfill `scripts/ref02-backfill-item-urls.mjs`** — simulação por padrão, `--apply` para
   gravar. Reusa a mesma `resolveLegislationUrl` do app em vez de reimplementar a normalização em
   PL/pgSQL; precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente.
5. **Testes** — `src/__tests__/data/legislationLibrary.test.ts` (7 casos) trava: sem colisão de
   chave, toda entrada com ementa/URL/data, norma regional com UF, **todo item legal resolve URL**,
   todo ato citado está na biblioteca, e override do item igual ao da biblioteca. Mais 5 casos
   novos em `legislationRefs.test.ts` e 1 de regressão em `pdfGenerator.test.ts`.

**Três achados que valem mais que a carga em si:**

- **A Resolução COFEN nº 358/2009 está revogada** pela 736/2024 e era citada como vigente no item
  `bh-enf-003` do suplemento de Belo Horizonte — um roteiro em uso. Citação e descrição corrigidas
  (a 736/2024 também substituiu "SAE" por "Processo de Enfermagem").
- **`pdfGenerator.ts` tinha a própria cópia de `extractBaseLegislation`**, sem as correções do
  REF-01 nem as do REF-02. A página "REFERÊNCIAS LEGISLATIVAS" de uma inspeção de ILPI em Senador
  Canedo listava a Lei Municipal 1.812/2014 cinco vezes, uma por artigo. A cópia foi removida e há
  teste de regressão. O casamento com a biblioteca, que era por substring de nome (`"RDC 15/2012"`
  casava com `"RDC 156/2006"`), passou a ser por chave canônica.
- **Mais quatro bugs de fragmentação da chave canônica**, o resto do que o REF-01 sinalizou:
  número com ponto de milhar (`"RE Anvisa nº 2.605/2006"` virava o ato número 2), tipo `RE` não
  reconhecido, ano de dois dígitos (`"344/98"` ≠ `"344/1998"`), zero à esquerda (`"02/2024"` ≠
  `"2/2024"`) e `"Art. 21"` solto virando um ato fantasma. O inventário do REF-01 cai de 57 para 52
  chaves quando regerado.

**Duas mudanças de referência que pedem o aval da Ester** (ambas seguem a decisão dela no `est-002`,
de 03/08 — escopo declarado incompatível é irregularidade sanitária, não cadastral):

- `go-003` (CNPJ/CNAE compatível com ILPI) citava *"Legislação Tributária Federal"*, que não é ato
  normativo. Era o único item legal do app sem base sanitária. Reancorado nas mesmas normas do
  `go-001`: Art. 8º da RDC 502/2021 e Art. 276 da Lei Municipal 1.812/2014.
- No suplemento de BH, as abreviações `"LM 7031/96"` e `"PM 012/15"` foram escritas por extenso
  (`Lei Municipal nº 7.031/1996`, `Portaria SMS nº 12/2015`) e a citação em bloco
  `"Resoluções COFEN nº 450/2013, 557/2017, 619/2019 e 787/2025"` foi separada por `;`. Sem isso a
  citação não casa com a biblioteca. Nenhuma pergunta de item mudou.

**Evidência:** `npm test` — 21 arquivos, **166 testes**, todos passando (eram 152 no fim do REF-01).
`npm run build` — passa.

### Aplicação em produção — 05/08/2026

Autorizada pela Ester na conversa. Aplicada pelo MCP (`apply_migration`), que registrou no ledger
sob a versão **20260805200700**; o arquivo local foi renomeado para essa versão, como manda o
INFRA-02. Backup do estado anterior das 42 linhas capturado antes da escrita.

| Verificação após aplicar | Resultado |
|---|---|
| Linhas em `legislations` | 42 → **79** (42 + 37 inseridas) |
| Com UF preenchida | 10 → **19** |
| Sem URL | **1** — só a "Constituição da República Federativa do Brasil", que ninguém cita e a migration não toca |
| Sem ementa | **0** |
| URLs ainda apontando para `datalegis` | **0** |
| Ementa curada da Lei 8.842/1994 | **preservada**, 479 caracteres |
| Grafias `RDC ANVISA` antigas | **0** — os 10 renomes aplicados |
| Nomes duplicados | **0** |

**O backfill de `checklist_items.legislation_url` também foi aplicado**, com a service role fornecida
pela Ester na conversa (usada só como variável de ambiente do comando, nunca gravada em arquivo).

| Verificação | Resultado |
|---|---|
| Itens lidos | 918 |
| Atualizados | **834** — 728 estavam vazios, 106 tinham a URL antiga do `datalegis` |
| Itens sem `legislation_url` | 800 → **72** |
| URLs apontando para `datalegis` | 106 → **0** |
| URLs distintas em uso | **41** — uma por ato, sem grafia divergente |
| Idempotência | reexecutado em simulação logo depois: **0 a atualizar** |

**Os 72 restantes não são falha da carga: são itens cuja citação não nomeia ato algum** — "Boas
Práticas", "Legislação Municipal", "Normas do Corpo de Bombeiros", "Princípios de Biossegurança".
Desses, **48 estão marcados como `legal`**, e é aí que mora a pendência real: `requirement_type`
nunca foi curado fora dos roteiros de estética. Em `templateService.ts` o padrão é `'legal'`, então
todo item de ILPI e de alimentos nasceu legal. Esses 48 provavelmente são `good_practice`, como já
são os equivalentes de estética — mas isso é decisão sanitária da Ester, não de refatoração, e vira
card próprio. Enquanto não for decidido, eles aparecem no relatório como exigência legal sem base
legal citável.

> **Resolvido pelo REF-04 em 06/08/2026.** Os 48 foram curados e a carga aplicada: itens legais sem
> URL em produção passaram de 48 para **0**. O levantamento também corrigiu duas suposições deste
> parágrafo: 47 dos 48 estavam em roteiros `[ARQUIVADO]` (não em ILPI/alimentos), e
> `requirement_type` **não** entra no cálculo do score. Ver o card REF-04.


**Deliberadamente fora:** regerar `docs/referencias/inventario.csv`, que exige dump de produção — a
`SUPABASE_SERVICE_ROLE_KEY` de `.env.vercel.production.local` vem vazia do Vercel. O delta exato
está calculado em `docs/referencias/biblioteca.md`. Também fora: reconciliar os 6 itens que o
roteiro ILPI Base Federal tem no banco (103) e não no código (97) — é card próprio.

---

## REF-03 — Fontes consultadas e links no relatório

**Modelo:** Sonnet 5 · **Esforço:** médio · **Depende de:** REF-02

**Pedido da Ester:** *"colocar nos relatórios opções de anexar link/fontes consultadas."*

### Duas partes

**(a) Corrigir a omissão silenciosa.** Em `src/utils/pdfGenerator.ts`, `drawReferencesABNT` hoje
descarta a norma quando ela não está na biblioteca com `summary`. Depois do REF-02 a cobertura
melhora, mas o comportamento continua errado: o relatório precisa **listar a norma citada mesmo
sem verbete**, com a formatação possível, em vez de sumir com ela. Se algo for omitido, o relatório
tem de dizer.

**(b) Fontes consultadas pela consultora.** Permitir anexar ao relatório uma lista de fontes
adicionais — link, título e uma nota curta —, para além das normas dos itens. É o que a Ester
chamou de "fontes consultadas".

### Implementação

1. Modelar a lista de fontes na inspeção. Confirmar antes se cabe em campo existente ou se exige
   coluna/tabela nova; havendo migration, ela segue a regra de autorização da seção 1.
2. UI de edição no fluxo de geração do relatório. O ponto natural é `PdfPreviewModal`, que já
   administra `selectedLegislations` — seguir esse padrão em vez de criar outro.
3. Validar URL na entrada e escapar na saída.
4. No PDF, uma seção "FONTES CONSULTADAS" após "REFERÊNCIAS LEGISLATIVAS", com a URL visível
   (o PDF é impresso; link clicável sozinho não basta).
5. Nas referências legislativas, exibir a URL quando `legislation_url` existir.
6. Manter o formato ABNT NBR 6023 já adotado na seção de referências.
7. Relatório sem fontes adicionais não deve ganhar seção vazia.

### Testes

- Norma citada e ausente da biblioteca **aparece** no relatório.
- Fonte adicionada aparece com título e URL.
- Inspeção sem fontes não gera seção vazia.
- URL inválida é rejeitada na entrada.
- Regressão do PDF: capa, resumo executivo, plano de ação e fotos intactos.

### Critérios de aceite

- Nenhuma norma aplicada some do relatório sem aviso.
- A consultora consegue anexar, editar e remover fontes antes de gerar o PDF.
- As fontes aparecem no PDF com URL legível em papel.
- O PDF continua abrindo em iOS e Android (há `savePdfWithFallback` justamente por isso).

### Resultado parcial — 05/08/2026

**Adiantado a pedido da Ester, antes de REF-02.** A dependência formal do card é sobre a *cobertura*
da biblioteca de legislações (REF-02); a UI e o PDF de fontes consultadas não dependem tecnicamente
disso, então as duas partes foram implementadas agora.

**(a) feito.** Em `drawReferencesABNT` (`src/utils/pdfGenerator.ts`), o filtro que só incluía a norma
se ela tivesse `name` **e** `summary` na biblioteca foi removido — toda norma citada num item
avaliado (fora `good_practice`) entra na lista, e `formatABNT` já tinha um texto de fallback pronto
para quando não há verbete na biblioteca. Antes o relatório omitia isso em silêncio; hoje não omite
mais, mesmo sem REF-02.

**(b) feito.** Fluxo completo, seguindo o padrão de `selectedLegislations` como pedia o card:

- Tipo novo `ReferenceSource` (`id`, `url`, `title?`, `note?`) e campo `Inspection.referenceSources?`
  em `src/types/index.ts`.
- Coluna aditiva `inspections.reference_sources jsonb` — migration
  `supabase/migrations/20260805121435_inspection_reference_sources.sql`, **aplicada em produção com
  autorização da Ester na conversa**. Mapeada em `src/services/inspectionService.ts`
  (`mapToPostgres`/`mapFromPostgres`).
- `PdfPreviewModal` ganhou um passo 2 novo — "Fontes Consultadas" — entre a seleção de legislações e
  a assinatura (virou passo 1/2/3 de 3). Adiciona/remove fonte com validação de URL
  (`new URL()`, só aceita `http:`/`https:`), pré-carrega a lista já salva na inspeção ao reabrir.
- `InspectionSummary.tsx` (`handleGeneratePDF`) persiste `referenceSources` na inspeção antes de
  gerar o PDF (não bloqueia a geração se a gravação falhar) e repassa para `generatePDF`.
- `generatePDF` ganha uma página nova "FONTES CONSULTADAS", só quando a lista não está vazia — não
  gera seção em branco. URL sempre impressa por extenso (`Disponível em: <url>`), no mesmo estilo
  visual da página de referências legislativas.

**Deliberadamente fora desta rodada:** não foi escrito teste automatizado novo para o modal nem para
`drawConsultedSources` — verificado manualmente (fluxo do wizard testado no browser; `npm test` com
138 testes e `npm run build` passando antes e depois). Se abrir sessão nova para fechar REF-03, vale
cobrir isso com teste antes de considerar o card fechado de verdade — e então sim aguardar REF-02
para o critério "nenhuma norma some", que hoje já não some, mas ainda cita normas sem verbete rico.

### Resultado final — 05/08/2026 · concluído

Cobertura de teste fechada, como a rodada anterior deixou pendente.

- **`src/__tests__/components/PdfPreviewModal.test.tsx` (novo, 5 casos):** adicionar fonte com
  título/nota, usar a URL como rótulo quando não há título, rejeitar link vazio e link sem
  `http/https` sem adicionar, pré-carregar fontes já salvas na inspeção ao reabrir o modal, e
  repassar `referenceSources` para `onGenerate` ao concluir o wizard.
- **`src/__tests__/utils/pdfGenerator.test.ts` (novo, 3 casos):** `drawConsultedSources` e
  `drawReferencesABNT` não são exportadas, então o teste passa pela função pública `generatePDF` e
  intercepta o que é desenhado no PDF. **Achado de implementação:** `jsPDF` anexa `text` como
  propriedade própria da instância (mixin de API aplicado no construtor), não no `prototype` —
  `vi.spyOn(jsPDF.prototype, 'text')` não intercepta nada e falha com "property not defined". A
  solução foi `vi.mock('jspdf', ...)` substituindo o módulo por uma subclasse que chama `super()` e
  depois embrulha `this.text` para capturar cada string desenhada, preservando o comportamento real.
  Os três casos: nenhuma seção "FONTES CONSULTADAS" quando `referenceSources` está vazio/ausente; a
  seção aparece com título, URL por extenso e nota quando há fonte; e uma norma citada sem verbete na
  biblioteca (`RDC 63/2011`, biblioteca vazia no teste) ainda aparece em "REFERÊNCIAS LEGISLATIVAS" —
  a correção da parte (a), que já valia desde 05/08, ganhou teste de regressão.

**Critério "nenhuma norma some" fechado sem esperar REF-02.** A leitura de 05/08 tinha deixado essa
dependência em aberto por cautela, mas o teste novo confirma que o critério já vale hoje — REF-02
melhora a *qualidade* da citação (verbete rico, URL oficial), não a *presença* dela, que já está
garantida. Por isso a dependência de REF-02 na tabela da seção 4 passou a ser só "melhora a
biblioteca", não bloqueio de aceite.

**Evidência:** `npm test` — 19 arquivos, **146 testes**, todos passando (era 138; +8 dos dois arquivos
novos). `npm run build` — passa, mesmo tamanho de bundle na faixa de sempre.

**Deliberadamente fora:** o achado de `jsPDF.text` como propriedade de instância vale para qualquer
teste futuro que precise espiar chamadas de desenho do `pdfGenerator.ts` — vale lembrar disso e reusar
o padrão de `vi.mock('jspdf', ...)` em vez de tentar `spyOn` no prototype de novo.

---

## REF-04 — Curar os itens legais que citam texto genérico em vez de ato normativo

**Modelo:** Opus 5 · **Depende de:** REF-02 (concluído) · **Esforço:** baixo

O REF-02 preencheu `checklist_items.legislation_url` a partir da biblioteca e deixou **48 itens
`requirement_type = 'legal'` sem URL** — não por falha de resolução, mas porque a citação não nomeia
ato algum: "Boas Práticas", "Normas do Corpo de Bombeiros", "Legislação Sanitária Local",
"Princípios de Biossegurança". No relatório eles saem como exigência legal sem base legal citável.

### O que o levantamento mostrou — 06/08/2026

Três coisas mudaram o enquadramento original do card, e valem para quem for reler:

1. **`requirement_type` não entra no score.** [`src/utils/scoring.ts`](../src/utils/scoring.ts) (MARP)
   usa só `weight` e `isCritical`. O campo aparece em exatamente dois pontos, ambos no PDF: o rótulo
   da linha de legislação (`pdfGenerator.ts:971`) e a exclusão da página ABNT (`pdfGenerator.ts:1276`).
   Reclassificar é questão de honestidade do relatório, **não de nota**.
2. **47 dos 48 estão em roteiros `[ARQUIVADO]`**, não em ILPI/alimentos como se supunha:

   | Roteiro | Itens | Inspeções que o usaram |
   |---|---|---|
   | `[ARQUIVADO]` Estética e Beleza | 23 | 1 (23/04/2026) |
   | `[ARQUIVADO]` Estética e Beleza (v2027) | 22 | 1 (18/05/2026) |
   | `[ARQUIVADO]` Clínica de Estética e Saúde \| RJ | 2 | 0 |
   | ILPI \| Goiás / Senador Canedo (**ativo**) | 1 | 0 |

   Os arquivados não podem ser escolhidos em inspeção nova — o filtro
   `!t.name.includes('[ARQUIVADO]')` está em `AdminTemplates.tsx:74` e `NewInspection.tsx:370` — e
   **não existem mais em `src/data/`**. Logo, a gravação é só no banco e nenhum seed pode revertê-la.
   ILPI Base Federal e alimentos: **zero** itens no conjunto; as citações deles já resolviam.
3. **O único item vivo é resíduo do próprio REF-02.** Comparando o roteiro ILPI Goiás código × banco:
   79 itens de cada lado, **1 divergência** — o `go-003`, que o REF-02 reancorou em
   `templates_ilpi_go.ts:42` mas cujo backfill só gravou `legislation_url`, nunca `legislation_name`.

Efeito real medido: 38 respostas tocam esses itens, **16 são não conformidades**, todas nas 2
inspeções arquivadas — são as 16 que hoje saem no PDF com "Base legal:" sem base legal.

### A decisão — Ester, 06/08/2026

Nenhuma decisão normativa nova foi tomada. Cada um dos 23 itens distintos tem contraparte nos
roteiros curados de 08/2026, e a decisão aplicada é a mesma que a Ester já tomou lá.

**Vira `good_practice`** (15 itens distintos, 29 linhas nos dois roteiros):

| Item arquivado | Citava | Precedente |
|---|---|---|
| Barreira de proteção descartável | Princípios de Biossegurança | `est-053` |
| Extintores | Normas do Corpo de Bombeiros | `est-095` |
| Saídas de emergência | Normas do Corpo de Bombeiros | `est-096` |
| Sinalização visível (RT, telefones) | Legislação Local; Boas Práticas | `est-107` |
| Guarda de pertences | Boas Práticas de Atendimento | `est-106` |
| Descarte de embalagens | Boas Práticas | `est-104` |
| Memorial descritivo | Boas Práticas de Gestão | `est-012` |
| Qualificação de fornecedores | Boas Práticas de Gestão | `est-015` |
| Fracionamento de produtos | Boas Práticas | `est-069` |
| Amostras grátis — temperatura | Boas Práticas de Armazenamento | `est-076` |
| Produtos à venda segregados | Legislação Municipal / Sanitária | `est-068` |
| Contingência para termolábeis | Boas Práticas de Armazenamento | `est-072` |
| Toalhas de uso individual | Legislação Municipal; Res. de Conselhos | `est-091` |
| Lavanderia terceirizada | Boas Práticas | `est-090` |
| Livro de Reclamações | Legislação do Consumidor | `est-102` |

**Continua `legal`, reancorado em ato real** (19 linhas):

| Item arquivado | Citava | Âncora | Precedente |
|---|---|---|---|
| Alvará/Licença Sanitária | Legislação Sanitária Federal e Local | RDC Anvisa nº 63/2011 | `est-001` |
| CNPJ e CNAE compatíveis | Legislação Tributária e Sanitária | RDC Anvisa nº 63/2011 | `est-002` |
| Profissionais habilitados | Lei do Exercício Prof.; Res. Conselhos | Nota Técnica Anvisa nº 2/2024 | `est-094` |
| Estabelecimento organizado e limpo | Legislação Sanitária Local | RDC Anvisa nº 63/2011 | `est-031` |
| Instruções pós-procedimento | CDC; Boas Práticas | Lei nº 8.078/1990, art. 6º, III | `est-061` |
| Publicidade não enganosa | CDC; Resoluções de Conselhos | Lei nº 8.078/1990 | `est-092` |
| TCLE por procedimento invasivo | Res. CNS 466/2012; Cód. de Ética | Lei nº 8.078/1990, art. 6º, III | `est-009` |
| Bebedouro com água potável | Boas Práticas | NR-24 | `est-098` |
| Medicamento identificado (RJ) | Lei nº 5.991/1973; legislação profissional | Lei nº 5.991/1973 | biblioteca |
| Prescrição disponível (RJ) | legislação profissional aplicável | Lei nº 5.991/1973 | biblioteca |
| CNPJ/CNAE ILPI GO (`go-003`) | Legislação Tributária Federal | Art. 8º, RDC 502/2021; Art. 276, Lei Municipal 1.812/2014 | REF-02 |

A **Lei Federal nº 5.991/1973** era lacuna real da biblioteca — ato vigente, citado por dois itens,
sem entrada. Foi catalogada; vigência e ementa conferidas no Planalto em 06/08/2026.

### Implementação

- [`src/data/legislationLibrary.ts`](../src/data/legislationLibrary.ts) — entrada nova da Lei 5.991/1973.
- [`scripts/ref04-curadoria-requirement-type.ts`](../scripts/ref04-curadoria-requirement-type.ts) —
  simulação por padrão, `--apply` para gravar. Escopa por **roteiro**, não por "citação que não
  resolve": um filtro baseado na não-resolução deixaria de reencontrar os itens que ele mesmo acabou
  de corrigir, e o script não seria idempotente. Aborta se sobrar item legal sem decisão, e aborta se
  alguma âncora da tabela não resolver na biblioteca.
- **Nada em `src/data/` para os 47** — os roteiros arquivados não existem mais no código.

### Critérios de aceite

- [x] `npx tsx scripts/ref04-curadoria-requirement-type.ts` reporta `legais sem ato e sem decisão: 0`.
- [x] Depois do `--apply`, `scripts/ref02-backfill-item-urls.ts` em simulação não lista mais nenhum
      item legal sem URL (`sem ato catalogável: 53 (legais: 0)`).
- [x] Reexecutar o script não grava nada (`a gravar: 0`, `já no estado final: 48`).
- [x] `npx vitest run` sem regressão sobre a linha de base de 162 passando.

### Fora de escopo — registrado, não executado

A lacuna maior de `requirement_type` continua aberta: o padrão de seed em
`templateService.ts:272` é `item.requirementType || 'legal'`, então **todo** item de ILPI e de
alimentos nasceu `'legal'`. Depois deste card o banco tem 889 `legal` e 54 `good_practice`, e os
`good_practice` são só de estética. Esses itens **citam ato real** (por isso não apareceram aqui),
mas parte deles é boa prática rotulada como exigência legal. Curar ILPI e alimentos é card próprio,
com decisão sanitária item a item — não cabia neste.

Vale também avaliar estender o invariante "todo item legal resolve URL" do
`legislationLibrary.test.ts` (hoje só sobre os roteiros em código) para o banco.

### Resultado — 06/08/2026 · concluído e **aplicado em produção**

Autorizado pela Ester na conversa de 06/08. `--apply` gravou os **48 itens** — 29 para
`good_practice`, 19 `legal` reancorados. Estado de `checklist_items` em produção depois da carga:

| Medida | Antes | Depois |
|---|---|---|
| `legal` | 893 | **864** |
| `good_practice` | 25 (só estética curada) | **54** |
| **Itens legais sem `legislation_url`** | **48** | **0** |

Verificações: a segunda passada do REF-04 reporta `a gravar: 0` / `já no estado final: 48` — é
idempotente. `scripts/ref02-backfill-item-urls.ts` em simulação passou a reportar
`sem ato catalogável: 53 (legais: 0)`; os 53 são boas práticas, que por definição não têm ato.
`npx vitest run`: 162 passando, 4 falhas preexistentes (`settingsStore.test.ts`, `sync.test.ts` —
confirmadas com `git stash`, sem relação com esta alteração).

**Ponta solta que apareceu na execução:** o script nasceu lendo só `process.env`, e rodá-lo direto no
PowerShell falhava com "Faltam VITE_SUPABASE_URL" mesmo com o `.env` no lugar — o Node não carrega
`.env` sozinho, quem carrega é o Vite. O REF-02 já tinha ganhado um leitor próprio no commit
`1457d49`; em vez de duplicá-lo, ele foi extraído para
[`scripts/env.ts`](../scripts/env.ts) (`requireSupabaseEnv()`) e os dois scripts passaram a usá-lo.
Script de manutenção novo deve importar de lá, não reler `process.env` na mão.

---

## REF-05 — Curar `requirement_type` nos roteiros de ILPI e de alimentos

**Modelo:** Opus 5 · **Depende de:** REF-04 (concluído) · **Esforço:** médio

O REF-04 fechou os itens que **não citavam ato algum**. Sobra a lacuna estrutural: o padrão de seed
em [`templateService.ts:272`](../src/services/templateService.ts) é `item.requirementType || 'legal'`,
e `requirement_type` só foi curado nos roteiros de estética. Todo item de ILPI e de alimentos nasceu
`'legal'` — **393 itens em 4 roteiros vivos, nenhum `good_practice`**.

### Antes de qualquer coisa: a regra que governa este card

> **A legislação de ILPI não é a de estética. Não porte o precedente de estética por analogia de
> assunto.** — Ester, 06/08/2026

O exemplo que ela deu, e que serve de teste para qualquer decisão aqui: **lavanderia**. Em estética
virou `good_practice` (`est-090`, `est-091`) porque não havia base legal vigente. Em ILPI é
exigência legal explícita — a RDC 502/2021 trata do assunto em vários artigos, e no RJ há ainda a
Lei Estadual nº 8.049/2018. Verificado no banco: os 15 itens de lavanderia/roupas dos roteiros vivos
de ILPI citam **artigo específico** da RDC 502/2021 (Arts. 14, 15, 16 VI, 29 IX–X, 47, 48, 49, 50) ou
a NR-6. Nenhum deles é candidato a boa prática.

Regra prática: **reclassificar exige mostrar que o ato citado não exige aquilo.** "Parece boa
prática" e "em estética virou boa prática" não bastam. Na dúvida, mantenha `legal`.

### As âncoras normativas de cada roteiro

Cada segmento se apoia num corpo normativo próprio, e a curadoria tem que ser lida contra **esse**
corpo — não contra o de estética. Medido no banco em 06/08/2026, por resolução da citação:

| Roteiro | Ato dominante | Cobertura |
|---|---|---|
| Serviços de Alimentação (Nacional) | **RDC Anvisa nº 216/2004** | **97 de 97 itens** |
| Serviços de Alimentação (Município RJ) | **Portaria IVISA-RIO nº 002/2020** | 102 de 114 |
| | + RDC Anvisa nº 216/2004 | 95 de 114 |
| | + Decreto Rio nº 45.585/2018 | 24 de 114 |
| ILPI (Base Federal) e ILPI Goiás | **RDC Anvisa nº 502/2021** | maioria; + Lei 10.741/2003, Lei Municipal 1.812/2014 (GO) |
| Suplemento ILPI — RJ | **Lei Estadual RJ nº 8.049/2018** | 9 de 9 |

Os cinco atos já estão na biblioteca. Nota de precisão: a lei estadual do RJ para ILPI é
**8.049/2018** (17 de julho de 2018), não 2019 — a biblioteca está com o ano certo.

O roteiro nacional de alimentos ancora **100% dos itens na RDC 216/2004**. Uma reclassificação ali
significa afirmar que a RDC 216/2004 não exige aquele ponto — afirmação forte, que precisa da leitura
do artigo, não de impressão.

### O que o levantamento de 06/08/2026 mostrou

Estado em produção, roteiros vivos de ILPI e alimentos:

| Roteiro | Seções | Itens | `legal` | `good_practice` | Inspeções |
|---|---|---|---|---|---|
| ILPI (Base Federal) | 13 | 103 | 103 | 0 | **19** |
| Serviços de Alimentação (Município RJ) | 12 | 114 | 114 | 0 | 0 |
| ILPI \| Goiás / Senador Canedo | 13 | 79 | 79 | 0 | 0 |
| Serviços de Alimentação (Nacional) | 11 | 97 | 97 | 0 | 0 |
| **Total** | | **393** | **393** | **0** | |

Há ainda o `[ARQUIVADO]` ILPI (Base Federal) (v2027), 105 itens, 0 inspeções — fora de escopo salvo
decisão em contrário.

**Três medidas que desaconselham reclassificação em massa:**

1. **Nenhum item cita fonte não normativa isolada.** Os 393 resolvem para ato real — foi o REF-02 +
   REF-04 que fecharam isso. Não existe aqui o sinal que denunciava os 48 do REF-04.
2. **204 dos 393 são críticos.** Só **4** são não críticos com peso ≤ 2, que era o perfil dos itens
   que viraram boa prática em estética. Os roteiros de ILPI e alimentos foram montados a partir de
   texto normativo, item por artigo — a suposição de que "parte deles é boa prática" não se sustenta
   como problema de massa.
3. **13 citações somam ato real e o Roteiro MPGO/UTPSS** — todas em ILPI Goiás, no formato
   `"Art. X, RDC 502/2021; Roteiro MPGO/UTPSS — <assunto>"`. **A citação do roteiro do Ministério
   Público fica.**

   > O roteiro do Ministério Público é muito importante para qualquer ILPI. Pode abaixar o peso do
   > item, mas não retirar a citação. — Ester, 06/08/2026
   >
   > Isto **revoga** a proposta inicial deste card, que tratava a menção ao MPGO/UTPSS como cauda a
   > limpar por analogia com o `"; legislação profissional aplicável"` do REF-04. Os dois casos são
   > diferentes: aquilo era enchimento vago sem fonte identificável; o Roteiro MPGO/UTPSS é fonte
   > nomeada, real e usada na fiscalização de ILPI. O ajuste possível nesses itens é de **peso**,
   > nunca de citação.

   Como o REF-03 fez `drawReferencesABNT` parar de descartar norma sem verbete na biblioteca, esses
   itens já aparecem corretamente na página de referências. Avaliar catalogar o Roteiro MPGO/UTPSS na
   biblioteca para que também resolva URL.

Conclusão honesta para quem pegar este card: o resultado provável é **poucas reclassificações e
várias limpezas de citação**. Se a curadoria terminar com quase tudo continuando `legal`, isso é um
resultado válido e deve ser registrado como tal, não forçado.

### Precondição — ✅ resolvida em 06/08/2026: o ILPI (Base Federal) está sincronizado

**Feito e aplicado em produção.** O roteiro tinha 103 itens no banco e 97 no código; agora tem
**106 dos dois lados, com zero divergência de descrição**. A direção da reconciliação foi, na maior
parte, **trazer o banco para o código** — a produção era a verdade operacional e o código é que
tinha ficado para trás:

| O que | Direção | Efeito em produção |
|---|---|---|
| 10 itens que existiam só no banco | banco → código | nenhum |
| 15 flags `isCritical` (banco `false`, código `true`) | banco → código | nenhum |
| 2 citações de artigo em que o banco estava certo | banco → código | nenhum |
| Circulações internas (`fed-004`) | banco → código | nenhum |
| Cuidadores: 1 item agregado → 4 itens | código → banco | 1 reescrito, 3 inseridos |
| Citação do descanso da enfermagem | código → banco | 1 citação ajustada |

As 2 citações que o banco tinha certas, conferidas contra o texto da RDC: **Art. 29 VI** é a "sala
administrativa/reunião" (o código dizia XII, que é o almoxarifado), e o banheiro do dormitório é o
**Art. 29 I, item 5** (o código inventava uma "alínea b do Inciso IV", que trata de banheiro
coletivo). Os 15 `isCritical` não foram julgados aqui: a diferença é uniforme numa só direção, o
que indica calibração feita pela Ester no app, e reescrever o código para refletir produção não
muda nada para ninguém. Se algum estiver errado do ponto de vista sanitário, é a curadoria deste
card, não a reconciliação.

**Como os cuidadores foram trocados sem tocar nas 18 inspeções.** A Ester pediu para aplicar só no
roteiro, sem mexer no que já foi feito. O caminho óbvio — apagar o item agregado e inserir os 4 —
não servia: 18 inspeções concluídas têm resposta nele, `responses.item_id` **não tem chave
estrangeira** para `checklist_items` (verificado no `information_schema`), e apagar a linha deixaria
18 respostas órfãs. O relatório as renderizaria na seção "Itens preservados do roteiro concluído"
com a descrição degradada para o texto da resposta — e 8 delas são não conformidades que entram no
plano de ação.

A solução foi **reescrever o item agregado no lugar**, transformando-o no `fed-076a` (a checagem da
escala de trabalho, que é o que ele já perguntava), e inserir os 3 itens por grau ao lado. Nenhuma
resposta ficou órfã, nenhum relatório mudou de forma, e as próximas inspeções passam a ter a quebra
fiel ao Art. 16 II a/b/c.

> Isso substituiu o plano de congelar os 18 snapshots antes da troca, que foi a opção escolhida em
> 06/08. Ao montar o congelamento descobriu-se que ele **não era viável nem necessário** — ver o
> achado sobre `responses.item_id` logo abaixo. A reescrita no lugar entrega o mesmo resultado sem
> escrever em nenhuma linha das inspeções.

### Achado que virou card próprio — a ligação resposta ↔ item está parcialmente quebrada

Ao verificar se dava para congelar os relatórios, apareceu algo maior. `snapshot_json`, em
`inspection_report_versions`, guarda fotos, respostas e a inspeção — mas **não guarda o roteiro**.
`resolveReportTemplate` ([`reportTemplate.ts`](../src/utils/reportTemplate.ts)) só usa o snapshot
quando ele existe e cobre todas as respostas; sem ele, cai em `buildLegacyCompletedReportTemplate`,
que reconstrói a partir do roteiro vivo.

Medindo as respostas contra o banco inteiro: **303 `item_id` distintos não existem em
`checklist_items`**. Só 31 casam com item de suplemento regional (que vive só no código, por
desenho). Os outros **272 são ids do código** — `fed-078`, `ilpi-067`, `fed-001b` — de inspeções
gravadas contra o roteiro de `src/data/` em vez do roteiro do servidor. Cada uma das 18 inspeções
concluídas tem de 6 a 21 respostas nessa situação.

Na prática esses relatórios já dependem da seção de recuperação para uma parte dos itens. **Isto é
card próprio** — é da mesma família do EST-01 — e não foi tocado aqui.

### Contexto original da precondição (mantido para referência)

Comparação descrição a descrição, código × banco:

| Roteiro | Banco | Código | Só no banco | Só no código |
|---|---|---|---|---|
| **ILPI (Base Federal)** | **103** | **97** | **12** | **6** |
| Serviços de Alimentação (Nacional) | 97 | 97 | 0 | 0 |
| Serviços de Alimentação (Município RJ) | 114 | 114 | 0 | 0 |
| ILPI \| Goiás / Senador Canedo | 79 | 79 | 0 | 0 |

Só o ILPI Base Federal diverge — e é justamente o roteiro com **19 inspeções**. A divergência não é
cosmética:

- **Circulações internas — ✅ resolvido em 06/08/2026.** O banco estava certo e o código, errado.
  O Art. 25 da RDC 502/2021 é literal:

  > Art. 25. As circulações internas principais devem ter largura mínima de 1,00 m e as secundárias
  > podem ter largura mínima de 0,80 m; contando com luz de vigília permanente.
  > § 1º Circulações com largura maior ou igual a 1,50 m devem possuir corrimão dos dois lados.
  > § 2º Circulações com largura menor que 1,50 m podem possuir corrimão em apenas um dos lados.

  O código (`fed-004`, [`templates.ts`](../src/data/templates.ts)) exigia **1,50m** nas principais e
  1,00m nas secundárias — confundiu o **limiar do § 1º** com a **largura mínima do caput**. O 1,50m
  não é largura mínima: é o ponto a partir do qual o corrimão passa a ser obrigatório dos dois lados.
  O item foi alinhado ao texto que já estava correto no banco, com a citação `Art. 25 da RDC
  502/2021` mantida.

  **Nenhuma inspeção foi julgada pelo texto errado:** as duas linhas de `checklist_items` com esse
  item (a do roteiro vivo e a do v2027 arquivado) já traziam a redação correta. O defeito estava só
  no código, e teria entrado em produção no próximo seed.
- **Cuidadores.** Banco: 1 item único com os três graus juntos (I 1:20, II 1:10, III 1:6). Código: 4
  itens separados — um por grau, mais a escala de trabalho. Muda a granularidade do que entra no
  score. Lido o Art. 16 II em 06/08/2026, **o código é o mais fiel**: a norma separa as três alíneas
  e distingue a carga horária (grau I "com carga horária de 8 horas/dia"; graus II e III "por
  turno") — distinção que o item único do banco perde. **Não aplicado**, porque desmembrar 1 item em
  4 num roteiro com 19 inspeções exige migrar respostas, como no EST-01.
  <br>Achado colateral: o item do banco cita **"Inciso I do Art. 16"**, mas as proporções de cuidador
  estão no **Inciso II**, alíneas a/b/c — o Inciso I é o Responsável Técnico com 20h semanais.
  Citação errada por um inciso; correção de um campo, sem efeito em score.
- **10 itens de infraestrutura e assistência existem só no banco** (mofo/bolor, esquadrias e vidros,
  instalações hidrossanitárias, vestiário de funcionários com área mínima, sala de descanso da
  enfermagem, PIA, iluminação e ventilação naturais, limpeza e odores, revestimentos, mobilidade).
  Foram criados direto no banco e nunca voltaram para `src/data/`. Conferidos contra o texto da RDC
  em 06/08/2026: **estão bem ancorados** — Art. 21 (habitabilidade, higiene, salubridade, segurança,
  acessibilidade), Art. 23 (instalações prediais), Art. 24 II (pisos), Art. 29 XIII (vestiário e
  banheiro de funcionários, com as áreas de 3,6 m² e 0,5 m² exatamente como na norma), Art. 46 IV e
  Art. 51. Dois não se apoiam na RDC, e corretamente não a citam: o **PIA** (Resolução CNAS 109/2009
  + Art. 50 da Lei 10.741/2003 — a RDC exige Plano de Atenção Integral à Saúde no Art. 36, não PIA) e
  a **sala de descanso da enfermagem** (Lei Federal 14.602/2023 + Lei Municipal RJ 8.618/2024). Este
  último levanta uma questão de escopo para o card: **norma municipal do RJ dentro do roteiro Base
  Federal** deveria estar no suplemento RJ, não na base.
  <br>Ou seja: a direção da reconciliação é **trazer esses 10 do banco para `src/data/`**, não
  descartá-los.

**Risco imediato, independente deste card:** um reseed do ILPI Base Federal apaga os 12 itens que só
existem no banco e ressuscita os 6 que só existem no código. Reconciliar precisa vir **antes** da
curadoria — senão a curadoria é feita sobre itens que o próximo seed descarta.

### Escopo que não aparece no banco

Os **suplementos regionais são aplicados em memória** por `getEffectiveTemplate`
([`templates.ts:355`](../src/data/templates.ts)) e **nunca passam por `checklist_items`**. Logo não
entram nos 393, mas entram no relatório do cliente:

| Suplemento | Itens | `good_practice` |
|---|---|---|
| ILPI \| Goiás / Senador Canedo | 33 | 0 |
| ILPI — Belo Horizonte (MG) | 27 | 0 |
| ILPI — Rio de Janeiro (RJ) | 9 | 0 |
| Estética — Rio de Janeiro | 1 | 0 |
| **Total** | **70** | **0** |

Os 9 do suplemento RJ citam a Lei Estadual RJ 8.049/2018 — a mesma norma que a Ester levantou. Como
vivem só no código, aqui a correção é **só em `src/data/`**, sem banco. É o inverso do REF-04.

### Implementação

1. ~~**Reconciliar o ILPI Base Federal** (precondição).~~ **✅ concluído em 06/08/2026** e aplicado em
   produção pelo [`ref05-reconcilia-ilpi-base-federal.ts`](../scripts/ref05-reconcilia-ilpi-base-federal.ts).
   106 itens dos dois lados, zero divergência. A trava de contagem em
   `src/__tests__/services/checklistIntegrity.test.ts` foi atualizada de 97 para 106.
2. **Rever o peso** dos 13 itens do ILPI Goiás que citam o Roteiro MPGO/UTPSS — e **só o peso**. A
   citação permanece integralmente, ato e roteiro do MP. Ver a decisão da Ester acima.
3. **Curadoria de `requirement_type`**, roteiro a roteiro, contra a âncora normativa daquele roteiro
   (tabela acima), com o ônus da prova invertido: um item só vira `good_practice` se o ato citado,
   lido, não exigir aquilo. Registrar a justificativa por item — o artigo consultado e o que ele diz
   — como o REF-04 fez com a coluna `precedente`. Use o
   skill `visa-legislacao-sanitaria` para ler a norma; **não cite artigo de memória.**
4. **Aplicar em código e no banco.** Diferente do REF-04: estes roteiros **existem** em `src/data/`
   (`templates.ts`, `templates_alimentos.ts`, `templates_ilpi_go.ts`), então mudar só o banco é
   revertido pelo próximo seed. Os 70 itens de suplemento são só código.
5. Reaproveitar o formato do [`ref04-curadoria-requirement-type.ts`](../scripts/ref04-curadoria-requirement-type.ts):
   tabela de decisões explícita, simulação por padrão, `--apply` separado, idempotente. Importar
   `requireSupabaseEnv` de [`scripts/env.ts`](../scripts/env.ts).

### Testes

- Estender `src/__tests__/data/legislationLibrary.test.ts` para travar o invariante já valendo hoje:
  todo item `legal` em código resolve URL. Avaliar estendê-lo ao banco, como o REF-04 sugeriu.
- A trava de contagem por roteiro **já existe** em `src/__tests__/services/checklistIntegrity.test.ts`
  (`EXPECTED_ITEM_COUNTS`) e pegou a mudança de 97 → 106 na hora. O que falta é uma trava que compare
  código **contra o banco**, não contra um número escrito à mão — foi a ausência dela que deixou o
  roteiro divergir por meses em silêncio.

### Critérios de aceite

- [x] ILPI Base Federal com o mesmo conjunto de itens em código e banco; divergência das circulações
      resolvida com evidência normativa registrada.
- [ ] As 13 citações do Roteiro MPGO/UTPSS **preservadas**; se algo mudou nesses itens, foi o peso.
- [ ] Toda reclassificação para `good_practice` acompanhada da justificativa de por que o ato citado
      não exige aquilo. **Zero reclassificação por analogia com estética.**
- [ ] Mudanças presentes em `src/data/` **e** no banco.
- [ ] `npx vitest run` sem regressão sobre a linha de base de 162 passando.

### Fora de escopo

O `[ARQUIVADO]` ILPI (Base Federal) (v2027), 105 itens — não é selecionável e não tem inspeção. Só
entra se a Ester quiser os relatórios históricos consistentes, como se fez no REF-04.

---

## REF-06 — Respostas apontando para item que não existe no banco ✅ concluído em 06/08/2026

**Modelo:** Opus 5 · **Depende de:** nada · **Esforço:** alto

Apareceu ao verificar, no REF-05, se dava para congelar os relatórios concluídos. Não é hipótese:
está medido em produção em 06/08/2026.

### O que está quebrado

`responses.item_id` **não tem chave estrangeira** para `checklist_items` — confirmado no
`information_schema`. Nada impede uma resposta de apontar para um id que não existe, e é o que
acontece: **303 `item_id` distintos** nas respostas não estão em `checklist_items`.

| Origem | Quantos | Situação |
|---|---|---|
| Itens de suplemento regional (GO, BH, RJ) | 31 | **Por desenho.** Suplementos são aplicados em memória por `getEffectiveTemplate` e nunca passam por `checklist_items` |
| **Ids do código** (`fed-078`, `ilpi-067`, `fed-001b`…) | **272** | **Defeito.** Respostas gravadas contra o roteiro de `src/data/` em vez do roteiro do servidor |

Cada uma das 18 inspeções concluídas do ILPI Base Federal tem de **6 a 21** respostas nessa
situação.

### Por que ainda não explodiu

`snapshot_json`, em `inspection_report_versions`, guarda fotos, respostas e a inspeção — mas **não
guarda o roteiro**. `resolveReportTemplate` ([`reportTemplate.ts`](../src/utils/reportTemplate.ts))
só usa o snapshot quando ele existe e cobre todas as respostas; sem ele, cai em
`buildLegacyCompletedReportTemplate`, que reconstrói a partir do roteiro vivo e joga o que não
reconhece numa seção **"Itens preservados do roteiro concluído"**, com a descrição degradada para o
texto da resposta — ou, quando não há texto, para `Item preservado do relatorio concluido (<uuid>)`.

Ou seja: a rede de segurança está funcionando e escondendo o problema. Os relatórios saem, com
parte dos itens exibidos de forma degradada.

### O que a investigação de 06/08 encontrou

O número está certo; a leitura dele, não. `scripts/ref06-diagnostico-orfas.ts` roda o
`resolveReportTemplate` de verdade sobre produção e separa órfão por desenho de estrago real:

| Origem | ids | respostas | Veredito |
|---|---|---|---|
| Id do roteiro empacotado (`fed-*`, `ilpi-*`) | 228 | 601 | Defeito, mas concentrado em **6 inspeções** |
| Suplemento regional (`rj-*`, `bh-*`) | 32 | 163 | Por desenho |
| Item avulso (`extra\|…`) | 40 | 40 | Por desenho |
| Item **apagado** do roteiro (3 uuids) | 3 | 24 | Defeito, e o mais recente |

O que degradava de verdade: **19 dos 26 relatórios concluídos, 376 respostas** — e por três causas
distintas, nenhuma delas "o id é de código":

1. **Inspeção criada antes do primeiro sync de roteiros.** `initializeDatabase(staticTemplates)`
   roda no boot e o sync remoto só 6 s depois — aparelho novo ou offline cria a inspeção presa ao
   roteiro empacotado. Última ocorrência 12/06/2026. Nessas, os `fed-*` casam com o roteiro
   empacotado e o relatório sai certo; as exceções são duas inspeções em `tpl-ilpi-v1` (roteiro que
   sumiu do app) e a de Senador Canedo.
2. **`mapFromPostgres` não preenche `city`/`state`** — as colunas nem existem em `inspections`.
   Como `resolveReportTemplate` passa a inspeção no lugar do cliente, o suplemento regional só era
   aplicado na fase online do `InspectionSummary`. Offline ou em outro aparelho, o RJ/BH sumia.
3. **Reescrever item no lugar troca a pergunta.** O `30546905…` foi "proporção Grau I" até maio,
   virou o agregado numa edição pelo editor (que também apagou Grau II, Grau III e o item da
   escala → as 24 órfãs) e, no REF-05, virou "escala de trabalho". As 18 respostas de Grau I
   passaram a ser exibidas sob a pergunta da escala nos relatórios que dependem do roteiro vivo.

### As quatro decisões do card

1. **FK: não criar.** `extra|…` e suplemento referenciam item fora da tabela legitimamente. Trava
   por teste/diagnóstico, não por constraint.
2. **Snapshot do roteiro: já existia.** `reportTemplateSnapshot` é gravado na finalização e vai no
   payload (53 das 72 versões já tinham roteiro). O congelamento filtrado por papel também já
   estava corrigido (`collaborationTemplate` usa `'ambos'` + `full`). O que faltava era snapshot
   nas inspeções antigas.
3. **Remapear `responses.item_id`: descartado.** É o caminho mais arriscado e nem sempre possível —
   a mesma linha já mudou de pergunta duas vezes, então "o item atual equivalente" às vezes não
   existe. Em vez disso, congela-se por inspeção o roteiro **da época**, que é o que
   `resolveReportTemplate` procura primeiro. Nenhuma resposta é reescrita.
4. **Causa fechada no código** (`NewInspection` espera o sync quando está online e não tem nenhum
   roteiro remoto em cache; `withClientLocation` devolve `city`/`state` a partir do cliente local).

### O que ficou no repositório

| Arquivo | Papel |
|---|---|
| `scripts/ref06-diagnostico-orfas.ts` | Só leitura. Mede quantas respostas degradam em cada relatório, online e offline. |
| `scripts/ref06-congela-roteiro-do-relatorio.ts` | Simulação por padrão, `--apply` grava. Monta o roteiro de cada relatório e congela em `inspection_report_versions`. |
| `scripts/historico/roteiros-antigos.ts` | `tpl-ilpi-v1` (commit `e6ee078`, 105 itens) e o federal de 97 itens (commit `d76b234`), reconstruídos do git. Não editar. |
| `src/utils/inspectionLocation.ts` | `withClientLocation` — completa a inspeção vinda do servidor com os dados do cliente. |

O federal de 97 itens foi conferido seção a seção contra o **PDF entregue ao Lar Recanto do Sossego
em 14/04/2026** (14/6/4/3/22/1/6/10/4/5/3/11/8 = 97). Esse mesmo PDF provou que as 26 respostas em
`fed-055..058` e `fed-083..104` **nunca apareceram no relatório entregue** — não estão na nota nem
no plano de ação, e não há texto para elas em artefato nenhum (nem no banco, nem em commit algum).
Elas saem do ar por `deleted_at`, que é reversível, junto com 2 itens avulsos criados e nunca
preenchidos. É a única perda de dado do card, e é reversível.

### Resultado (medido em 06/08, depois das duas cargas)

`npx tsx scripts/ref06-diagnostico-orfas.ts`: **0 respostas degradadas** nos 26 relatórios
concluídos, online e offline — eram 376 online e 409 offline. Todos os 26 passaram a renderizar do
próprio snapshot, portanto edição futura de roteiro não alcança mais relatório antigo. Nenhuma
resposta foi reescrita. Rodar o script de novo não faz nada: ele compara o conteúdo do roteiro com
o da última versão.

A primeira carga resolveu só metade (sobraram 208) por um erro do próprio script, que vale
registrar: ele aceitava, como fonte de texto, item que estava na seção **"Itens preservados do
roteiro concluído"** de um snapshot antigo. Essa seção *é* a degradação — o item real está lá com a
descrição trocada pelo texto da resposta. Congelar a partir dela recongela o estrago. Hoje essa
seção não é fonte de nada, e uma versão que a contenha não conta como limpa.

### Cuidados

- **Nada aqui é mecânico.** Cada mapeamento errado reescreve a inspeção de uma cliente real.
- Trabalhar sempre com simulação primeiro, como REF-02, REF-04 e REF-05.
- As inspeções concluídas são de clientes reais com relatório já entregue: o alvo é fazer o
  relatório **voltar a exibir o item corretamente**, não alterar resultado, nota ou plano de ação.
- Antes de reescrever item de roteiro no lugar, conferir num snapshot antigo qual era a pergunta.
  Preservar o vínculo não basta se o sentido muda.

---

# Bloco 3 — Correções em produção

## PROD-01 — O aviso de pagamento do portal está quebrado ✅ concluído em 04/08/2026

**Modelo:** Opus 5 · **Aplicado em produção:** migrations `20260805010139_client_portal_audit_and_payment_ack`
e `20260805010218_client_portal_audit_events_append_only_grants`

`src/services/clientPortalService.ts:243` chama a RPC
`client_portal_payment_acknowledge`, que **não existia no banco de produção** (reconfirmado em
03/08/2026). `acknowledgePayment` propaga o erro e
`ClientPortal.tsx` (`handlePaymentAcknowledgement`) mostra a mensagem de falha. O cliente clica em
"avisar pagamento" e recebe erro.

### Implementação

1. **Perguntar à Ester qual caminho ela quer**, antes de escrever código:
   - **(a)** criar a função e manter o recurso; ou
   - **(b)** remover o botão e o método do serviço.
2. Se (a): migration criando a função no molde das existentes — valida `p_token` contra
   `client_portal_accounts` (`portal_token = p_token and is_active`), registra o aviso e retorna
   `jsonb`. Decidir com a Ester onde registrar; provavelmente uma coluna
   `payment_acknowledged_at` em `client_portal_accounts` mais uma linha de auditoria.
3. `security definer`, `set search_path = ''`, `revoke all from public`,
   `grant execute to anon, authenticated` — **os dois papéis**, pelo motivo da seção 3.
4. Teste SQL novo em `supabase/tests/`, no molde de `public_briefing_only.test.sql`.
5. **Autorização explícita antes de aplicar em produção.**

### Critérios de aceite

- O cliente consegue avisar pagamento sem erro, ou o botão não existe mais — conforme a decisão.
- A função tem grant para `anon` **e** `authenticated`.
- Teste SQL cobre token válido, inválido e conta inativa.

### Resultado — 04/08/2026

**Decisão da Ester:** manter o recurso e criar a função.

**A premissa do card estava errada em um ponto.** A função não precisava ser escrita: ela já existia
pronta em `supabase/migrations/20260613125641_client_portal_audit.sql`, uma migration de junho que
nunca foi aplicada. O card dizia que ela não estava "em nenhuma migration do repositório"; estava.
Isso também significa que **PROD-01 e PROD-02 eram a mesma migration** — a função de pagamento grava
em `client_portal_audit_events`, então não havia como fazer um sem criar a tabela do outro.

O conteúdo de junho foi conferido contra o schema atual antes de qualquer coisa: `payment_updated_at`,
`client_portal_account_clients`, `appointment_attachments`, `private.my_tenant_ids` e
`private.is_tenant_staff` seguem existindo, e a tabela nunca teve `check` de `event_type` — o risco
de a auditoria voltar a falhar em silêncio por causa dos tipos novos não existe.

Foi reescrito como `20260805010139_client_portal_audit_and_payment_ack.sql`, com o endurecimento que
virou padrão depois de junho:

- `set search_path = ''` nas duas funções, com todos os identificadores qualificados;
- `revoke all from public` e `grant execute` para `anon` **e** `authenticated`;
- trilha **append-only**: só a policy de `select` para o staff, sem `update` nem `delete`, e
  privilégio de tabela reduzido a `select` para `authenticated` e nenhum para `anon`.

**Uma coisa quase passou.** O Supabase concede `all` por padrão em tabela nova do schema `public`
para `anon` e `authenticated`; o `grant select` não reduz isso. A verificação em produção mostrou
`authenticated` com insert, update e delete na trilha — a RLS barrava, mas o privilégio estava
largo. Corrigido com `20260805010218`. O Postgres descartável não pega esse caso porque lá não
existem os default privileges do Supabase; a verificação pós-aplicação pegou.

**Evidência**

| Verificação | Resultado |
|---|---|
| `supabase/tests/portal_audit_and_payment_ack.test.sql` (novo) | ✅ passa |
| Outras 5 suítes SQL | ✅ passam |
| `npm test` | ✅ 16 arquivos, 135 testes |
| Grants em produção | `anon` e `authenticated` executam as duas funções; `anon` não lê a trilha; `authenticated` só lê |
| `search_path` das funções em produção | `""` nas duas |
| Smoke em produção com token inválido | `{"error": "acesso invalido"}`, sem gravar linha |
| `get_advisors` (security) | nenhum ERROR; os WARN das duas funções são o mesmo padrão de toda RPC pública do portal |

**Deliberadamente fora**

- Não foi feito smoke com token real: gravaria "Avisou que pagou" na conta de uma cliente e mexeria
  em `payment_updated_at`. O primeiro clique real de cliente é a validação.
- A observabilidade da falha de auditoria (`console.warn` silencioso em `clientPortalService.ts:227`)
  ficou para PROD-02, que é o que sobrou dele.

---

## PROD-02 — A auditoria do portal não grava nada ✅ concluído em 04/08/2026

**Modelo:** Opus 5 · **Esforço:** baixo — o que restou era frontend

**A parte de banco já foi feita em PROD-01, em 04/08/2026.** A função `client_portal_audit_event` e
a tabela `client_portal_audit_events` existem em produção desde então, com RLS, trilha append-only e
grants para `anon` e `authenticated`. A tabela nunca teve `check` de `event_type`, então a
preocupação com os tipos novos (`main_drive_folder_opened`, `portal_tutorial_opened`,
`schedule_cta_clicked`, `support_whatsapp_clicked`) não se aplica: qualquer tipo é aceito, apenas
normalizado para minúsculo sem espaços. Este card também deixou de depender de INFRA-02.

O que sobrou é a lacuna que deixou o problema passar meses: `src/services/clientPortalService.ts:227`
engole a falha de auditoria com `console.warn`.

### Implementação

1. Trocar o `console.warn` silencioso por algo observável — no mínimo, contar as falhas e mostrar
   sinal no painel da consultora; o que não pode é seguir invisível.
2. Confirmar em produção, depois do primeiro uso real do portal, que login, visualização, download e
   aviso de pagamento estão gerando linha em `client_portal_audit_events`.

### Critérios de aceite

- Login, visualização, download e pagamento geram linha de auditoria em produção.
- Falha de auditoria passa a ser observável.

### Resultado — 04/08/2026

Duas pontas, porque a falha some de dois jeitos diferentes.

**No portal do cliente** (`src/services/clientPortalService.ts`): a auditoria continua sem derrubar
a página — isso não muda —, mas parou de ser silenciosa. O `console.warn` virou `console.error` com
o tipo do evento e a contagem de falhas desde que a página abriu, e o serviço passou a manter um
`auditHealth()` com acertos, falhas, último erro, último tipo e horário. Quem abrir o console vê o
problema na primeira linha, não perdido entre avisos.

**No painel da consultora** (`src/pages/ClientDetails.tsx`): esta era a armadilha real. Quando a
leitura da trilha falhava, o `catch` só logava e a tela mostrava *"Nenhuma atividade registrada
ainda"* — exatamente igual a um cliente que não usou o portal. Foi assim que o problema passou meses.
Agora falha de leitura tem aviso próprio, em âmbar, dizendo que **não** significa ausência de uso, com
a mensagem do erro junto.

**Evidência**

| Verificação | Resultado |
|---|---|
| `src/__tests__/services/clientPortalAudit.test.ts` (novo, 3 casos) | ✅ passa |
| `npm test` | ✅ 17 arquivos, 138 testes |
| `npm run build` | ✅ passa |

**Pendente de uso real:** a trilha em produção ainda está com **0 linhas** — ninguém entrou no portal
desde que a função foi criada, algumas horas atrás. O critério "login, visualização, download e
pagamento geram linha" só se confirma no primeiro acesso real de cliente. Vale conferir no painel de
um cliente depois do próximo login dele.

---

## PROD-03 — Agendar pelo app dava "permission denied" ✅ concluído em 04/08/2026

**Modelo:** Opus 5 · **Aplicado em produção:** migration `20260804120000_appointment_triggers_security_definer`

Qualquer agendamento pelo app logado morria com
`permission denied for function resolve_appointment_duration_minutes` (42501). Não era o mesmo
problema da seção 3 (RPC pública sem grant para `authenticated`): aqui a escrita é `insert` direto
em `public.schedules`, e quem chamava a função auxiliar era o **gatilho**.

`20260802105852` criou `private.enforce_schedule_availability`,
`private.enforce_appointment_request_availability` e
`private.enforce_appointment_block_availability` como `security invoker`, e no mesmo arquivo
revogou `private.resolve_appointment_duration_minutes` e `private.appointment_has_conflict` de
`anon` e `authenticated`. Gatilho invoker roda com os privilégios de quem grava, então o corpo
batia na revogação. Isso derrubava três caminhos: agendar/editar em `schedules`, gravar em
`appointment_requests` e criar bloqueio em `appointment_blocks`.

Correção: os três gatilhos passaram a ser `security definer`. As auxiliares continuam sem grant
para `authenticated` e a checagem de conflito passou a enxergar todas as linhas do tenant, sem
depender do RLS de quem está gravando. Verificado em produção com `insert` como `authenticated`
dentro de bloco revertido: o gatilho roda até o fim e o único erro restante é o RLS esperado por
falta de JWT no teste.

**Regra que fica:** gatilho em `private` que chama outra função de `private` precisa ser
`security definer`, ou a revogação para `authenticated` quebra a escrita.

---

## PROD-04 — Horários fantasmas: excluir agendamento não liberava a agenda ✅ código concluído em 04/08/2026

**Modelo:** Opus 5 · **Aplicado em produção:** migration `20260804140000_appointment_buffer_por_registro`
· **Pendente:** limpeza de 7 linhas em produção, aguardando autorização da Ester

Depois de PROD-03 a Ester conseguiu agendar, mas 19/08 às 13h30 respondia "horário indisponível"
com a agenda visivelmente vazia. Causa: `ScheduleService.deleteSchedule` (`src/services/scheduleService.ts`)
só marcava `schedules.deleted_at`. A `appointment_requests` vinculada continuava `confirmed`,
seguia ocupando o horário na checagem de conflito e **não aparecia na tela de Agendamentos** —
horário bloqueado por um registro invisível. O caminho inverso já era tratado:
`AppointmentAdminService.cancelRequest` cancela a solicitação **e** apaga o Schedule.

No caso concreto, a solicitação órfã era "Lar de Idosos MFS" 19/08 13:49–14:49, com
`consultant_names` nulo — e registro sem consultora bloqueia para todo mundo.

Duas correções:

1. **App:** `deleteSchedule` passou a cancelar a solicitação vinculada (`requested`, `confirmed`,
   `rescheduled`), no mesmo molde não-fatal de `syncLinkedAppointmentRequest`.
2. **Banco:** `private.appointment_has_conflict` ignora solicitação cuja agenda vinculada foi
   excluída. É a rede de segurança para o que já aconteceu, para exclusão feita offline e para
   falha de sincronização — o passo 1 é best-effort por definição.

### Pendente

Sete solicitações do tenant de produção ficaram `confirmed` com o Schedule excluído em 04/08/2026
às 14h29 (`Lar de Idosos MFS` 04/08, 06/08, 12/08, 13/08, 19/08 e 24/08; `Lar Recanto do Sossego`
07/08). Elas **não bloqueiam mais** o calendário, mas continuam aparecendo como confirmadas para o
cliente no portal. Cancelar essas linhas é mudança de dado de produção e depende de autorização
explícita da Ester.

---

# Bloco 4 — Portal 360

Cards herdados do plano aprovado em 01/08/2026, com o conteúdo preservado. P360-001 a P360-007
estão concluídos.

## P360-008 — Detalhe, notificações e calendário do compromisso ✅ concluído 06/08

**Modelo:** Sonnet 5 · **Esforço:** alto · **Prioridade:** P1

**Resultado:** o cliente recebe confirmação útil, link de reunião e opção de adicionar ao calendário.

**Desvio combinado com a Ester:** sem lembrete automático por e-mail/WhatsApp (ela já lembra os
clientes por fora) — no lugar entrou um aviso visual simples no portal ("compromisso em breve"),
calculado na leitura, sem cron. WhatsApp de confirmação/remarcação/cancelamento continua manual,
mas agora sempre aponta pro número profissional fixo da consultora (21993397315), nunca pro do
cliente — ela abre o link no WhatsApp pessoal do PC e encaminha pelo celular.

**Verificado de verdade** (não só por leitura de código): criado e apagado cliente/compromissos de
teste em produção, timeline condicional e cronograma conferidos no navegador com dados reais,
security advisors do Supabase sem alerta novo. E-mail de confirmação disparado de ponta a ponta via
SMTP real para a Ester (07/08) — chegou com texto, tipo e data corretos; o retry confirmou
`emailSent: false` na segunda tentativa (dedupe funcionando em produção, não só no teste SQL). `.ics`
reconhecido e aberto pelo Windows/Outlook como arquivo de calendário válido (import completo não
testado por falta de Outlook configurado na máquina de teste, não por limitação do código).

**Achado à parte:** a edge function `client-appointment-assets` publicada estava numa versão de
antes do P360-004 (sem `appointment_type`/`meeting_url`), o que quebrava a timeline condicional e o
link de reunião mesmo com o código novo certo. Corrigida republicando a versão atual (v4→v5).

### Implementação

- Tornar `PublicAppointmentStatus` condicional ao tipo de compromisso.
- Inspeção conserva timeline sanitária, prazo e entregáveis.
- Reuniões e orientações usam timeline simples: solicitada, confirmada, realizada/cancelada.
- Exibir link online somente após a confirmação.
- Gerar `.ics` com UID estável, timezone e suporte a atualização/cancelamento.
- Criar links para Google Calendar e Outlook sem incluir dados sanitários sensíveis.
- Atualizar e-mail/WhatsApp de confirmação, remarcação, lembrete e cancelamento.
- Deduplicar notificações com chave idempotente por evento.
- No portal, exibir um cronograma único com datas previstas e realizadas de inspeção, entrega de
  relatório, Pasta Sanitária Personalizada, auditoria e acompanhamento online, mostrando somente
  os marcos aplicáveis àquele contrato/unidade.

### Testes

- Conteúdo de e-mail por tipo de compromisso.
- ICS validado e importado em Google e Outlook.
- Link online ausente antes da confirmação e presente depois.
- Retry de notificação não envia duas mensagens.
- Suspensão financeira não apaga compromisso já confirmado; a regra exata deve estar em teste.

### Critérios de aceite

- Texto e timeline correspondem ao tipo do compromisso.
- O cliente adiciona o evento ao calendário com o horário correto.
- Remarcação atualiza o mesmo evento lógico.
- O cronograma não mostra datas fictícias para serviços não contratados.
- Nenhuma notificação contém token interno, service role ou dado técnico desnecessário.

---

## P360-009 — Início do portal orientado a próximas ações

**Modelo:** Sonnet 5 · **Esforço:** alto · **Depende de:** P360-008 · **Prioridade:** P2

**Resultado:** a primeira tela responde "o que preciso fazer agora?" antes de mostrar métricas.

### Implementação

- Extrair `PortalQuickActions`, `PortalNextAction`, `PortalAppointments`, `PortalDocuments`,
  `PortalBilling` e `PortalCompliance`.
- Mostrar primeiro: pagamento vencido, compromisso próximo, evidência devolvida, item vencido ou
  solicitação aguardando cliente.
- Prioridade determinística; nunca exibir alertas contraditórios.
- Filtro de unidade afetando indicadores, histórico e plano de ação.
- Manter financeiro e solicitações em áreas distintas.
- Preservar lista compacta/recolhível quando houver muitos itens.

### Testes

- Cada tipo de próxima ação isolado e combinado; ordem de prioridade.
- Conta com zero, uma e muitas unidades.
- Filtro de unidade e retorno a "Todas".
- Skeleton de carregamento, erro parcial e dados vazios.

### Critérios de aceite

- A próxima ação aparece acima dos indicadores no mobile.
- O cliente chega ao destino em no máximo um clique.
- Falha de notas fiscais não derruba agenda nem documentos.
- A página não usa uma grade longa de cards idênticos.

### Resultado — 07/08/2026

**Concluído no código, com uma ressalva de escopo deliberada (regra 2 da seção 1).**

`ClientPortal.tsx` (antes um único arquivo de ~800 linhas) foi decomposto em seis componentes em
`src/components/client/`: `PortalQuickActions` (já existia), `PortalNextAction`,
`PortalAppointments`, `PortalDocuments`, `PortalBilling` e `PortalCompliance`. Utilitários de data
e pagamento compartilhados foram extraídos para `src/utils/clientPortalFormat.ts`
(`toDateKey`, `parseDateParts`, `formatDateBR`, `formatCompetenceMonth`, `paymentLinks`,
`filterUnitsBySelection`, `scoreColor`), eliminando a duplicação que existia entre a página e
`ContractTimeline.tsx`.

**`PortalNextAction`** resolve um único sinal por vez, na ordem fixa do card — pagamento vencido,
compromisso próximo, evidência devolvida, item vencido, solicitação aguardando cliente — nunca
mostrando dois ao mesmo tempo. A página hoje só alimenta os dois primeiros com dado real:

- **Pagamento vencido**: deriva de `overview.payment`, considerado vencido quando `status ===
  'pending'` e (sem `due_date` ou `due_date` já passou).
- **Compromisso próximo**: primeira visita ativa dentro de 7 dias, já respeitando o filtro de
  unidade.

**O que ficou deliberadamente de fora, e por quê:** `evidence_returned`, `item_overdue` e
`request_awaiting_client` existem como tipos completos no componente — com props tipadas, render e
os 8 testes de prioridade cobrindo isolado/combinado/ordem — mas **nenhum produtor de dado real os
alimenta ainda**, porque `client_action_items` (P360-010) e `client_action_evidence`/
`client_service_requests` (P360-011/P360-012) não existem no banco. `ClientPortalSettings` já
carrega `action_plan_enabled`/`service_requests_enabled` como flags de configuração, mas isso não
substitui a tabela. Plugar os três sinais restantes é trabalho de quem implementar aqueles cards —
a interface já está pronta em `PortalNextAction.tsx`.

> **Atualização de 07/08/2026:** o P360-010 criou `client_action_items` e ligou o `item_overdue`.
> O P360-011 criou `client_action_evidence` e o estado da evidência já chega ao portal dentro de
> cada item do plano de ação — mas o sinal `evidence_returned` da **próxima ação** (a faixa do topo
> da tela) **não** foi ligado: a devolução aparece no item, não no topo. Ligar é uma linha em
> `ClientPortal.tsx`, no mesmo molde do `nextActionOverdueItem`, procurando o primeiro item com
> `evidence_status === 'changes_requested'`. Ficou de fora para não competir com o item vencido pelo
> mesmo espaço sem a Ester ter dito qual dos dois vem primeiro. Falta ainda
> `request_awaiting_client` (P360-012).

**Filtro de unidade**: `<select>` acima das seções (só aparece com >1 unidade), afeta
`PortalDocuments`, `PortalCompliance`, `PortalAppointments` e o cálculo do compromisso próximo do
`PortalNextAction`. "Plano de ação" não é filtrado porque não existe ainda (mesma ressalva acima).
Auditado como `unit_filter_changed`.

**Grade de cards eliminada**: os quatro tiles idênticos (`Em acompanhamento`/`Relatórios`/
`Fotos`/`Anexos`) viraram uma faixa compacta de 3 estatísticas em `PortalDocuments` (o
`Em acompanhamento` migrou para o cabeçalho de `PortalAppointments`), como pedia o critério de
aceite.

**Falha de notas fiscais isolada**: já era estruturalmente verdade (chamada separada com
try/catch), mas agora `PortalBilling` recebe `invoicesError` e mostra uma mensagem inline em vez
de simplesmente esconder a seção — coberto por teste (`PortalBilling.test.tsx`).

**Skeleton de carregamento**: `PortalDocuments`, `PortalBilling` e `PortalAppointments` aceitam
`loading` e renderizam um placeholder `animate-pulse`; a página ainda não passa `loading=true`
durante o fetch (mantém o spinner de tela cheia existente), então esse prop fica pronto para uso
futuro sem regressão — registrado aqui para não ser confundido com o critério "skeleton" já
cumprido nos testes de componente.

**Testes**: `PortalNextAction.test.tsx` (11), `PortalAppointments.test.tsx` (5),
`PortalDocuments.test.tsx` (4), `PortalBilling.test.tsx` (5), `PortalCompliance.test.tsx` (4) e
`clientPortalFormat.test.ts` (5) — 34 testes novos. `npm test`: 30 arquivos, **222 testes**, todos
passando (188 de antes + 34 novos). `npm run build` e `tsc -b` passam sem erro. Verificação em
browser real limitada à tela de login (sem credencial de portal para testar a área autenticada) —
sem erros de console nem de servidor.

**Novos eventos de auditoria** (`ClientPortalAuditEventType`, sem migration — `event_type` é
`text` livre no banco): `next_action_clicked` e `unit_filter_changed`.

Commit: `f783196`.

---

## P360-010 — Projeção segura do plano de ação

**Modelo:** Opus 5 · **Esforço:** alto · **Prioridade:** P1 sanitário

**Resultado:** o cliente visualiza pendências publicadas sem acesso às respostas técnicas originais.

### Implementação

- Criar `client_action_items` com RLS e índices.
- Ao publicar relatório, criar/atualizar projeções a partir das NCs autorizadas.
- Não publicar itens quando o relatório estiver oculto ou suspenso, conforme a regra vigente.
- Definir prioridade, responsável, prazo, origem e status.
- RPC de leitura por token da conta, validando o vínculo com a unidade.
- Ações de staff para publicar, ocultar, reabrir e resolver.
- Preservar histórico: item resolvido não é apagado quando uma nova inspeção é publicada.

### Testes

- Tenant e cliente cruzados negados.
- Relatório oculto não vaza item.
- Republicação idempotente.
- Item recorrente mantém rastreabilidade entre inspeções.
- Prazo vencido calculado no timezone correto.

### Critérios de aceite

- O cliente vê situação, ação recomendada, responsável, prazo e prioridade.
- O cliente não recebe IDs nem estrutura do checklist além do necessário.
- Alteração no portal não modifica `responses`.
- A consultora consegue ocultar item inadequado antes da publicação.

### Resultado — 07/08/2026 · aplicado em produção

**Concluído.** Migration `20260807102311_client_action_items` aplicada em produção com
autorização da Ester na conversa.

#### O modelo

`client_action_items` é uma **projeção**, não uma view nem um espelho de `responses`. A
publicação do relatório copia as NCs para lá; escrever nessa tabela não altera nada da inspeção,
e apagá-la inteira não perde nenhum dado técnico. `source_item_id` viaja junto só como chave de
deduplicação — a RPC de leitura do cliente **não** o devolve.

A identidade de um item aberto é `(tenant_id, client_id, source_item_id)`, garantida por um
**índice único parcial** `where status <> 'resolved'`. Dessa única decisão saem os três
comportamentos que o card pedia:

- republicar o mesmo relatório dá `update` na mesma linha (idempotente, sem somar ocorrência —
  a contagem só sobe quando o `inspection_id` muda);
- o item que reaparece na inspeção seguinte atualiza o item aberto, preserva
  `first_detected_on` e soma ocorrência (é o que o portal mostra como `Reincidente (Nx)`);
- o item já **resolvido** fica fora do índice, então nunca é sobrescrito: a recorrência nasce
  como linha nova e o histórico do que foi corrigido continua de pé.

#### Objetos criados

| Objeto | Papel |
|---|---|
| `client_action_items` | projeção; RLS ativa, `authenticated` só com **select** |
| `admin_publish_client_action_items(uuid, jsonb)` | upsert em lote na publicação do relatório; `authenticated` |
| `admin_set_client_action_item_status(uuid, text)` | publicar / ocultar / resolver / reabrir; `authenticated` |
| `client_portal_action_items(uuid, uuid)` | leitura pelo token da conta; `anon` **e** `authenticated` |

Grants conferidos em produção com `has_table_privilege`/`has_function_privilege` depois de
aplicar (não só pelo teste local — ver a memória dos default privileges): `anon` não tem nada na
tabela, `authenticated` tem só `select`, as duas RPCs de staff não são executáveis por `anon`, e
a RPC de leitura tem grant para os dois papéis.

#### Regra de visibilidade

O item nasce `hidden` quando a visita está com `report_hidden = true`, e a RPC de leitura
**reaplica o gate em tempo real** — ocultar o relatório depois some com os itens já publicados
daquela visita, e mostrar de novo os traz de volta. Item resolvido só aparece para o cliente se
um dia chegou a ser publicado (`published_at is not null`), então o que foi ocultado e depois
resolvido não vaza pelo histórico.

**Decisão registrada:** "oculto ou suspenso" foi implementado como **`report_hidden` apenas**. A
suspensão de agendamento (`scheduling_suspended`) é alavanca de inadimplência e hoje não esconde
relatório nenhum; esconder a pendência sanitária junto seria mudança de regra de produto, não
implementação deste card. Se a Ester quiser que a suspensão apague o plano de ação também, é uma
linha a mais no `where` da RPC.

#### Prazo e prioridade

`responses.deadline` é texto livre com sugestões (`Imediato`, `24 horas`, `30 dias`...).
`deadlineToDays` converte para dias corridos a partir da data da visita; o que não dá para datar
("assim que possível") vai ao portal **sem prazo**, em vez de ganhar prazo inventado. A
prioridade repete a classificação do plano de ação do PDF: crítico → `urgent`, peso ≥ 5 →
`important`, resto → `recommended`. `requirement_type` continua fora do cálculo.

Vencimento é calculado com `(now() at time zone 'America/Sao_Paulo')::date` dentro da RPC. Entre
21h e meia-noite BRT o servidor já está no dia seguinte em UTC, e um `current_date` marcaria como
vencido um item que ainda vence hoje.

#### Onde encostou no app

- `src/utils/clientActionPlan.ts` (novo) — monta a projeção a partir das mesmas NCs que
  alimentam o PDF.
- `src/pages/InspectionSummary.tsx` — publica a projeção logo depois de `setInspectionStats`,
  dentro do mesmo `try/catch` que já isolava os scores: falhar aqui não bloqueia a publicação do
  relatório.
- `src/components/client/PortalActionPlan.tsx` (novo) — seção do portal; recolhe acima de 5
  pendências, separa o histórico em `<details>`, marca vencido e reincidente.
- `src/pages/ClientPortal.tsx` — liga o sinal `item_overdue` da próxima ação (o terceiro dos três
  que o P360-009 deixou pronto e sem produtor) e carrega **notas fiscais e plano de ação em
  paralelo**: eram sequenciais, e a pendência sanitária ficava esperando a Edge Function do
  financeiro.
- `src/components/schedules/AppointmentRequestsPanel.tsx` — `ActionPlanPanel` no card da
  solicitação, com publicar / ocultar / resolver / reabrir por item.
- Evento de auditoria novo: `action_plan_viewed` (sem migration, `event_type` é `text` livre).

#### Prova de produção — feita no app, com conta de teste

Foram criados em produção uma conta de portal de teste, duas unidades (uma **fora** do acesso da
conta) e duas visitas, todas com o prefixo `[TESTE P360-010]` no nome e `0e51…` no id. As RPCs
foram exercitadas com o papel real (`set local role authenticated` + claims de staff para as de
admin, `anon` para a de leitura), e o portal foi aberto no app rodando contra o banco de
produção. Confirmado na tela:

- a faixa **"Item vencido no plano de ação"** no topo, acima dos indicadores;
- a seção **PLANO DE AÇÃO** com as três prioridades, achado, "O que fazer", responsável e prazo;
- `Prazo vencido` no item de 20/07 e nada marcado no de 14/08;
- depois de resolver um item pelo painel: `2 pendentes · 1 vencida(s) · 1 concluída(s)` e o
  resolvido no bloco **Histórico**, não apagado.

E confirmado por consulta: republicação idempotente (`created 0 / updated 1`), item da unidade
não vinculada **nunca** aparece para a conta, filtro por unidade fora do acesso responde
`unidade fora do acesso`, token inválido responde `acesso invalido`, `report_hidden` derruba os
3 itens para 0 e devolve os 3 ao ser desmarcado, item ocultado individualmente some, e
**nenhuma** das outras contas de portal ativas do tenant enxergou qualquer item de teste.

**Todos os dados de teste foram apagados ao final** e conferidos em zero (`client_action_items`,
clientes, contas e visitas com o prefixo de teste). A tabela ficou vazia em produção, como
esperado: a projeção só nasce quando um relatório novo for publicado pelo app.

#### Testes

- `supabase/tests/client_action_items.test.sql` (novo): grants e RLS, publicação, republicação
  idempotente, recorrência entre inspeções, resolvido preservado, reabertura recusada quando já
  existe item aberto para o mesmo requisito, tenant cruzado, cliente cruzado, relatório oculto,
  vencimento no fuso e o contrato do que o cliente recebe. Roda com o fixture de
  `appointment_availability.test.sql`.
- `src/__tests__/utils/clientActionPlan.test.ts` (8) e
  `src/__tests__/components/PortalActionPlan.test.tsx` (9).
- `npm test`: **239 testes, 235 passando**. As 4 falhas (`sync.test.ts`, `settingsStore.test.ts`,
  todas `storage.setItem is not a function` do `zustand/persist`) foram confirmadas **na árvore
  limpa, com `git stash`**: são anteriores a este card.
- `npx tsc -b` limpo e `npm run build` OK.

#### Fora de escopo, deliberado

- **Item que deixou de ser NC não se resolve sozinho.** Se a inspeção seguinte não aponta mais o
  requisito, o item continua aberto. É o modelo que o P360-011 exige ("a aprovação resolve o item
  somente por ação explícita da consultora") e a leitura sanitária correta: pendência fecha com
  evidência, não por ausência. Quem quiser fechar, fecha pelo botão **Resolver** do painel.
- **`P360-011` não foi antecipado**: não há upload de evidência, bucket, nem estado
  `changes_requested`. O `id` do item já sai na RPC de leitura justamente para o P360-011
  amarrar a evidência nele.
- A seção do portal não filtra por visita nem lincha o item ao PDF de origem; `visit_token` já
  vai no payload para quem quiser fazer isso depois.

Commit: `3bd8376`.

### Adendo — 08/08/2026 · projeção retroativa (`admin_backfill_client_action_items`)

**O que motivou:** a projeção só nascia quando o app publicava um relatório **novo**. Quem foi
inspecionado antes de 07/08/2026 abria o portal e via a seção vazia — pior do que não ter a
seção, porque dá a entender que não há pendência. Em produção há **16 visitas com relatório
entregue e inspeção concluída**, com ~340 NCs, e `client_action_items` estava em zero.

Migration `20260808002000_backfill_client_action_items`: cria a função, **não escreve nada** ao
ser aplicada. O default é `p_dry_run => true` — sem argumento, ela só conta o que faria.

```sql
select public.admin_backfill_client_action_items();                 -- ensaio, por visita
select public.admin_backfill_client_action_items('<visita>', false); -- uma visita, para valer
select public.admin_backfill_client_action_items(null, false);       -- todas, para valer
```

Três cuidados, porque isto mexe em dado real de cliente:

- **Não há segundo caminho de escrita.** Quem grava é o `admin_publish_client_action_items` do
  próprio card, então idempotência, recorrência entre inspeções, item já resolvido preservado e
  a regra do relatório oculto continuam valendo e continuam num lugar só. Rodar duas vezes dá
  `created 0`.
- **O roteiro vem congelado.** Peso, criticidade e texto do requisito saem do snapshot que o
  relatório usou (REF-06), não do roteiro de hoje: item reescrito ou arquivado depois da visita
  não muda a pendência que o cliente recebeu no PDF. A ordem de resolução é snapshot →
  `checklist_items` vivo → `custom_description` → rótulo genérico.
- **Só inspeção `completed`**, e só onde o chamador é staff do tenant. Inspeção em andamento
  vira plano de ação quando o relatório for publicado; antecipar mostraria pendência que ainda
  pode mudar.

`private.deadline_to_days` replica `deadlineToDays` de `src/utils/clientActionPlan.ts`,
**inclusive no que ela recusa**: o que não dá para datar ("assim que possível", "30" sem
unidade) vira item sem prazo em vez de ganhar prazo inventado.

Teste: `supabase/tests/backfill_client_action_items.test.sql` — conversão de prazo, título vindo
do roteiro congelado e não do reescrito, prioridade por criticidade e peso, prazo a partir da
data da visita, resposta apagada e conforme fora da projeção, inspeção aberta e tenant vizinho
intocados, ensaio que não escreve, backfill idempotente e a pendência chegando ao portal.

#### Aplicado e executado em produção — 08/08/2026, com autorização da Ester

`20260808105105_backfill_client_action_items` + duas correções (abaixo). Rodado em todas as 16
visitas com relatório entregue: **306 pendências criadas**, em 16 unidades. Segunda execução deu
`created 0 / updated 306` — idempotente, como projetado.

| | |
|---|---|
| Pendências projetadas | 306, todas `published` |
| Unidades alcançadas | 16 |
| Sem prazo (texto indatável) | 26 |
| Com prazo vencido hoje | 180 (visitas de junho/julho com prazo de 30 dias) |
| Título genérico (`Requisito avaliado`) | 0 — todo item resolveu descrição real |
| Contas de portal que enxergam | Rede Sênior (252 itens, 13 unidades) e MEIRE BEAUTY (20) |

As outras 34 pendências (Santorini 23 e Santa Efigênia 11) existem no banco e **não aparecem
para ninguém**: essas unidades não têm conta de portal vinculada.

#### Duas correções que a prova de produção encontrou

A conferência foi comparar item por item com os contadores que o app gravou **na publicação do
relatório** (`critical_nc_count` / `important_nc_count`), que saíram do mesmo roteiro congelado
que o PDF usou. Na primeira execução, 3 das 15 unidades com contadores divergiram. As duas
causas:

1. **`inspection_report_versions` guarda uma versão por SINCRONIZAÇÃO, não por relatório.** A
   SAENS PENA tem 5 versões; a de 06/08/2026 (sem `finalizeReport`) traz 89 itens críticos
   contra 76 na de 19/06, que é a que gerou o PDF — o `report_pdf` foi anexado 6 segundos depois
   dela. Pegar a mais recente classificava como urgente o que o cliente leu como importante.
   Corrigido: a escolha passou a ser a última versão com `finalizeReport = true`, com a mais
   recente como fallback.
2. **Item respondido que não está no snapshot do relatório.** São itens acrescentados ao roteiro
   depois da entrega e respondidos numa edição posterior (4 na SAENS PENA). O roteiro de hoje os
   traz como críticos; o relatório entregue não os continha, então o cliente foi informado sem
   severidade. Corrigido: **quando existe snapshot, só ele classifica**; o roteiro vivo só
   classifica quando a inspeção não tem snapshot nenhum (anterior ao REF-06). O **título**
   continua podendo vir do roteiro vivo — texto legível é melhor que `Requisito avaliado`, e não
   muda a gravidade do que foi dito.

Depois das duas correções: **as 15 unidades com contadores batem exatamente** em total, críticas
e importantes. A ICARAÍ não tem contadores gravados no relatório (aquela visita nunca recebeu as
estatísticas), então não há com o que comparar — os 11 itens dela vieram do snapshot dela.

A lição vale para além deste card: **contra dado real, a conferência não é "a função rodou sem
erro", é comparar com o que o cliente recebeu.** As duas correções passariam por qualquer teste
sintético.

Commits: `c50a70b` (implementação) e `217f4a0` (as duas correções + regressões).

---

## PORT-01 — Central de acesso do portal por conta ✅ concluído 07/08/2026 · aplicado em produção

**Modelo:** Opus 5 · **Esforço:** alto · **Prioridade:** P1 comercial

**O que motivou:** a Ester pediu que o cliente inadimplente **continue vendo o que já foi
entregue**, e que ela tenha, no painel, como ocultar ou programar a liberação de qualquer função
— hoje os controles ficavam espalhados entre Clientes e Agendamentos.

### O que estava espalhado, e onde

| Onde ficava | O que controlava | Escopo |
|---|---|---|
| Clientes → Portal → 💳 Pagamento | suspender agendamento, status/link/vencimento | conta |
| Clientes → Portal → ⚙️ Configurações | tutorial, acessos rápidos, agenda multiuso, plano de ação, solicitações | **tenant inteiro** |
| Clientes → ficha da unidade | pasta sanitária, auditoria, acompanhamento online | unidade |
| Agendamentos → card da solicitação | ocultar relatório, ocultar/resolver item do plano | visita / item |

Faltava o meio: **liga/desliga por conta**. Desligar "plano de ação" desligava para todos os
clientes de uma vez.

### Achado que motivou metade do card

Ligar "Suspender agendamentos" **também bloqueava o download de tudo que já tinha sido
entregue**: a Edge Function `client-appointment-assets` usava `scheduling_suspended` para decidir
se assinava a URL dos anexos (`const locked = account.scheduling_suspended === true`). O cliente
via "Relatório disponível" na lista e não conseguia abrir. Era exatamente o oposto da regra que a
Ester queria. Não era regressão deste card — estava assim desde junho.

### Implementação

- **`client_portal_account_features`** (conta × função): `released` / `hidden` / `scheduled`, com
  `release_at`, `hide_at` e `lock_when_overdue`. Ausência de linha = liberado, então só o que a
  consultora tocou vira registro. Funções cobertas, por decisão da Ester (só entrega técnica):
  relatórios e documentos, fotos, plano de ação e indicadores de conformidade.
- **`client_portal_accounts.scheduling_suspension_mode`**: `auto` (suspende sozinho no atraso) /
  `always_open` (trava manual de exceção) / `suspended` (manual permanente). A coluna antiga
  `scheduling_suspended` virou legado, mantida em sincronia só com a parte manual.
- **`client_portal_settings.overdue_grace_days`** (default **5**, escolhido pela Ester): tolerância
  depois do vencimento antes de a conta contar como em atraso.
- **`private.portal_account_gates`** é a única fonte de verdade. `client_portal_overview`,
  `client_portal_action_items`, `client_portal_create_appointment` e a Edge Function todas leem
  dela — não há regra de visibilidade duplicada em lugar nenhum.
- **Liberação programada sem cron nem job**: quem decide é a leitura, comparando com `now()` na
  hora em que o cliente abre o portal. Nada roda em segundo plano, nada pode "esquecer de rodar".
- **Edge Function republicada (v5→v6)**: o `locked` sumiu. Agora o filtro é tipo do compromisso +
  `report_hidden` da visita + travas da conta, e todo anexo visível é assinado.
- **UI**: novo modal **"Acesso do portal"** (ícone de escudo na linha da conta) com o modo de
  agendamento e as quatro funções. O toggle "Suspender agendamentos" **saiu** do modal de
  Pagamento — lá ficou só dinheiro. A tolerância entrou em Configurações do portal.
- **Portal do cliente**: aviso honesto quando algo está fechado ("Relatórios e documentos estão
  temporariamente indisponíveis... fale com a consultoria"), em vez de mostrar zero e deixar o
  cliente achar que nunca foi entregue. `PublicAppointmentStatus` parou de bloquear por
  `scheduling_suspended` e passou a bloquear pela trava.

### A regra, em uma frase

Atraso suspende **agendar**. Esconder **entrega** é decisão explícita da consultora — por conta,
por função, opcionalmente com data ou amarrada ao atraso.

### Prova de produção — feita no app, com conta de teste

Conta de teste **30 dias em atraso**, com relatório, foto e score. Confirmado na tela do portal:

- banner "Agendamentos suspensos" **automático**, sem ninguém tocar em nada;
- e, ao mesmo tempo, **1 relatório, 1 foto e conformidade 81% visíveis** — a regra que a Ester
  pediu;
- ocultando `reports` e programando `compliance`: contadores foram a zero, a seção de
  conformidade sumiu, as fotos (não tocadas) continuaram, e o aviso honesto apareceu;
- `always_open`: o botão "Agendar horário" voltou mesmo com a conta 30 dias vencida;
- na Edge Function, com a conta em atraso: os dois anexos **voltam** na resposta (antes o
  `locked` os teria deixado sem URL); ocultando `photos`, a foto some da resposta inteira e o
  relatório fica.

**Limite do teste, registrado:** a assinatura da URL em si não foi exercitada porque o fixture
aponta para objetos que não existem no Storage, e não há como subir arquivo no bucket privado sem
sessão de staff. O código não tem mais nenhum desvio de suspensão em volta da assinatura. Vale
conferir abrindo um relatório real de conta vencida.

Todos os dados de teste foram apagados e conferidos em zero.

### Impacto medido antes de aplicar

Nenhuma das três contas ativas muda de estado: CAROLINE (paga), Rede Sênior (vence 30/08, ainda
não venceu) e Samantha (sem vencimento cadastrado). **Atraso exige data de vencimento explícita** —
sem isso nada bloqueia sozinho, senão toda conta que nunca teve vencimento cadastrado seria
cortada na primeira leitura.

### Testes

- `supabase/tests/portal_feature_gates.test.sql`: grants e RLS, tudo liberado por padrão, ocultar
  função a função sem derrubar as vizinhas, liberação programada antes/depois da data, ocultação
  programada, tolerância respeitada, atraso não esconde entrega, `lock_when_overdue` fecha só o
  que foi marcado, pagamento reabre, trava manual de exceção, toggle legado migrando para o modo
  novo e tenant cruzado.
- `npm test`: 239 testes, 235 passando (as mesmas 4 falhas anteriores). `tsc -b` e `npm run build`
  limpos.

### Fora de escopo, deliberado

- Agendamento, tutorial, WhatsApp e acessos rápidos **não** entraram no liga/desliga por conta —
  a Ester escolheu "só as de entrega técnica". Agendamento tem o modo próprio; o resto continua
  sendo configuração do tenant.
- Notas fiscais não são travadas: são documento fiscal do cliente, não entrega técnica.
- A tolerância é **um número por tenant**, não por conta. Se aparecer cliente que precisa de prazo
  diferente, vira coluna em `client_portal_accounts`.
- Não há trilha de auditoria das mudanças de trava além de `updated_by`/`updated_at` na própria
  linha.

Commit: `96d344b`.

---

## P360-011 — Evidências do cliente e revisão técnica

**Modelo:** Opus 5 · **Esforço:** alto · **Depende de:** P360-010 · **Prioridade:** P1 sanitário

**Resultado:** o cliente envia prova de correção e a consultora aprova ou devolve com orientação.

### Implementação

- Criar `client_action_evidence` e bucket privado específico.
- Upload por Edge Function/RPC autenticada pelo token do portal.
- Aceitar inicialmente PDF, JPG, PNG e WEBP, com limites documentados.
- Sanitizar nome e gerar o storage path no servidor.
- Estados `pending`, `approved`, `changes_requested`.
- A aprovação resolve o item somente por ação explícita da consultora.
- Notificar equipe no envio e cliente após a revisão, com idempotência.
- Registrar auditoria sem gravar conteúdo nem URL assinada.

### Testes

- MIME permitido e proibido, tamanho máximo, arquivo vazio.
- Upload para item de outro cliente ou tenant negado.
- URL assinada expira e pode ser renovada por usuário autorizado.
- Retry não duplica evidência.
- Aprovar, devolver, reenviar e reabrir.

### Critérios de aceite

- O cliente acompanha o estado da evidência e o comentário da consultora.
- Evidência nunca fica em bucket público.
- O item não é resolvido automaticamente pelo simples upload.
- A consultora acessa o arquivo apenas com autorização e URL temporária.

### Resultado — 07/08/2026 · aplicado em produção

**Concluído.** Migration `20260807184950_client_action_evidence` aplicada em produção com
autorização da Ester na conversa, junto com o bucket privado e as duas Edge Functions.

#### As três decisões que moldaram o card

**1. Upload não resolve nada.** A evidência nasce `pending` e o item continua aberto. Resolver é
escolha explícita da consultora, e no painel são **dois botões separados** — "Aprovar" e "Aprovar e
resolver" — em vez de um botão com pergunta. Aceitar o arquivo e dar a pendência sanitária por
encerrada são decisões diferentes: a prova pode servir e a correção ainda precisar ser conferida na
próxima visita. Aprovar sem resolver está coberto por teste, em SQL e em produção.

**2. O cliente nunca escolhe onde o arquivo cai.** Nome e caminho saem do servidor
(`private.safe_evidence_file_name` + `client_portal_submit_evidence`): a extensão vem do **MIME
conferido**, não do nome enviado; o nome é transliterado e reduzido a `[a-z0-9._-]`; o caminho é
`<tenant>/<unidade>/<item>/<upload_key>-<nome>`. `../../etc/passwd` vira `passwd.pdf` e
`Laudo.pdf.exe` vira `laudo-pdf.pdf`. Não existe caminho vindo do navegador.

**3. Bucket próprio.** `client-action-evidence`, privado, 10 MB, quatro MIMEs. Não reaproveitou o
`client-portal-files` de propósito: lá existe a policy `client_portal_published_assets_select_anon`,
que libera para `anon` **todo objeto registrado em `appointment_attachments`** — e ali mora o que a
consultoria publica, não o que o cliente envia. Nenhum papel do navegador escreve neste bucket: a
única porta de escrita é a Edge Function, com service role.

#### Objetos criados

| Objeto | Papel |
|---|---|
| bucket `client-action-evidence` | privado, 10 MB, `pdf/jpeg/png/webp`; policies de select/delete só para staff do tenant |
| `client_action_evidence` | RLS ativa; `authenticated` só com **select**; `anon` sem nada |
| `client_action_evidence_notifications` | idempotência de e-mail, no molde de `appointment_notification_log` |
| `private.safe_evidence_file_name(text,text)` | nome seguro; sem grant para papel nenhum |
| `client_portal_submit_evidence(...)` | registra o envio e toda a autorização; **só `service_role`** |
| `client_portal_list_evidence(uuid,uuid)` | leitura com `storage_path` para assinar; **só `service_role`** |
| `client_portal_discard_evidence(uuid,uuid)` | desfaz o registro quando a subida falha; **só `service_role`** |
| `admin_review_client_action_evidence(...)` | aprovar/devolver, com `p_resolve_item`; `authenticated` |
| `client_portal_action_items(uuid,uuid)` | reescrita: ganhou o resumo da evidência por item |
| edge `client-action-evidence` | `list` (JSON) e `upload` (multipart); confere magic bytes, grava e avisa a equipe |
| edge `notify-evidence-reviewed` | avisa o cliente depois da revisão, deduplicado por `reviewed_at` |

Grants conferidos em produção com `has_table_privilege`/`has_function_privilege` **depois** de
aplicar: `anon` não tem nada na tabela, `authenticated` tem só `select` (nem update nem delete), as
três RPCs de envio/leitura/descarte não são executáveis por `anon` **nem por `authenticated`** — só
`service_role` —, a de revisão é só de `authenticated`, e a leitura do plano de ação continua com
grant para os dois papéis.

#### Onde a autorização mora

Toda ela no Postgres, dentro de `client_portal_submit_evidence`: token da conta, trava
`action_plan` da conta (PORT-01), vínculo do item com uma unidade do acesso, `report_hidden` da
visita, situação do item (`published`), MIME, tamanho e teto de 10 arquivos por pendência. A Edge
Function cuida só do byte. Consequência prática: o TypeScript não tem regra de acesso para
divergir do banco, e a suíte SQL testa a regra real.

A Edge Function acrescenta a única coisa que o banco não consegue: **conferir os bytes**. O tipo sai
da assinatura do arquivo (`%PDF`, `FFD8FF`, `89504E47`, `RIFF…WEBP`), não do `Content-Type` que o
navegador declarou nem da extensão. Um `.exe` renomeado para `.pdf` é recusado — verificado em
produção.

#### Idempotência

A identidade do envio é `(action_item_id, upload_key)`, com a chave gerada pelo navegador **uma vez
por arquivo escolhido** e reusada em qualquer nova tentativa. O caminho no Storage deriva dela, então
o retry reencontra a mesma linha e sobrescreve o mesmo objeto. Ordem deliberada: **registra primeiro,
sobe depois** — se a subida falhar, a Edge Function chama `client_portal_discard_evidence`, que só
apaga o que ainda está `pending` e nunca foi revisado.

As duas notificações usam o mesmo cadeado por linha: `dedupe_key` fixa no envio, e o carimbo de
`reviewed_at` na revisão — por isso `admin_review_client_action_evidence` usa `clock_timestamp()` e
não `now()`. Uma revisão nova (devolver depois de aprovar) notifica de novo; um retry, não.

#### Prova de produção — feita contra o banco e as Edge Functions reais

Conta de portal, duas unidades (uma **fora** do acesso), duas visitas e três itens de plano de ação,
todos com prefixo `[TESTE P360-011]` e ids `0e11…`. As RPCs de staff foram exercitadas com o papel
real (`set local role authenticated` + claim de um admin do tenant); as do cliente, por HTTP, com a
chave `anon`, contra a Edge Function publicada. Confirmado:

- envio válido → `pending`, `teamNotified: true` (e-mail à equipe saiu de verdade);
- **retry com a mesma chave** → `duplicate: true`, mesmo `evidence_id`, sem segundo e-mail;
- `.exe` renomeado de `.pdf` → `tipo de arquivo nao aceito`; arquivo vazio → `arquivo vazio`;
- item de unidade fora do acesso → `item fora do acesso`; token inválido → `acesso invalido`;
- URL assinada baixa o PDF (`http 200`, `application/pdf`); o mesmo objeto **sem** o token e pela
  REST com a chave `anon` → `400`; assinar com a chave `anon` → `404` (a RLS esconde o objeto);
- URL de 8s: `200` dentro da validade, `400` depois — e renovar com autorização volta a `200`;
- devolver sem orientação → recusado; devolver com orientação → o cliente recebe estado **e** texto
  no `client_portal_action_items`, e o item continua `published`;
- reenvio depois da devolução → evidência nova `pending`, a anterior preservada
  (`evidence_count: 2`);
- **aprovar sem resolver → item continua `published`**; aprovar com `p_resolve_item` → `resolved`, e
  o item passa a devolver `accepts_evidence: false`;
- travar `action_plan` na conta → envio recusado, listagem vazia e plano de ação vazio;
- auditoria com `evidence_submitted`/`evidence_reviewed` **sem caminho, sem URL e sem conteúdo**
  (conferido por regex no payload);
- nenhuma das 3 contas de portal ativas do tenant enxergou qualquer item de teste.

**Todos os dados de teste foram apagados ao final** e conferidos em zero — inclusive os dois objetos
no Storage. O bucket ficou vazio e as duas tabelas novas ficaram em zero, como esperado.

**Limite do teste, registrado:** o caminho servidor foi exercitado por HTTP com multipart real, e a
tela do portal foi coberta por 8 testes de componente (escolha do arquivo, chave de idempotência,
recusa por tamanho e por formato, erro de envio, estado e orientação da consultora). O que **não**
foi feito é o clique de ponta a ponta no navegador com uma conta real: entrar no portal exige senha
de cliente de produção. O elo não exercitado é o `supabase.functions.invoke` mandando `FormData` —
comportamento padrão do supabase-js, coberto por teste de unidade na forma do corpo. Vale um envio
real na primeira vez que a Ester usar.

**Ressalva de encoding, sem consequência:** no teste por `curl` o nome `Protocolo Vigilância.pdf`
chegou ao servidor com o `â` já corrompido pelo shell do Windows, e virou
`protocolo-vigil-ncia-2026.pdf`. Não é defeito da sanitização: chamada direta,
`private.safe_evidence_file_name('Protocolo Vigilância 2026.pdf', 'application/pdf')` devolve
`protocolo-vigilancia-2026.pdf`. Byte estranho vira `-`, que é o comportamento desejado.

#### Testes

- `supabase/tests/client_action_evidence.test.sql` (novo): grants e RLS das duas tabelas, as três
  RPCs fechadas para o navegador, sanitização de nome (travessia, extensão dupla, acento, caminho
  do Windows, nome vazio, extensão do MIME), envio que **não** resolve o item, retry sem duplicar,
  MIME/vazio/limite exato/acima do limite, unidade fora do acesso, tenant cruzado, token inválido,
  item oculto/resolvido/de relatório oculto, trava do portal, teto de 10 por pendência, descarte
  por conta certa e errada, aprovar/devolver/reenviar/reabrir, tenant cruzado na revisão, listagem
  restrita ao acesso e dedupe da notificação. Roda encadeado a `portal_feature_gates.test.sql`.
- `src/__tests__/utils/evidenceFile.test.ts` (7) e `src/__tests__/services/clientPortalEvidence.test.ts` (5).
- `src/__tests__/components/PortalActionPlan.test.tsx`: +8 casos de evidência.
- `npm test`: **259 testes, 259 passando**. As 4 falhas de `zustand/persist` citadas nos cards
  anteriores não reapareceram nesta máquina. `npx tsc -b` limpo e `npm run build` OK.
- As 7 suítes SQL rodaram em Postgres puro, todas passando.

#### Fora de escopo, deliberado

- **O sinal `evidence_returned` da próxima ação não foi ligado.** A devolução aparece dentro do item
  do plano de ação, não na faixa do topo. Ligar é uma linha em `ClientPortal.tsx`; ficou de fora
  porque disputaria espaço com o item vencido e não há decisão da Ester sobre qual vem primeiro.
- **Não há tela de "evidências para revisar" agregada.** A revisão acontece dentro do card da
  solicitação, em Agendamentos, junto do item — com um contador `N evidência(s) para revisar` no
  cabeçalho do painel. Um inbox por consultora é o P360-013.
- **Sem antivírus e sem OCR.** O que se confere é assinatura de tipo, tamanho e origem.
- **A consultora não apaga evidência pelo app.** A policy de delete no Storage existe para o staff
  do tenant, mas nenhuma tela usa: apagar prova recebida é decisão que ninguém pediu.
- **O cliente não apaga o que enviou.** Reenviar substitui na prática (o mais recente é o que vale
  para o estado do item), e o histórico fica.
- **Sem quota por conta.** O teto é de 10 arquivos **por pendência**, não por cliente.

Commit: `ae8f38c`.

---

## PORT-02 — Link do relatório por unidade e autoria da evidência ✅ concluído 07/08/2026 · aplicado em produção

**Modelo:** Opus 5 · **Esforço:** alto · **Depende de:** P360-011 · **Prioridade:** P1 comercial

**O que motivou:** a **Rede Sênior é uma rede de franquias com 13 casas atrás de UMA conta de
portal** (`mariomatheus@…`). Quem acompanha a correção em cada casa é o gestor dela — não o dono
do contrato. Não havia como dar acesso ao gestor sem entregar o login que abre as treze.

### A decisão da Ester, registrada

Ela escolheu **link do relatório sem senha**, ciente do trade-off: *"pelo que eu conheço meu
público vai ser mais fácil, mesmo ferindo um pouco a LGPD. Não tem nenhuma informação muito
sensível."* A contrapartida que ela mesma propôs, e que está implementada: **todo envio de
evidência exige nome e função de quem inseriu**. É essa assinatura que substitui a identificação
do login e sustenta o relatório depois.

A alternativa oferecida e recusada foi conta por gestor com login próprio — o banco já a suporta
(a PK de `client_portal_account_clients` é `(account_id, client_id)`, então a mesma casa pode
estar na conta do dono **e** na do gestor). Continua disponível se um dia ela mudar de ideia.

### O que o link NÃO afrouxa

- `report_hidden` fecha tudo: relatório oculto não abre por link, não lista plano de ação e não
  recebe evidência. **Ocultar o relatório no painel é o botão de pânico para um link vazado.**
- O token continua sendo o `public_token` da visita (uuid v4), que já existia.
- O arquivo continua no bucket privado, só por URL temporária.
- O link é da unidade **daquela visita e só dela**: o plano de ação sai filtrado por `client_id`,
  e o envio só é aceito para item da mesma casa. Um token não abre a casa vizinha.
- **Dinheiro não vaza**: sem conta, a resposta não traz `payment_link` nem vencimento. Cobrança é
  assunto do dono do contrato, não do gestor da casa.

### Efeito retroativo, registrado

Como o link é o `public_token` que já existia, **todo link de visita já enviado por WhatsApp nos
últimos meses passou a abrir sem login**. Não é um link novo por relatório: é o mesmo link, que
antes exigia sessão e agora não exige. Se algum relatório específico não puder ficar assim, o
caminho é **ocultar o relatório** naquela visita, no painel de Agendamentos.

### Autoria vale nos dois caminhos

Não só no link. A conta do portal é da **empresa**, não da pessoa: saber que "a conta Rede Sênior
enviou" nunca respondeu quem foi. Agora `submitted_by_name`/`submitted_by_role` são obrigatórios
por CHECK no banco, validados na RPC e no formulário, e aparecem no plano de ação, no aviso à
equipe e na auditoria. No navegador a assinatura fica guardada entre um envio e outro — quem
envia é a mesma pessoa a visita inteira, e redigitar a cada pendência faria ela desistir na
segunda.

### Objetos criados

| Objeto | Papel |
|---|---|
| `client_action_evidence.submitted_by_name/role/source` | assinatura obrigatória + por onde entrou |
| `private.register_action_evidence(...)` | **uma regra só** de registro, usada pelos dois caminhos |
| `public_report_action_items(uuid)` | plano de ação pelo link; `anon` **e** `authenticated` |
| `public_report_submit_evidence(...)` | envio pelo link; **só `service_role`** |
| `public_report_list_evidence(uuid,uuid)` | leitura para assinar URL; **só `service_role`** |
| `public_report_discard_evidence(uuid,uuid)` | desfaz registro órfão; **só `service_role`** |
| edge `client-action-evidence` v2 | aceita `visitToken` além de `accountToken` |
| edge `client-appointment-assets` v7 | abre sem `accountToken`, aplicando só o `report_hidden` |

A assinatura antiga de `client_portal_submit_evidence` (sem autoria) foi **derrubada de
propósito** — deixá-la viva manteria uma porta para evidência anônima. Há teste que falha se ela
reaparecer.

### Prova de produção — contra a visita real da Icaraí

Token `99f3…3521b`, REDE SÊNIOR ICARAÍ, 44 anexos:

- abre **sem login**: `access_mode: report_link`, 44 anexos, **44 URLs assinadas**, e
  `payment_link: null`;
- o caminho **logado não regrediu**: mesma visita com o token da conta devolve `access_mode:
  account`, 44 anexos assinados e as travas da conta intactas;
- conta de **outro cliente** mirando a mesma visita: `solicitacao fora do acesso do cliente`;
- token inexistente: `link invalido`;
- `anon` chamando `public_report_submit_evidence` direto pela REST: **`permission denied`** — o
  registro só passa pela Edge Function.

Nenhum dado de teste foi criado em produção nesta etapa: a prova usou uma visita que já existia,
em leitura.

### Testes

- `supabase/tests/report_link_and_evidence_authorship.test.sql` (novo): grants, assinatura
  obrigatória nos dois caminhos, envio e retry pelo link, link não alcança a casa vizinha nem
  outro tenant, relatório oculto fechando as três RPCs, o que o link devolve (sem
  `storage_path`, sem `source_item_id`), trava por conta **não** alcançando o link, origem e
  assinatura gravadas, descarte restrito à própria origem, e a revisão continuando explícita.
- `npm test`: **266 testes, 266 passando**. `tsc -b` e `build` limpos.

### Fora de escopo, deliberado

- **Não há link por gestor nem revogação de link individual.** O link é o da visita; fechar é
  ocultar o relatório.
- **A trava `action_plan` por conta não alcança o link** — é trava de CONTA, e o link não tem
  conta. Está coberto por teste para ficar registrado como decisão, não esquecimento.
- Não há e-mail/usuário único em `client_portal_accounts`: se um dia forem criadas contas por
  gestor, cada um precisa de identificador próprio, senão o login fica ambíguo.

Commit: `df3eca0`.

---

## REL-03 — Evidência do cliente na nova vistoria e no relatório final ✅ concluído 07/08/2026

**Modelo:** Opus 5 · **Esforço:** alto · **Depende de:** PORT-02 · **Prioridade:** P1 sanitário

**O que motivou, na voz da Ester:** *"quando abre um novo relatório pra esse cliente, esse
relatório precisa estar ventilado pra essas imagens e textos que o cliente escreveu no plano de
ação dele que ele fez, pra de fato eu garantir que de fato foi cumprido. E aí ficar salvo num
relatório final."*

**A quebra que existia:** o P360-011 fez o cliente mandar a prova, mas ela ficava só no painel
de Agendamentos, no card da visita antiga. A tela em que a decisão sanitária acontece — o
roteiro, dentro da casa, marcando *cumpre* ou *não cumpre* — não sabia que o protocolo tinha
chegado em julho.

### O elo

`client_action_items.source_item_id` **é o id do item do roteiro**, o mesmo `itemId` das
respostas da inspeção. Foi por isso que ele existe desde o P360-010. Com ele a alegação do
cliente encontra o requisito que está sendo avaliado agora, sem chave nova e sem FK nova.

### Na vistoria

`ClientEvidenceService.byItemForClient(clientId)` devolve tudo que o cliente já enviou, agrupado
pelo item do roteiro. A caixa **"Plano de ação anterior"** do `ChecklistItem` ganhou um painel
com: o que ele alegou, **quem assinou (nome e função)**, quando, o estado da revisão e o arquivo
— que abre por URL temporária assinada no clique.

**Offline:** a busca é best-effort e roda **fora do `await`** da abertura do roteiro. Sem sinal a
vistoria abre igual, só sem a alegação na tela. Nada de rede pode segurar a consultora na porta
da ILPI. O texto, que é o que sustenta a decisão, fica em memória durante a visita; só a imagem
depende de conexão no momento do clique.

### No relatório final

Regra escolhida pela Ester: **registro textual sempre, imagem só do que ela aprovou.**

- **Item que voltou a ser NC**: a alegação sai dentro do próprio bloco da não conformidade, ao
  lado do achado desta visita. É a leitura que sustenta a reincidência — "ele disse que
  protocolou em julho, e em agosto o alvará continua vencido".
- **Item que esta vistoria confirmou como cumprido**: seção própria **"EVIDÊNCIAS APRESENTADAS
  PELO CLIENTE"**, com `EV-001`, o selo `REGULARIZADO` e a frase que impede a leitura errada:
  *"A conclusão de cada pendência é a verificação em campo desta inspeção, e não o recebimento
  do arquivo."*
- **Imagem recusada ou sem revisão não vira figura** — entra como registro de texto. O PDF de
  ILPI já é pesado com as fotos da consultora; carregar arquivo que não serve dobraria o
  tamanho à toa.

### Onde encostou

| Arquivo | O quê |
|---|---|
| `src/services/clientEvidenceService.ts` (novo) | busca por `source_item_id`, assina URL, baixa a imagem aprovada como data URL |
| `src/components/inspection/ChecklistItem.tsx` | painel "O que o cliente enviou" dentro do item |
| `src/pages/InspectionExecution.tsx` | carrega a evidência ao abrir, sem bloquear o roteiro |
| `src/utils/pdfGenerator.ts` | `drawClientEvidence` + a seção dos regularizados |
| `src/pages/InspectionSummary.tsx` | `prepareForReport` na geração do PDF, com `catch` que não derruba o relatório |

### Testes

- `src/__tests__/services/clientEvidenceService.test.ts` (6): agrupamento pelo item do roteiro,
  item do plano que sumiu ignorado em silêncio, cliente sem plano não dispara a segunda
  consulta, **só imagem aprovada é embutida** (devolvida e PDF ficam de fora), e falha ao baixar
  não derruba a geração.
- `src/__tests__/utils/pdfGenerator.test.ts` (+6): sem evidência o relatório sai idêntico ao de
  antes; NC leva a alegação junto do achado; regularizado ganha seção própria; estados `pending`
  e `changes_requested` saem com o rótulo certo; envio sem assinatura vira "não identificado";
  item que sumiu do roteiro é ignorado.
- **Conferido em PDF de verdade**, gerado e extraído com `pdftotext`: os dois blocos saem dentro
  da caixa, com quebra correta e sem vazar para o rodapé (o modo de falha registrado na memória
  do projeto).
- `npm test`: **278 testes, 278 passando**. `tsc -b` e `build` limpos.

### Fora de escopo, deliberado

- **A evidência não é pré-baixada para uso offline.** Se a consultora abrir o roteiro sem sinal,
  não há alegação na tela. Guardar no Dexie exigiria tabela nova e traria arquivo de até 10 MB
  para o celular; não foi pedido.
- **Nada aqui resolve pendência sozinho.** Continua valendo o modelo do P360-010: quem fecha é a
  consultora, agora com a vistoria em campo como confirmação.
- O relatório não traz a imagem em tamanho cheio nem galeria; entra na mesma grade de fotos do
  restante do laudo.

Commit: `15fd415`.

---

## P360-012 — Solicitações estruturadas de consultoria

**Modelo:** Opus 5 · **Esforço:** alto · **Prioridade:** P2

**Resultado:** o cliente abre demandas rastreáveis sem criar um chat livre.

### Implementação

- Criar `client_service_requests` e `client_service_request_events`, tenant-scoped.
- Formulário curto com unidade, categoria, assunto, descrição e anexo opcional.
- SLA inicial apenas informativo e configurável; não prometer prazo sem regra administrativa.
- Painel interno com filtros, responsável, prioridade e histórico.
- E-mail/WhatsApp opcional na criação e na mudança para "aguardando cliente".
- Rate limit e prevenção de duplicidade por submissão.

### Testes

- Criar e ler somente dentro da conta vinculada.
- Mudanças de status permitidas por papel.
- Anexo seguro e limite de envio.
- Duplo clique e retry.
- Estados vazio, erro e solicitação encerrada.

### Critérios de aceite

- O cliente vê número, categoria, data, status e última atualização.
- A consultora distingue claramente o que aguarda cliente do que aguarda equipe.
- Não existe conversa em tempo real nem expectativa de resposta instantânea.
- Solicitações não aparecem misturadas com agendamentos.

### Resultado — 08/08/2026 · aplicado em produção

**Concluído.** Migration `20260808105015_client_service_requests` aplicada em produção com
autorização da Ester na conversa, junto com as duas edge functions. Grants, RLS e bucket
conferidos no banco depois de aplicar (ver abaixo).

#### O modelo

Uma solicitação é uma **demanda numerada**, não uma conversa. Três decisões estruturais, e cada
uma existe para impedir que isto vire caixa de entrada:

1. **Não é chat.** Não há campo de mensagem livre nos dois sentidos. O cliente abre a demanda
   com assunto e descrição e só volta a escrever quando a solicitação está em
   `awaiting_client` — quer dizer, quando a consultoria perguntou alguma coisa. Fora disso o
   campo de resposta não existe na tela, e a RPC recusa (`esta solicitacao nao esta aguardando
   resposta sua`).
2. **Prazo não se promete sozinho.** `sla_days` sai de `client_portal_settings.service_request_sla`
   (jsonb por categoria, configurável na tela), é **congelado na linha** no momento da abertura e
   nasce nulo quando nada foi configurado. Sem regra administrativa, o portal não fala em prazo:
   não estima, não escreve "em breve". Mudar a configuração depois não reescreve o que já foi
   dito a ninguém.
3. **Quem espera quem é derivado, nunca digitado.** `private.service_request_waiting_on(status)`
   é a única fonte da distinção, no portal e no painel. Não existe marcar "aguardando cliente" e
   esquecer de mudar o status.

#### Objetos criados

| Objeto | Papel |
|---|---|
| `client_service_requests` | a demanda; RLS ativa, `authenticated` só com **select** |
| `client_service_request_events` | histórico append-only; `visible_to_client` default **false** |
| `client_service_request_notifications` | cadeado de idempotência do e-mail (mesmo desenho do P360-008/011) |
| `client_portal_settings.service_request_sla` | prazo informativo por categoria; `{}` = não promete nada |
| bucket `client-service-request-files` | privado, próprio; nenhum papel do navegador escreve |
| `client_portal_create_service_request(...)` | abertura pelo token da conta; `anon` **e** `authenticated` |
| `client_portal_service_requests(uuid, uuid)` | leitura pelo token; `anon` **e** `authenticated` |
| `client_portal_reply_service_request(...)` | resposta do cliente, só em `awaiting_client` |
| `client_portal_attach_service_request_file(...)` | registro do anexo; **só `service_role`** |
| `client_portal_discard_service_request_file(...)` | desfaz o registro quando a subida falha; **só `service_role`** |
| `admin_update_service_request(...)` | status, prioridade, responsável e nota num gesto; `authenticated` |
| `admin_set_service_request_sla(uuid, jsonb)` | configura o prazo informativo; `authenticated` |

#### Papel, duplicidade e rate limit

- **Cancelar é só do administrador.** Consultora atende, prioriza, pergunta, conclui e reabre;
  cancelar apaga a demanda da vista do cliente sem entregar nada, e é a única ação daqui sem
  volta prática. A checagem é `tenant_users.role = 'admin'`, ao lado do `is_tenant_staff` que
  vale para o resto.
- **Perguntar ao cliente exige dizer o quê** (`p_note` obrigatório em `awaiting_client`) e a
  nota vira visível **à força** — mesma regra do `changes_requested` do P360-011. Perguntar sem
  dizer o que se quer devolve o cliente para o zero.
- **Duas travas de duplicidade.** A primeira é `(tenant_id, submission_key)`: a chave nasce com
  o formulário no navegador, então clique duplo e retry de rede caem na mesma linha, com o mesmo
  número. A segunda é por conteúdo — mesma unidade, mesmo assunto, ainda aberta, nos últimos 10
  minutos — para quem recarrega a página e digita tudo de novo achando que não foi.
- **Rate limit por conta**: 5 aberturas por hora e 15 em aberto. Os dois tetos existem por
  motivos diferentes: o da hora contém teclado preso e script; o de abertas contém a fila que
  ninguém consegue atender.
- **Numeração sequencial por tenant**, com `pg_advisory_xact_lock` na abertura: sem ele, duas
  aberturas simultâneas leriam o mesmo `max()` e a segunda quebraria no índice único.

#### Anexo

Um por solicitação, no bucket privado próprio, com a mesma disciplina do P360-011: o tipo sai
dos **bytes** (não do `Content-Type` nem da extensão), o nome é gerado no servidor por
`private.safe_evidence_file_name` (`../../etc/passwd.exe` vira `passwd.pdf`) e o caminho é
`<tenant>/<unidade>/<solicitação>/<nome>`. Registra primeiro, sobe depois; se a subida falhar, a
Edge Function limpa **só o anexo** — a solicitação continua de pé, porque o pedido do cliente
vale mesmo sem o arquivo.

#### Onde encostou no app

- `supabase/functions/client-service-request/` (nova) — anexo e aviso à equipe.
- `supabase/functions/notify-service-request/` (nova) — aviso ao cliente em `awaiting_client` e
  em `resolved`, com o modelo de e-mail da marca e link de WhatsApp para o número profissional.
- `src/utils/serviceRequests.ts` (novo) — o vocabulário num lugar só. Dois conjuntos de rótulos
  de propósito: para a equipe o estado é da fila ("Nova", "Em atendimento"); para o cliente é
  sobre quem tem de agir ("Recebida", "Aguardando você").
- `src/services/serviceRequestService.ts` (novo) — lado da equipe.
- `src/services/clientPortalService.ts` — abertura, leitura, resposta e anexo pelo portal.
- `src/components/client/PortalServiceRequests.tsx` (novo) — seção do portal.
- `src/pages/ServiceRequests.tsx` (novo) + rota `/requests` + item na Sidebar — painel interno,
  organizado por **quem está esperando** (equipe / cliente / encerradas), com filtros de
  unidade, responsável, prioridade e busca por assunto ou número, e o editor do prazo
  informativo.
- Eventos de auditoria novos: `service_request_created` e `service_request_replied`.

#### Testes

- `supabase/tests/client_service_requests.test.sql` (novo): grants e RLS, trava do tenant,
  abertura, validação de conteúdo, isolamento por token/unidade/tenant, duplo clique e retry,
  duplicidade por conteúdo, rate limit, SLA configurável e congelado, papel na mudança de
  status, o que o cliente vê (e o que **não** vê — prioridade e nota interna), resposta só em
  `awaiting_client`, encerramento e anexo (tipo, tamanho, caminho, anexo único, descarte).
- `src/__tests__/services/clientPortalServiceRequests.test.ts` (9) e
  `src/__tests__/components/PortalServiceRequests.test.tsx` (12).
- `npm test`: **37 arquivos, 302 testes, todos passando**. `npx tsc -b` limpo e `npm run build` OK.

#### Prova de produção — conferida no banco depois de aplicar

Não pelo teste local, que não tem os default privileges do Supabase (ver a memória do PROD-01).
Confirmado com `has_table_privilege` / `has_function_privilege` no banco real:

- `anon` não tem **nada** nas três tabelas novas; `authenticated` tem **só select**, sem
  insert/update/delete — e RLS ativa nas três;
- as três RPCs do cliente têm grant para `anon` **e** `authenticated` (o app usa um cliente
  Supabase só); `admin_update_service_request`, `admin_set_service_request_sla` e
  `admin_backfill_client_action_items` **não** são executáveis por `anon`;
- `client_portal_attach_service_request_file` não é executável nem por `anon` nem por
  `authenticated` — só `service_role`, como o card exige;
- bucket `client-service-request-files` criado **privado**, com teto de 10 MB, e as **duas**
  policies de `storage.objects` criadas (desta vez a migration tinha privilégio).

As edge functions `client-service-request` e `notify-service-request` foram publicadas na v1,
com `verify_jwt` ligado, como as do P360-011.

`service_requests_enabled` **já estava ligado** no tenant de produção, então a seção aparece no
portal assim que a Vercel publicar o push da `main`. Não houve mudança de configuração de
produto neste passo.

#### Fora de escopo, deliberado

- **Sem trava por conta** (`client_portal_account_features`): a liberação continua sendo do
  tenant inteiro, pelo `service_requests_enabled` que já existia. Ligar por conta é uma linha no
  `check` da tabela do PORT-01 quando fizer falta.
- **Solicitação não entra na "próxima ação"** do topo do portal (P360-009). O contador
  "aguardando você" já destaca na seção; misturar com pendência sanitária competiria com o que
  é mais grave.
- **Contadores agregados por consultora** são o P360-013; aqui o painel conta em cima da lista
  já filtrada.

Commit: `c50a70b`.

---

## P360-013 — Painel operacional das consultoras

**Modelo:** Sonnet 5 · **Esforço:** alto · **Depende de:** P360-010, 011 e 012 · **Prioridade:** P2

**Resultado:** a equipe administra a consultoria pelo que exige ação, sem varrer cliente por cliente.

### Implementação

- Visão agregada com compromissos próximos, solicitações novas, evidências aguardando revisão,
  planos de ação vencidos, clientes aguardando resposta e pendências financeiras — estas últimas
  sem se misturar às demandas técnicas.
- Filtros por consultora, cliente/unidade, tipo e prazo.
- Deep links para o registro de origem.
- Contadores derivados no servidor, sem carregar todos os anexos e respostas.
- Estado de indisponibilidade parcial por módulo.

### Testes

- Contagens com dados mistos e multi-tenant.
- Filtros combinados; paginação e volume representativo.
- Deep links válidos e autorizados.
- Falha de um bloco não derruba os demais.

### Critérios de aceite

- A consultora identifica pendências críticas em menos de um minuto.
- Nenhum contador depende apenas de Dexie ou localStorage.
- A visão por consultora não omite compromissos compartilhados.
- Dados financeiros e técnicos ficam separados visual e semanticamente.

### Resultado — 08/08/2026

Feito e aplicado em produção. Sem tabela nova: agrega o que os cards 010–012 já criaram.

- Migration `20260808113928_admin_operational_overview.sql`: duas RPCs staff,
  `admin_operational_counts` (contagem dos 6 blocos, uma chamada) e `admin_operational_items`
  (lista paginada de um bloco por vez). Escopo por `private.my_tenant_ids()` +
  `is_tenant_staff`, sem `p_tenant_id` — mesmo padrão de `client_action_items`. Consultora é
  string livre (`assigned_to`/`responsible`/`consultant_names`), nunca `user_id`; o bloco
  financeiro não filtra por consultora (conta não tem consultora confiável).
- **Indisponibilidade parcial por módulo é no servidor**: cada bloco de `admin_operational_counts`
  roda dentro do próprio `begin/exception`; testado renomeando `client_portal_accounts` durante o
  teste SQL e conferindo que os outros 5 blocos continuam retornando número.
- Frontend: `src/services/operationalOverviewService.ts`, `src/pages/OperationalPanel.tsx`, rota
  nova `/painel` (não mexe no Dashboard atual em `/`), item novo na Sidebar. Cada bloco busca sua
  lista de forma isolada (fetch + try/catch próprio) — replica no frontend o mesmo isolamento do
  backend.
- Deep link real (query/route param, não `navigate(path, {state})`): `/schedules?scheduleId=`,
  `/requests?id=`. Adicionado suporte a esses parâmetros em `Schedules.tsx` e
  `ServiceRequests.tsx` (rolagem + destaque até o item, fila certa já selecionada). Evidência e
  plano de ação vencido linkam para `/clients/:id` (não há tela dedicada de revisão de
  evidência). Financeiro não linka: a conta cobre N unidades, não há um registro único de
  origem.
- Teste: `supabase/tests/admin_operational_overview.test.sql` (novo, encadeado em
  `client_service_requests.test.sql`) — permissões, contagem sem filtro, filtro por consultora
  (inclusive o caso "sem dono" zerando o bloco), filtro por cliente, itens paginados com tipo e
  deep link, paginação com 26 linhas de volume, e o teste de falha isolada por bloco.
- `npx tsc --noEmit` limpo; `npm test` com os 302 testes existentes passando.
- **Deixado de fora**: verificação visual em browser com login real (não há credencial de teste
  disponível nesta sessão — a Ester confirmou que pode conferir depois no login normal). A
  cobertura ficou concentrada no teste SQL, que exercita a mesma migration aplicada em produção.
- **Achado fora do escopo — reconciliado em 08/08/2026**: o ledger de produção tem duas migrations
  (`20260808105841_backfill_uses_finalized_report_snapshot` e
  `20260808110104_backfill_severity_from_delivered_report_only`) sem arquivo correspondente em
  `supabase/migrations/` local — mesmo tipo de deriva que o INFRA-02 já resolveu uma vez (ver
  seção 1, regra de ledger). Conferido depois: as duas são correções do backfill do P360-012 e o
  arquivo `20260808105105_backfill_client_action_items.sql` **já traz o resultado final das três**
  (o `has_frozen` da segunda correção está no arquivo e no banco). Não havia nada por aplicar; ficou
  registrado como nota no topo do arquivo e em `docs/migrations-status.md`, seção F.
- SHA: `a3ed4d6`.

---

## P360-014 — Acessibilidade, responsividade e decomposição

**Modelo:** Sonnet 5 · **Esforço:** médio · **Prioridade:** P2

**Resultado:** portal e agenda atendem uso real em celular, teclado e leitor de tela, e deixam de
concentrar regras em páginas gigantes.

### Implementação

- Associar todo `label` a controle por `htmlFor`/`id` ou wrapper válido.
- Incluir `aria-label`, `aria-live`, `aria-expanded` e estados de erro onde couber.
- Controles do calendário com no mínimo 44×44 px.
- Contraste AA, inclusive em placeholders e textos sobre fundo colorido.
- Remover as bordas laterais decorativas detectadas em `AppointmentRequestsPanel` e os casos de
  texto cinza sobre fundo colorido em `ClientPortalManagement`.
- Substituir spinners centrais por skeletons onde a estrutura é previsível.
- Dividir páginas por domínio sem introduzir estado global desnecessário.
- Fallback e retry por seção.

### Testes

- `axe` ou equivalente nas rotas do portal.
- Navegação completa apenas por teclado.
- Zoom 200%, fonte aumentada e reflow a 320 px.
- VoiceOver/NVDA em login, agenda e plano de ação.
- Reduced motion.

### Critérios de aceite

- Zero violações WCAG A/AA críticas nas páginas-alvo.
- Todo controle tem nome acessível e foco visível.
- Nenhum alvo primário abaixo de 44×44 px.
- Nenhum overflow horizontal entre 320 e 1440 px.
- Componentes extraídos mantêm comportamento e testes.

### Resultado — 08/08/2026

Feito. Sem migration — card inteiro é frontend (componentes React/TSX + CSS + testes).

- **Decomposição** (sem mudar comportamento, props inalteradas nas páginas hospedeiras):
  `src/components/schedules/AppointmentRequestsPanel.tsx` (2530 → ~330 linhas) virou
  `appointmentRequestsShared.ts`, `Pager.tsx`, `ConsultantPicker.tsx`,
  `PendingRequestsSection.tsx`, `ActiveRequestsSection.tsx`, `ClosedRequestsSection.tsx`,
  `ActiveRequestCard.tsx`, `PublishedFilesPanel.tsx`, `ActionPlanPanel.tsx`,
  `BlockedDatesSection.tsx` e `modals/{Confirm,AddPhotos,DueDate,NewVisit,Reschedule,
  NotCompleted}Modal.tsx`. `src/components/clients/ClientPortalManagement.tsx` (1479 → ~330
  linhas) virou `portal/shared.ts` e `portal/{Invoices,Payment,PortalAccess,PortalSettings,
  EditPortalUnits,CreatePortalAccount}Modal.tsx`. `Schedules.tsx` e `Clients.tsx` continuam
  montando os componentes principais sem mudança de props.
- **Labels/aria**: todo `<label>` que era irmão solto de um `<input>` (login do portal,
  modais de confirmação/remarcação/nova visita/pagamento/notas fiscais) ganhou `htmlFor`/`id`.
  Grupos de botão-toggle (modo de atendimento, tipo de pagamento, consultoras) ganharam
  `role="group"` + `aria-pressed`. Seções recolhíveis (`▾`/`▸`) ganharam `aria-expanded` +
  `aria-controls`. Todo modal (~14 no total, os dois domínios) ganhou
  `role="dialog" aria-modal="true" aria-labelledby`. Botões só-de-ícone ganharam `aria-label`
  espelhando o `title` já existente.
- **Alvos de 44×44px**: chip de compromisso no calendário admin (`Schedules.tsx`) e botões de
  navegação de mês (admin e portal) foram ajustados para `min-h-11`/`h-11`; célula do calendário
  admin cresceu de 92px para 150px para caber os chips maiores sem perder densidade. Os chips
  desktop-only do calendário do portal (`PortalAppointments.tsx`) ficaram como estão — a lista
  "Agendamentos e arquivos" abaixo já é o caminho primário compatível com 44px, e o chip é um
  atalho secundário sobre um dispositivo de mouse.
- **Contraste**: `text-gray-400` (2.54:1 no branco, medido ao vivo via navegador — abaixo de
  AA) trocado por `text-gray-500` (4.83:1, confirmado matematicamente e ao vivo) em todo texto
  de apoio dos dois domínios e do portal do cliente — mantido só onde `text-gray-400`/`300` é
  estado intencionalmente esmaecido (dia fora do mês no calendário, etapa futura no rastreio de
  protocolo). Placeholder ganhou `placeholder:text-gray-500` via constante `TEXT_INPUT`
  compartilhada. **A alegação do card sobre "texto cinza sobre fundo colorido" em
  `ClientPortalManagement` não foi confirmada** — grep e inspeção ao vivo (`getComputedStyle`
  no navegador) não encontraram nenhuma ocorrência real; o padrão mais próximo é
  `border-gray-200 text-gray-600` no estado inativo de toggles, que não é o defeito descrito.
  Provavelmente já corrigido no commit `96d344b` (central de acesso do portal). Registrado aqui
  em vez de inventar uma correção para um problema que não existe.
- **Bordas decorativas**: removida a `border-l-4 border-l-{amber-400,primary-500}` dos cards de
  solicitação (`PendingRequestsSection.tsx`, `ActiveRequestCard.tsx`) e do card de próxima
  visita em `Schedules.tsx` — o badge de status já cobre a mesma informação sem depender só de
  cor.
- **Skeletons**: spinner central de `AppointmentRequestsPanel` (carregamento principal),
  `InvoicesModal`/`PortalSettingsModal` (dentro dos modais), `ClientPortal.tsx` (topo, antes de
  saber se é login ou painel) e `PublicAppointmentStatus.tsx` (consulta de protocolo) viraram
  blocos `animate-pulse` com `role="status"`/`aria-live` e texto `sr-only`, no formato já usado
  em `PortalActionPlan.tsx` etc.
- **Retry por seção**: `PortalActionPlan`, `PortalServiceRequests` e `PortalBilling` (notas
  fiscais) ganharam botão "Tentar novamente" no estado de erro, ligado a um `loadX()` que já
  existia — nenhuma reestruturação de fetch. `InvoicesModal`/`PortalSettingsModal` (admin)
  ganharam o mesmo. `AppointmentRequestsPanel` passou a avisar (sem bloquear a tela) quando
  clientes ou datas bloqueadas falham ao carregar, com retry — antes falhava em silêncio.
- **`prefers-reduced-motion`**: uma regra global em `src/index.css` neutraliza toda
  `animation`/`transition` (inclusive as futuras) sem tocar componente por componente —
  confirmado ao vivo que a regra compila no CSS servido.
- **Teste**: `jest-axe` (v11) instalado, matcher registrado em `src/__tests__/setup.ts`. 12
  testes novos (login do portal, agenda, plano de ação, `PendingRequestsSection`,
  `ClientPortalManagement`) fazem varredura de axe — zero violações. `npx tsc --noEmit` limpo;
  `npm test` com 314 testes (302 existentes + 12 novos) passando.
- **Verificação manual no navegador** (rotas públicas, sem exigir login): `/cliente` (login) e
  `/agendar` sem overflow horizontal em 320px nem 1440px; foco visível confirmado por teclado no
  login; nomes acessíveis confirmados via `getComputedStyle`/DOM direto (não só a heurística do
  leitor da ferramenta, que às vezes prioriza placeholder incorretamente — comportamento real do
  navegador segue o `label` corretamente). **Deixado de fora**: verificação visual ao vivo de
  `/schedules` e `/clients` — são rotas internas autenticadas e não havia credencial de teste
  disponível nesta sessão; cobertos por leitura de código + `tsc` + testes automatizados.
- **NVDA/VoiceOver**: não executado (leitor de tela do SO, fora deste ambiente). Roteiro manual
  em `docs/roteiro-nvda-voiceover-portal.md`, cobrindo login, agenda e plano de ação, para a
  Ester rodar.
- **Deixado de fora, deliberadamente**: focus trap completo dentro dos modais (o critério de
  aceite pede nome acessível e foco visível, não trap — construir um focus trap genérico é
  escopo maior que o card pede); unificação das duas cópias de `errorMessage`/`generateAccessCode`
  entre os domínios de agenda e portal (duplicação pré-existente, resolver seria escopo cruzado
  com outros arquivos fora do card); dark mode (`darkMode: 'class'` está no `tailwind.config.js`
  mas não encontrei nenhum toggle real usando isso no app — parece config morta, não vale gastar
  tempo testando algo que não é alcançável pelo usuário).
- SHA: `ea5bb4c`.

---

## P360-015 — E2E, rollout gradual e prova de produção

**Modelo:** Opus 5 · **Esforço:** alto · **Prioridade:** P0 de liberação

**Resultado:** cada onda é liberada com evidência de migration, bundle, permissões e fluxos reais.

### Implementação

- Testes E2E autenticados com conta de homologação.
- Cobrir acessos rápidos, agenda por tipo, detalhe, plano de ação, evidência e solicitações,
  conforme as flags habilitadas.
- Ativar features por tenant, começando pela homologação.
- Documentar migration aplicada, SHA do commit/bundle, horário BRT e rollback.
- Validar PWA e service worker com hard refresh e cenário de atualização de bundle.
- Smoke de produção com conteúdo distintivo; health endpoint isolado não basta.
- Revisão de RLS, RPC e Storage antes de cada flag.

### Testes mínimos de liberação

- Conta válida, inválida, suspensa e de outro tenant.
- Pasta principal versus personalizada.
- Tutorial e auditoria.
- Inspeção e reunião sem contaminação de fluxo.
- Reserva concorrente.
- Evidência autorizada e tentativa cruzada negada.
- Mobile real ou emulação confiável.
- Regressão de relatórios, fotos, notas e pagamento.

### Critérios de aceite

- CI verde no SHA publicado.
- Migration confirmada no ambiente correto.
- O bundle em produção contém a feature distintiva.
- Smoke autenticado passa após limpeza do service worker.
- Rollback da flag e da aplicação documentado e testável.
- Nenhuma feature é declarada em produção só porque o CI publicou.

**Observação:** ainda que os testes sejam escritos por Sonnet 5, a revisão de segurança, migrations
e prova de produção deve ser feita com Opus 5.

### O que o card assumia e não existia

Três premissas do card não se sustentavam quando fui verificar:

- **Não havia ambiente de homologação.** Um projeto Supabase, um tenant com dados
  (`Ester Souza`, 23 clientes), dois tenants zerados de seed antigo e nenhuma conta de teste em
  `auth.users`. "Começar pela homologação" não tinha por onde começar.
- **Não havia CI.** Sem `.github/`. O Vercel publica direto do push, então "CI verde no SHA
  publicado" era um critério que ninguém podia cumprir nem contestar.
- **As ondas já estavam liberadas.** No tenant de produção as quatro flags de
  `client_portal_settings` já estavam ligadas. O P360-015 não chegou a tempo de escalonar o Portal
  360 — o que ele entrega é o mecanismo daqui em diante, mais a prova de que o que está no ar hoje
  é íntegro.

A escolha do ambiente foi da Ester: tenant de homologação **dentro do banco de produção**, em vez de
branch pago ou Supabase local. É o que permite provar isolamento entre tenants de verdade, que é
justamente o item mais sensível da lista de testes mínimos.

### O que foi feito

**Marca de build.** `vite.config.ts` passou a gerar `/build-info.json` (SHA, branch, ambiente,
horário) e a carimbar `<meta name="build-sha">` no HTML. São duas perguntas diferentes: o JSON diz
de qual commit é o *deploy*; a meta diz de qual commit é o *HTML que este navegador recebeu*.
Divergir entre os dois é a assinatura de service worker preso em bundle antigo. O JSON fica fora do
precache de propósito — o glob do workbox só pega `js/css/html/woff2` — e ganhou `no-store` no
`vercel.json`.

**Smoke de produção** (`scripts/prod-smoke.ts`). Confere o SHA publicado, o SHA do HTML, os
cabeçalhos sem cache, e procura a **string literal** de cada onda dentro dos chunks que o `sw.js`
lista. Ao liberar uma onda nova, acrescente uma linha em `MARCADORES`. Achado no caminho: o
catch-all do `vercel.json` devolve o `index.html` com **200** para qualquer caminho inexistente —
então "o endpoint responde 200" não prova absolutamente nada neste projeto, e um arquivo ausente
chega como HTML em vez de 404.

**CI** (`.github/workflows/ci.yml`). Três jobs: `js` (`npm run build` + `npm test`), `sql` (as 15
suítes de `supabase/tests`, uma por banco, num serviço `postgres:16` — o mesmo procedimento que o
handoff descrevia como manual) e `e2e`, sob demanda, com as credenciais em secrets.

**Tenant de homologação** (`supabase/homolog/seed.sql` e `teardown.sql`). Dois tenants com ids
fixos em `aaaa0015` e tudo prefixado `[HOMOLOG]`: unidade com pasta personalizada e unidade sem,
conta em dia, conta em atraso, conta em outro tenant, visita concluída, reunião futura e duas
pendências no plano de ação (uma vencida). O teardown apaga **por tenant**, não por prefixo de id
— os testes criam linhas com id gerado pelo banco —, e aborta se sobrar qualquer coisa.

**Playwright** — 25 testes, rodados em desktop e em Pixel 5 (**50 execuções, todas passando**):
acesso válido/inválido/em atraso/de outro tenant, pasta principal versus personalizada, tutorial com
a chamada de auditoria observada na rede, os três estados do PORT-03, envio de evidência, regressão
de pagamento/conformidade/agenda/solicitações, isolamento no app interno, service worker e
recuperação depois de limpar cache e worker.

### Achados

**1. A env `VITE_DEFAULT_TENANT_ID` da Vercel tem um BOM (U+FEFF).** Comparando o bundle publicado
com o build local do `33c11fd`, os 65 chunks são idênticos depois de normalizar os hashes de nome —
com **uma única** diferença de conteúdo em todo o bundle:
`cleanTenantId("﻿60191f17-…")` contra `cleanTenantId("60191f17-…")`. Não quebra nada hoje
porque `cleanTenantId` remove `﻿` explicitamente (sinal de que alguém já tropeçou nisso). O
risco é o próximo consumidor: quem ler a env sem passar pela função funciona local e falha em
produção. Registrado em `docs/rollout.md`.

**2. Os labels do login da equipe não estavam associados aos inputs.** `src/pages/Login.tsx` tinha
`<label>` sem `htmlFor` e `<input>` sem `id`: um leitor de tela anunciava o campo de senha como
"••••••••", que é o placeholder. Só apareceu porque o E2E tenta achar o campo pelo rótulo, como um
leitor de tela faria. O P360-014 não pegou — a tela de login ficou fora do escopo dele. Corrigido
(`htmlFor`/`id` nos dois campos, `aria-hidden` nos ícones decorativos).

**3. Bucket `photos` é público, sem limite de tamanho nem restrição de MIME.** Criado em 19/03/2026,
**vazio**, e nenhum código o referencia — todo mundo usa `inspection-photos`. Risco latente, não
ativo: é o bucket de nome mais óbvio, e existe uma tabela `photos` no schema para aumentar a
confusão. **Não mexi** — está na fila como SEC-01.

**4. Os grants amplos de `anon` nas 20 tabelas antigas são inócuos hoje, e são a única margem.**
`clients`, `inspections`, `responses`, `photos`, `client_portal_accounts` e outras têm
`SELECT/INSERT/UPDATE/DELETE/TRUNCATE` para `anon`, herdados do default privilege do Supabase.
Provei empiricamente com `set role anon` que não rende nada — leitura devolve 0 linhas, insert é
negado com 42501, update e delete atingem 0 linhas — porque **nenhuma policy** existe para `anon`
nessas tabelas. Ou seja: o que segura é só o RLS. Revogar seria endurecimento de baixo risco, mas
troca "0 linhas" por "permission denied", que é mudança de comportamento observável, e há 27
tabelas acessadas direto pelo cliente Supabase no `src/`. **Não fiz no meio deste card** — virou
SEC-01, que é onde isso deve ser medido caminho a caminho.

**5. Sem advisor de nível ERROR.** Todas as tabelas de `public` com RLS ligado e ao menos uma
policy; zero funções `security definer` sem `search_path` fixo; nem `anon` nem `authenticated`
podem criar objetos em `public` (não há hijacking de `search_path`); de `private`, só as três
auxiliares de RLS são executáveis por `authenticated`. Os 17 `security definer` abertos a `anon` são
as RPCs do portal por token e do agendamento público — esperados.

### Armadilhas que custaram tempo e ficaram documentadas

- **Usuário criado por SQL em `auth.users` quebra o GoTrue** se os campos de token forem `NULL`: o
  login devolve `500 Database error querying schema`, que não menciona coluna nenhuma e parece erro
  de senha. O seed insere `''` nos oito campos.
- **`getByLabel(/^Senha$/)` não casa** porque o texto do label é `" Senha"` — o espaço vem do
  `<Icon /> Senha` no JSX, e o Playwright não faz trim quando o seletor é regex.
- **O app interno é offline-first**: em contexto novo do Playwright, `/clients` e `/schedules`
  mostram vazio até sincronizar. Os testes de isolamento passaram a observar o que o **servidor**
  devolve, com o token da sessão, em vez da lista na tela — é o RLS que precisa ser provado, e uma
  lista vazia provaria o contrário do que parece.
- **A reserva concorrente não passa pela tela de propósito**: `/agendar` usa o
  `VITE_DEFAULT_TENANT_ID` do bundle, que em produção é o tenant real. Um teste de corrida pela
  interface criaria solicitação de verdade na agenda da Ester. O teste chama a RPC com o tenant de
  homologação no payload — mesmo caminho de código, sem o efeito colateral.
- **Datas calculadas caem em fim de semana.** A primeira versão do teste de concorrência somava 21
  dias e caiu num sábado; as duas reservas foram recusadas por indisponibilidade e o teste "falhou"
  sem falar do que queria falar. Agora ele pergunta ao banco qual horário está livre.

### Resultado — 08/08/2026

- **314 testes JS** (40 arquivos), **15 suítes SQL** e **50 execuções E2E** passando; `npm run build`
  OK. O `e2e/` precisou entrar no `exclude` do Vitest, que estava coletando os specs do Playwright.
- Isolamento entre tenants provado por três caminhos independentes: portal por token (`overview` do
  tenant A traz 2 unidades, o do B traz 1, token inexistente devolve "acesso invalido"), sessão
  autenticada de staff (`clients` e `appointment_requests` só devolvem o tenant de homologação) e
  consulta direta com `set role anon`.
- **Decidido pela Ester em 08/08/2026:** SEC-01 aprovado e aplicado — bucket `photos` fechado e
  grants de `anon` revogados. Ver a seção do card.
- **A pendência do tutorial virou o PORT-04.** Era descrita aqui como "falta configurar
  `tutorial_pdf_url` no tenant"; a Ester corrigiu a premissa — o tutorial é de cada cliente, e um
  campo por tenant serviria o mesmo PDF para todo mundo. Ver o card.

---

## PORT-04 — Tutorial do portal por conta do cliente ✅ concluído em 08/08/2026

**Aplicado em produção** pela migration `20260808191341_portal_tutorial_por_conta`.

**O que estava errado.** O P360-015 fechou dizendo que faltava "configurar o `tutorial_pdf_url` do
tenant". A Ester leu e respondeu que o tutorial era para ser específico de cada cliente — e ela está
certa: `client_portal_settings` tem **uma linha por tenant**, então o campo serviria o mesmo PDF a
todos os clientes do portal. Nunca foi preenchido em produção; se tivesse sido, o erro estaria no ar.

**Decisão dela (08/08/2026): por conta do portal.** A conta é o login, a empresa — a Rede Sênior tem
um tutorial valendo para as 16 unidades. Por unidade seria personalização que ninguém pediu, e um
link a manter por endereço.

### Implementação

- Coluna `tutorial_pdf_url` em `client_portal_accounts`, com a mesma trava de HTTPS que já vale para
  a Pasta Principal.
- `client_portal_overview` ganhou **uma linha**: `coalesce(conta, tenant)`. O campo do tenant
  continua existindo como PADRÃO — dá para ter um tutorial genérico e sobrescrever só onde importa.
- Sobrecarga de 5 argumentos de `admin_update_client_portal_account_configuration`. **A de 4
  argumentos não foi tocada de propósito**: ela nunca menciona `tutorial_pdf_url`, então um PWA
  antigo em cache que salve por ela preserva o tutorial. Virar parâmetro com default na mesma função
  faria a chamada antiga limpar o campo sem querer.
- Campo novo em "Editar acesso"; o do tenant passou a se chamar "Tutorial padrão do portal".

### O risco real deste card, e como foi coberto

`create or replace` não aceita remendo: para acrescentar uma linha foi preciso reescrever as ~130
linhas do `client_portal_overview`. **Na primeira transcrição eu troquei `action_plan_enabled` por
`service_requests_enabled` no `select ... into`** — duas booleanas lado a lado, que teriam ligado a
função errada no portal sem nenhum erro aparecer.

A suíte `portal_tutorial_por_conta.test.sql` existe por causa disso: ela encadeia a suíte do PORT-01
e **repete as asserções dela depois da reescrita** (contagem de relatório, foto, anexo, score,
travas, pagamento, unidades), e checa as duas flags com valores diferentes, invertendo-as em
seguida. Conferido também em produção depois de aplicar, pelo texto da função (`pg_get_functiondef`).

**Prova:** 17 suítes SQL em container limpo, 320 testes JS (4 novos de componente, cobrindo o rótulo
associado ao campo — o que o P360-014 pediu), `npm run build` OK.

---

# Bloco 5 — Dívida técnica

## SEC-01 — Endurecer o que a revisão do P360-015 encontrou ✅ concluído em 08/08/2026

**Aplicado em produção**, com autorização da Ester, por duas migrations:
`20260808185142_sec01_close_photos_bucket` e `20260808185210_sec01_revoke_anon_table_grants`.
O resultado e o achado que apareceu no meio do caminho estão no fim desta seção; o texto abaixo
fica como registro do que foi decidido antes.

**Modelo:** Opus 5 · **Esforço:** médio · **Prioridade:** média — nada está aberto hoje, mas as duas
pontas removem a margem de erro

Dois achados da revisão de RLS, RPC e Storage. Nenhum é exploração ativa; os dois são a diferença
entre "seguro" e "seguro por um fio só".

**1. Bucket `photos` público.** Criado em 19/03/2026, `public = true`, sem `file_size_limit` e sem
`allowed_mime_types`. Está **vazio** e nenhum código o referencia — as fotos vivem em
`inspection-photos`, privado e restrito a 5 MB de jpeg/png/webp. O risco é o nome: é o bucket mais
óbvio para alguém escrever `.from('photos')` um dia, e aí foto de cliente vai parar em URL pública.
Tornar privado (ou apagar) não quebra nada hoje — mas é escrita em produção e precisa de
autorização.

**2. Grants de `anon` nas tabelas antigas.** 20 tabelas de `public` — entre elas `clients`,
`inspections`, `responses`, `photos` e `client_portal_accounts` — têm
`SELECT/INSERT/UPDATE/DELETE/TRUNCATE` para `anon`, herdados do default privilege do Supabase. As
tabelas criadas do P360-010 em diante já nascem endurecidas.

Medido em 08/08/2026, com `set role anon`: leitura devolve 0 linhas, insert é negado com 42501,
update e delete atingem 0 linhas. **Não há uma única policy para `anon` nessas tabelas** — quem
segura é o RLS, sozinho. O grant não acrescenta acesso; acrescenta o risco de uma policy futura
mal escrita virar vazamento em vez de erro.

### Por que não foi feito junto com o P360-015

Revogar troca "0 linhas" por "permission denied", que é **mudança de comportamento observável**. Há
27 tabelas acessadas direto pelo cliente Supabase no `src/`, e as páginas públicas (`/agendar`,
`/portal/:token`, `/cliente/visita/:token`) usam o mesmo cliente com papel `anon`. Se alguma delas
fizer `select` direto numa dessas tabelas e hoje receber `[]`, passaria a receber erro. Fazer isso
no card que **institui** a disciplina de liberação seria contradizê-lo.

### Implementação

1. Mapear, caminho a caminho, todo `.from('<tabela>')` alcançável sem sessão. As páginas públicas
   devem usar só RPC — confirmar que é verdade, não presumir.
2. `revoke` por tabela, em migration própria, começando pelas que nenhuma página pública toca.
3. Cobrir em suíte SQL nova: `anon` recebe `permission denied`, `authenticated` do tenant continua
   lendo o que já lia.
4. `photos`: `public = false` ou remoção do bucket, com autorização da Ester registrada.

### Resultado — 08/08/2026

**O mapeamento não confirmou a premissa: ele achou um acoplamento que ninguém tinha visto.**

A expressão de uma policy roda com as permissões de **quem consulta**. A policy
`client_portal_published_assets_select_anon`, em `storage.objects`, libera para `anon` o objeto
referenciado por uma linha de `appointment_attachments` — ou seja, ela **consulta uma das tabelas
do revoke**. Provado em Postgres 16 com repro mínimo: sem o grant, a policy para de devolver "nada"
e passa a devolver `permission denied for table appointment_attachments` para **qualquer** leitura
de `storage.objects` como `anon`. Revogar sem derrubar a policy teria trocado uma porta que ninguém
usa por uma armadilha. As duas coisas foram na mesma migration, e o teste novo cobre exatamente
esse caso.

O caminho real do cliente não passa por ali: os anexos chegam por URL assinada emitida pela edge
function `client-appointment-assets` com `service_role`, que não passa por RLS.

Dois ajustes de rota em relação ao plano original:

- **A contagem era 20, são 23 tabelas.** A lista foi refeita a partir de
  `information_schema.role_table_grants`, não do card.
- **"Não há uma única policy para `anon`" estava errado.** `appointment_slots` tinha
  `anon select public slots`. A tabela está com 0 linhas e o modelo atual é `appointment_blocks` +
  `private.appointment_has_conflict`, então a policy caiu junto — era exatamente o cenário
  "policy + grant" que o card queria evitar, já existindo.
- **`revoke ... from anon` não bastava em `sync_inspection_bundle`.** O ACL tinha `=X/postgres`, o
  PUBLIC; enquanto ele estivesse lá, tirar de `anon` não mudaria nada. O revoke é de PUBLIC, com
  `authenticated` e `service_role` reafirmados logo em seguida.

**O que não foi mexido, de propósito:** o default privilege do schema `public` continua concedendo
para `anon` em tabela nova — está definido para `postgres` **e** para `supabase_admin`, e mexer nele
mudaria o comportamento de tudo que o Supabase criar daqui pra frente. A disciplina segue a mesma:
toda migration que cria tabela revoga explicitamente (ver
[supabase-default-privileges-em-tabela-nova]).

**Prova:**

- Suíte nova `supabase/tests/sec01_anon_grants.test.sql`: reproduz as 23 tabelas como o Supabase as
  entrega, aplica a migration e confere os dois lados — `anon` sem nenhum dos 7 privilégios,
  `authenticated` com os 4 de sempre, as duas policies fora, `storage.objects` devolvendo vazio em
  vez de erro, e a função invoker fechada para `anon` e aberta para `authenticated`.
- **16 suítes SQL** passando em container limpo (a suíte nova entra na conta).
- Em produção, depois de aplicar: **0 grants de `anon`** em `public`, **0 policies** que citem
  `anon` em qualquer schema, bucket `photos` privado com 5 MB e jpeg/png/webp. Com `set role anon`:
  `clients` e `inspections` respondem **42501**, `storage.objects` responde sem erro, e
  `client_portal_login` continua respondendo.
- **50 execuções E2E** (desktop + Pixel 5) contra `inspecvisa.consultorasanitaria.com.br` **depois**
  do revoke: portal do cliente, canal público de agendamento, PWA e app interno, todos passando.
- 314 testes JS, `npm run build` OK.

---

## DEBT-01 — Margem pública de 4 h vale igual para inspeção de 12 h e briefing de 15 min ✅ concluído em 04/08/2026

**Resolvido pela migration `20260804140000_appointment_buffer_por_registro`**, aplicada em produção.
A margem passou a vir do **registro que já está na agenda**, limitada pelo teto que o chamador
passa: inspeção 4 h, demais 30 min, caminho interno segue em 0. Na prática o canal público hoje só
cria briefing, então quem decide a margem é sempre o compromisso existente — que é o item 3 da
implementação abaixo (briefing logo após inspeção presencial continua barrado por 4 h, porque a
margem grande é da inspeção). Coberto em `supabase/tests/appointment_availability.test.sql`: o
caso antigo de 4 h passou a usar `inspection` e há caso novo provando que reunião de 30 min só
bloqueia 30 min de margem.

O texto original do card fica abaixo como registro da decisão.

**Modelo:** Sonnet 5 · **Esforço:** médio · **Prioridade:** baixa — decisão de produto

`private.appointment_has_conflict` recebe `p_public_buffer interval` e as RPCs públicas passam
sempre `interval '4 hours'` (ver `supabase/migrations/20260802105852_appointment_availability_intervals.sql`).
A margem foi pensada para inspeção presencial, que envolve deslocamento. Aplicada a um briefing
online de 15 min, bloqueia mais de 8 horas de agenda em volta de um compromisso curto.

Não foi corrigido de propósito: fazer certo exige margem **por registro** — o que está sendo
bloqueado —, e não por chamada; a assinatura atual só conhece a margem de quem consulta.

### Implementação

1. Levar a margem para coluna ou derivação por `appointment_type` (ex.: inspeção 4 h, demais 30 min).
2. Fazer `appointment_has_conflict` usar a margem do **registro existente**, não um parâmetro único.
3. Cuidar do caso real: briefing online logo após inspeção presencial — a consultora pode estar em
   deslocamento. A margem grande continua valendo do lado da inspeção.
4. Cobrir em `supabase/tests/appointment_availability.test.sql`, que já tem casos de margem.

---

## DEBT-02 — Dívida de lint 🟡 em andamento desde 17/08/2026 · 531 → 251

**Modelo:** Sonnet 5 · **Esforço:** médio · **Prioridade:** baixa, mas bloqueia lint no CI

`npm run lint` falha no projeto inteiro, com ~425 erros majoritariamente
`@typescript-eslint/no-explicit-any`.

### Implementação

1. `npx eslint . -f json` e agrupar por regra e por diretório para dimensionar.
2. Atacar por fatia, começando por `src/services/`, onde `any` esconde erro de contrato com o
   Supabase. Um PR por fatia, sem misturar com mudança de comportamento.
3. Ligar o lint no CI só quando a fatia estiver zerada; até lá, um `--max-warnings` por diretório
   evita regressão.

### Andamento — 17/08/2026

Recontagem real no início: **531** problemas (521 erros, 10 avisos), não 425 — e **504** deles
eram `no-explicit-any`. Depois de duas fatias: **482**.

**Fatia 0 — tudo que não é `no-explicit-any`, zerada** (`3a3440c`). Eram 27, e três eram defeito
de verdade: `Checkbox`/`Radio` passavam a `ref` para uma função durante o render
(`react-hooks/refs`); `InspectionExecution` recriava `visibleSections` a cada render
(`template?.sections || []`), desestabilizando **sete** hooks abaixo; e o `SyncCenter` tinha
`isLoading` escrito e nunca lido desde o FE-18. `useConfirmDialog` passou a devolver um `confirm`
estável (`useCallback`), o que permitiu fechar as duas dependências que faltavam em
`InspectionExecution` e beneficia os outros 18 arquivos que usam o hook. O que sobrou virou
configuração **com o porquê escrito no arquivo**: `_algo` vale como descarte deliberado;
`react-refresh/only-export-components` desligado nos três arquivos que co-locam hook e componente
de propósito (separar mexeria em 41 arquivos de importação); e `no-control-regex` mais três
`set-state-in-effect` com `eslint-disable` justificado na linha — são busca de dados em efeito e
reset deliberado, e a regra pede biblioteca de query, que o projeto não tem.

**Fatia 1 — `src/services`, zerada** (`5c24059`, `44ca681`, `66fef8c`): 141 → 0. Como não há
tipos gerados do Supabase, o contrato de cada tabela passa a morar ao lado do mapeador
(`ClientRow`, `ScheduleRow`, `InspectionRow`, `ResponseRow`, `PhotoRow`, `TemplateRow`…).
O `dexieTable: any` de seis funções do `repositoryService` virou `Table<T>` do Dexie, com
`SyncableRecord` dizendo o que as filas de fato leem — e, onde o Dexie recusa `update` com o
genérico ainda aberto, existe uma visão restrita da tabela com o porquê escrito na linha.
O `migrationService` ganhou cinco interfaces `Legacy*`: o backup antigo traz **as duas grafias**
do mesmo campo (`created_at` e `createdAt`) porque foi exportado por versões diferentes do app —
é o que os `||` do arquivo sempre trataram, e o que o `any` escondia.

**Fatia 2 — `src/pages`, zerada** (`5edfb98`): 112 → 0. O padrão das telas era `catch (err: any)`
só para poder ler `.message`; como cada uma tem seu próprio texto de reserva, `errorMessage`
ganhou o par `rawErrorMessage` (mensagem ou `undefined`), e `rawErrorMessage(err) || 'Erro ao
salvar cliente.'` continua dizendo o texto da tela. No `SyncCenter` os 32 `(x as any)` já não
eram necessários havia tempo — as listas vêm tipadas do Dexie. No `InspectionExecution`, os dois
pontos que passam a **inspeção** onde `getEffectiveTemplate` pede um **cliente** agora dizem isso
na cara (`as unknown as Client`, com o motivo), em vez de sumir num `any`.

**Quatro campos que o `any` deixava mentir** — todos declarados como realmente são, sem mudar
runtime: `syncError` é **nulo** (não ausente) depois de sincronizar; `Schedule.inspectionId` é
nulo quando a visita não tem inspeção; `situationDescription`/`correctiveAction`/`responsible`/
`deadline`/`customDescription` são nulos quando vêm do banco; e `listTemplates()` podia devolver
`null` para quem guarda o resultado direto numa lista.

**Código morto que só a tipagem revelou:** o `TemplateEditor` lia `it.legislation_name` e mais
quatro campos em snake_case que **nunca chegavam ali** — `getFullTemplate` sempre devolveu
camelCase.

**O CI já cobra o teto** (passo 3, feito antes do resto): `npm run lint:teto`
(`scripts/lint-teto.mjs` + `scripts/lint-teto.json`) roda no job `js` e falha se **qualquer área
piorar** — não exige zero, exige não regredir. `--max-warnings` não servia: estes são erros, não
avisos. Ao fechar uma fatia, `node scripts/lint-teto.mjs --gravar` baixa o teto. Quando tudo
chegar a zero, o script sai e o CI passa a rodar `npm run lint`.

**O que falta, por área** (o teto de hoje, 251): `scripts` 106 · `api` 41 · `src/data` 28 ·
`src/utils` 24 · `src/types` 19 · `src/__tests__` 12 · `src/components` 10 · `src/store` 7 ·
`supabase/functions` 2 · `src/lib` 1 · `vite.config.ts` 1.

**Nota sobre `scripts/` (106):** são scripts de manutenção de dado, rodados uma vez com `npx tsx`.
Tipar linha de banco ali tem valor bem menor que em `src/` — é a última fatia, não a próxima.
A ordem sugerida do que sobra: `src/utils` e `src/data` (ainda são código de produção), depois
`api` e `src/types`, e `scripts` por último.

---

## DEBT-03 — Pontas soltas do repositório ✅ concluído em 05/08/2026

**Modelo:** Haiku 4.5 · **Esforço:** baixo · **Depende de:** — (INFRA-01 já concluído)

- **`sala-estetica.html` na raiz** importa `three` e `three/addons/...`, que não estão no
  `package.json`. O `vite dev` loga erro de resolução toda vez. Instalar a dependência, tirar o
  arquivo do escopo do Vite, ou removê-lo.
- **`public/` pesa ~1,3 MB.** Restam `pwa-512x512.png` (376 KB) e `pwa-maskable-512.png` (188 KB),
  grandes demais para ícones; dá para comprimir sem perda visível.
- **`globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` em `vite.config.ts:35`** faz o service
  worker pré-carregar **todo** PNG do build. Restringir aos ícones do PWA, senão qualquer imagem
  nova volta a inflar o precache em silêncio.
- **Arquivos de negócio soltos na raiz** (`ROI ILPI 2024.pdf`, `ROI estetica II.pdf`,
  `ROI ESTÉTICA II.xlsx`, `Inspecao_REDE_SENIOR_*.pdf`, `5-repos-claude-code.pdf`,
  `NBR9050_20.pdf`, `nbr_13534_*.pdf`, `inspec-visa-backup-2026-05-16.json`). A Ester optou por
  mantê-los. Se um dia quiser limpar, o destino natural é `docs/` ou fora do repositório.
  **Não remover sem autorização.**

### Resultado — 05/08/2026

Três das quatro pontas resolvidas; a quarta segue como estava, por decisão já tomada da Ester.

- **`sala-estetica.html` removido.** Reproduzido o erro primeiro: `vite dev` devolvia 500 ao abrir a
  página (`Failed to resolve import "three"` — o import map da própria página, que resolve `three`
  via CDN `unpkg`, não é entendido pelo `vite:import-analysis`, que tenta resolver o especificador
  como pacote do `node_modules`). A build de produção não era afetada (o arquivo não é `entry` do
  Rollup), só o `dev`. Cheguei a mover o arquivo para `public/` — que bypassa o pipeline de módulos
  do Vite e resolveria o erro sem apagar nada — mas a Ester confirmou no meio da sessão: **"sala de
  estetica pode excluir, n faz parte desse projeto."** Arquivo apagado (`git rm`), não só movido.
- **Ícones comprimidos sem perda visível.** Sem `pngquant`/ImageMagick/`sharp` disponíveis no
  ambiente, usei Pillow (já instalado, `python -c "import PIL"` confirmou). Reencode lossless
  (`optimize=True`) só ganhava ~20%; quantização para paleta de 256 cores com dithering
  Floyd-Steinberg (`Image.Quantize.FASTOCTREE`) ganhou muito mais — os dois ícones são um brasão
  plano (fundo azul-marinho, escudo branco/azul), não fotografia, então 256 cores é sobra. Comparei
  visualmente antes/depois (`Read` renderiza PNG) e não há diferença perceptível. `pwa-512x512.png`:
  381.903 → 37.221 bytes (−90,3%). `pwa-maskable-512.png`: 188.944 → 20.605 bytes (−89,1%).
  `public/` caiu de ~1,3 MB para 256 KB.
- **`globPatterns` restringido em `vite.config.ts`.** Trocado de
  `['**/*.{js,css,html,ico,png,svg,woff2}']` para `['**/*.{js,css,html,woff2}']`. Os ícones e o logo
  continuam precacheados — isso já era feito pelo `includeAssets` explícito (lista de 5 nomes de
  arquivo), que é independente do glob. Achado ao verificar: **`logo sem fundo treinavisa.png`**
  (36 KB) está em `public/` mas não é referenciado em nenhum lugar do `src/` nem está no
  `includeAssets` — estava sendo precacheado por acaso, só porque o glob antigo pegava qualquer PNG.
  Não removido (fora do escopo deste item, que era sobre o *glob*, não sobre arquivo específico); só
  parou de entrar no precache do service worker. Confirmado no `dist/sw.js` pós-build: exatamente os
  5 nomes do `includeAssets` no manifesto, nenhum PNG a mais. Precache total: 72 entradas / 4.424 KiB
  → **66 entradas / 3.687 KiB**.
- **Arquivos de negócio na raiz:** nada feito, como já estava decidido. Continuam preservados.

**Evidência:** `npm test` — 19 arquivos, 146 testes, todos passando (mesma contagem do REF-03, este
card não mexeu em código de teste). `npm run build` — passa. App testado no browser antes e depois
(dev server): login carrega normal, sem erro novo no console.

---

# Bloco 6 — Relatório entregue ao cliente

## REL-01 — Mostrar o que o cliente já cumpre ✅ concluído em 06/08/2026

### O problema

O relatório só provava o que faltava. Depois do plano de ação vinha o bloco
`GRUPO 3 — ITENS EM CONFORMIDADE`, que era um parágrafo com o percentual e uma tabela de
`% conformidade` por área — nenhum item nomeado. A única lista de itens cumpridos era
`PONTOS DE EXCELÊNCIA E SUGESTÕES DE MELHORIA`, e ela filtra por
`situationDescription || correctiveAction || photos || links`: o item cumprido sem observação
digitada não aparecia em lugar nenhum do documento. Numa inspeção com 19 conformidades e nenhuma
anotada, o cliente recebia um laudo que só listava as 5 falhas.

### Implementação

Tudo em `src/utils/pdfGenerator.ts`, logo depois da tabela de conformidade por área — a posição que
a Ester pediu ("depois de mostrar as prioridades").

- Bloco novo **`RELAÇÃO DOS ITENS CUMPRIDOS`**: uma `autoTable` por seção do roteiro, cabeçalho
  `<seção> — N item(ns) em conformidade`, e uma linha por item cumprido com código sequencial
  (`C-001`…), a descrição **na íntegra** (sem truncar) e a base legal.
- Base legal reusa `extractBaseLegislation` (o mesmo do REF-02), então imprime o ato e não o artigo
  inteiro. Item `requirement_type = 'good_practice'` sai como `Boa prática`, não como exigência.
- Coluna **`Regularizado`**: marca o item cumprido que estava em não conformidade numa visita
  anterior deste cliente. Reusa o `options.recurringItemIds` que a `InspectionSummary` já carrega via
  `getRecurringItemIdsForClient` — nenhuma consulta nova. Sem inspeção anterior concluída o conjunto
  vem vazio, nenhuma etiqueta aparece e a legenda do subtítulo some junto.
- Paginação é da própria `autoTable` (`margin.top`/`bottom` ajustados para não bater no rodapé); o
  cabeçalho da seção se repete a cada página nova.

### Achado no caminho — rodapé duplicado (corrigido)

`addFooter` era rodado em **dois** laços sobre todas as páginas: um antes das páginas de assinatura e
referências, outro depois. Como o total mudava entre os dois, toda página saía com
`Página 1 de 8` impresso por baixo de `Página 1 de 9`. Isso valia para **todo relatório já emitido**,
não é regressão deste card. O primeiro laço foi removido; o segundo já cobria tudo.

### Resultado — 06/08/2026

- `src/__tests__/utils/pdfGenerator.test.ts`: 4 casos novos — lista item cumprido sem observação,
  marca `Regularizado` com histórico, não marca sem histórico, e não desenha o bloco quando nada foi
  cumprido. 21 testes no diretório `utils`, todos passando; `tsc -b` limpo.
- Conferido em PDF real (amostra de 24 itens, 19 cumpridos, 2 seções): ordem
  plano de ação → tabela por área → relação dos itens cumpridos → não conformidades, quebra de página
  correta, `Regularizado` na linha certa e rodapé com um único `Página N de 9`.
- **Ceiling conhecido:** `recurringItemIds` é "esteve em NC em *qualquer* visita anterior concluída",
  não só na imediatamente anterior. Um item que foi NC há três visitas, regularizado na seguinte e
  ainda cumprido hoje continua saindo como `Regularizado`. É o mesmo conjunto que já alimenta o selo
  `REINCIDENTE` do plano de ação — trocar a semântica mudaria os dois.
- **Fora de escopo:** a tela `InspectionSummary` não ganhou a relação nem a etiqueta; a mudança é só
  no PDF.

---

## EMAIL-01 — Destinatário canônico e entrega confiável dos e-mails de agendamento 🟡 local

### Objetivo

Corrigir o e-mail MIME quebrado e impedir que confirmações de clientes vinculados usem um contato
antigo da solicitação. `public.clients.email` é canônico; sem endereço válido no cadastro, nada é
enviado e a interface orienta a atualização do cliente.

### Resultado — 12/08/2026

- Migration aditiva pronta e provada em Postgres 16, sem aplicação remota.
- `notify-appointment-event` resolve o cliente por `client_id + tenant_id + deleted_at is null`,
  autentica o staff sob RLS, controla concorrência/retry e constrói a URL canônica no servidor.
- O portal autenticado não envia e-mail editável; a RPC ignora o payload e grava o e-mail atual de
  `clients` apenas como snapshot. Cliente novo é persistido remotamente antes do vínculo.
- Assunto seguro compartilhado aplicado no limite SMTP de todas as dez funções afetadas, sem nova
  dependência nem troca de provedor.
- Verificação local: 48 arquivos/358 testes Vitest, build, `git diff --check` e duas suítes SQL.
- Fora desta execução: commit, push, produção, smoke SMTP real e reenvio para a Eliana.

---

## AGD-01 — Visita retroativa e organização do painel de solicitações ✅ concluído em 06/08/2026

### O que motivou o card

A Ester relatou que "um registro de inspeção da Rede Sênior Icaraí foi apagado do sistema" — visita de
30/06/2026, ausente do painel inclusive na seção Encerradas.

**Nada foi apagado.** A investigação no Supabase de produção mostrou:

- a inspeção `30fb2fe5-a101-46a2-af11-de9387076710` está íntegra: `status = completed`,
  `deleted_at` nulo, **114 respostas**, consultoras Ester + Ana, `inspection_date` 30/06/2026;
- o agendamento `21b25e7f-49ab-4074-987e-e5d62ef00fb0` (30/06, 11h30) existe e aponta para ela;
- o que **não existia** era a linha em `appointment_requests`. Sem ela o painel não tem o que mostrar,
  em nenhuma das três seções — e o cliente também não via a visita no portal.

O padrão descarta acidente isolado de digitação: em 16/06/2026, entre 20h41 e 20h54, foram criadas
sete visitas pelo portal (Riocentro, Méier Hemengarda, Méier Isolina, Campo Grande, **Icaraí**,
Botafogo, Copacabana). Todas geraram `appointment_request`; só a do Icaraí não. O `schedule` dela foi
criado normalmente no meio da sequência (20:54:18, entre Campo Grande às 20:54:01 e Botafogo às
20:54:30). Não há trilha de auditoria do lado do staff — `client_portal_audit_events` só registra o
portal do cliente —, então não dá para distinguir "o insert falhou" de "alguém excluiu depois" pelo
botão de excluir definitivamente do painel. O efeito é o mesmo e a reparação é a mesma.

Sinal de apoio: não há nenhum anexo em `appointment_attachments` para essa inspeção, ou seja, o
relatório do Icaraí nunca chegou a ser publicado no portal.

### Reparação aplicada em produção — autorizada pela Ester na conversa

Uma linha inserida em `appointment_requests` (`a986c8b9-cd4d-46ae-b095-c4aa948f6840`), reconstruída a
partir do agendamento e do cadastro do cliente: vinculada ao `schedule_id` e ao `inspection_id`,
`requested_date` 30/06/2026 às 11:30, `consultant_names` herdado do agendamento,
`created_at` espelhando o momento real da criação da visita (16/06/2026 20:54:18) e `internal_notes`
registrando por escrito que o registro foi recriado em 06/08/2026 e por quê.

Status escolhido: **`completed`** ("Relatório em andamento"). É o estado coerente — a visita foi
realizada e a inspeção concluída, mas nenhum PDF foi publicado no portal. Assim ela aparece em
Solicitações ativas e a publicação do relatório segue pelo fluxo normal do painel.

Nenhuma outra linha foi tocada. Restam 9 `schedules` sem `appointment_request`, que são agendamentos
internos criados pela tela de Agenda e não passam pelo painel — comportamento esperado, não mexido.

### As duas mudanças de código

**1. Visita retroativa.** A Ester precisa registrar visitas em data passada para lançar relatórios de
inspeções antigas. O bloqueio era só de UI, em dois pontos, ambos removidos:

- `src/pages/Schedules.tsx` — `min={minScheduleDate}` no input de data do modal "Agendar Nova
  Inspeção" (a constante, que só servia a isso, saiu junto);
- `src/components/schedules/AppointmentRequestsPanel.tsx` — `min` no input de data do `NewVisitModal`.

`AppointmentAdminService.insertConfirmedRequest` e `ScheduleService.saveSchedule` não têm validação de
data, e não há `CHECK` no banco — nada mais a destravar. Os campos de confirmar, remarcar e prazo do
relatório já não tinham `min`. **As datas bloqueadas (`BlockedDatesSection`) mantêm o `min`
deliberadamente**: bloquear feriado no passado não faz sentido.

**2. Painel de solicitações.**

- Ordenação invertida: `byAppointmentDate` (crescente) virou `byNewestFirst`, aplicada às três seções.
- Paginação: `usePagedList` + `<Pager>`, `PAGE_SIZE = 10`, em pendentes, ativas e encerradas. O hook
  recua para a última página válida quando a lista encolhe (ex.: depois de excluir), em vez de mostrar
  uma página vazia.
- `showClosed` passou a iniciar `false`. Agora Ativas e Encerradas começam recolhidas; Pendentes
  continua sempre aberta, que é a caixa de entrada de trabalho.

### Resultado — 06/08/2026

- Produção: solicitação do Icaraí recriada e conferida por consulta — a visita de 30/06 volta a
  aparecer no painel, ligada à inspeção concluída com as 114 respostas.
- **173 testes passando** (21 arquivos) e `npm run build` OK. Nota: as 4 falhas de `sync.test.ts` que o
  REF-06 registrou como preexistentes não ocorrem mais.
- Verificação de UI: `tsc --noEmit` limpo e o app monta sem erro de console no dev server. O painel em
  si fica atrás do login e não foi aberto no navegador nesta sessão.
- **Fora de escopo, registrado e não executado:** o painel do staff não tem trilha de auditoria — uma
  exclusão de solicitação hoje não deixa rastro, e foi isso que impediu de fechar a causa raiz deste
  card. Enquanto não houver, um sumiço parecido continuará indistinguível entre falha de escrita e
  exclusão manual.

---

## 5. Decisões de produto já consolidadas

Valem para qualquer card do Portal 360 e não devem ser reabertas sem a Ester.

- **Dois destinos de Drive, com funções diferentes.** A Pasta Principal Completa é a raiz da
  empresa/rede, configurada na conta do portal, e deve ser o primeiro acesso documental. A Pasta
  Sanitária Personalizada continua vinculada à unidade. Um botão não substitui o outro. Contas com
  várias unidades mostram um botão de pasta principal e botões por unidade para as personalizadas.
  URL ausente ou inválida não pode gerar botão quebrado.
- **Tutorial do portal:** PDF global por tenant, versionado e configurável sem novo deploy. O
  clique entra na auditoria.
- **CTA de agendamento:** "Agendar horário com as consultoras". A página precisa perguntar o tipo
  de compromisso e aplicar regras próprias, não apenas trocar "inspeção" por "reunião".
- **Agenda multiuso sem contaminar inspeções.** Registros legados permanecem `inspection`. Só
  compromissos do tipo inspeção criam ou vinculam inspeção, exigem endereço, mostram prazo de
  relatório e usam a timeline sanitária. Reuniões, orientações e treinamentos não podem gerar
  inspeção vazia, prazo de relatório ou status sanitário. O cliente solicita; a equipe confirma e
  atribui consultora(s).
- **Colaboração no plano de ação.** O cliente nunca edita `responses`, checklists ou relatório
  publicado. Itens destinados ao portal vão para uma projeção própria e auditável. Evidência
  enviada passa por análise das consultoras antes de o item ser considerado resolvido.
- **Limites de arquitetura.** O InspecVISA é a fonte de verdade do portal e da agenda técnica. Um
  ERP externo pode, no futuro, receber apenas uma projeção mínima da agenda — data/hora,
  cliente/unidade, modalidade, consultoras, tipo, status e deep link. **Nunca** compartilhar token
  do portal, service role, fotos, checklists ou relatórios por integração direta.

---

## 6. Registro de execução

Ao concluir um card, marcar aqui e atualizar a tabela da seção 4.

| Data | Card | Modelo | SHA | Observação |
|---|---|---|---|---|
| 03/08/2026 | Recuperação do incidente OneDrive | Opus 5 | — | 35 arquivos restaurados, 49 cópias e 2 refs falsas removidas; 135 testes e build OK. |
| 03/08/2026 | **INFRA-01** — repositório movido para `C:\Saas\App` | Ester | — | Integridade verificada no destino: 135 testes, build, `git fsck`, `.env` e arquivos de trabalho preservados. |
| 04/08/2026 | **INFRA-02** — concluído | Opus 5 | — | `docs/migrations-status.md`: 23 arquivos verificados objeto a objeto no banco. Schema certo, ledger sujo (7 ausentes, 12 sob outra versão, 1 duplicado) — um `db push` teria reaplicado 19 dos 23 e revertido o PROD-01 e o overview de agosto. Ledger corrigido com autorização, sem tocar em schema. Pasta `migrations/` da raiz é histórica, não morta. |
| 04/08/2026 | **PROD-02** — concluído | Opus 5 | — | Falha de auditoria deixou de ser silenciosa: `console.error` + `auditHealth()` no portal, e o painel da consultora passou a distinguir "não consegui ler a trilha" de "nenhuma atividade". 138 testes JS e build passando. Confirmação com linha real depende do próximo acesso de cliente. |
| 04/08/2026 | **PROD-01** — concluído (e a parte de banco do **PROD-02**) | Opus 5 | — | O aviso de pagamento voltou a funcionar. A função já existia pronta na migration de junho que nunca foi aplicada; foi reescrita endurecida e aplicada como `20260805010139` + `20260805010218`. Trilha de auditoria criada, append-only, com grants para `anon` e `authenticated`. Suíte SQL nova, 135 testes JS passando. |
| 04/08/2026 | **PROD-04 + DEBT-01** — concluídos | Opus 5 | — | Solicitação órfã não bloqueia mais o horário e `deleteSchedule` cancela a vinculada; margem pública passou a ser por registro (inspeção 4 h, demais 30 min). Migration `20260804140000` aplicada em produção; 135 testes JS e as duas suítes SQL passando. Falta autorização para limpar 7 linhas `confirmed` órfãs. |
| 04/08/2026 | **PROD-03** — concluído | Opus 5 | — | Gatilhos de disponibilidade viraram `security definer`; agendamento pelo app voltou a funcionar. Migration `20260804120000` aplicada em produção. |
| 03/08/2026 | **EST-01** — concluído | Opus 5 | — | Roteiro de clínica ajustado (CNAE crítico; manipulados reintroduzido) de 113 para 114 itens. Migração executada: 124/124 respostas, 0 órfãs, 8 fotos preservadas. Agendamento vinculado, entrega automática destravada. |
| 05/08/2026 | **EST-02** — concluído | Sonnet 5 | — | Suplemento RJ já funciona hoje por código (`supplementRegistry` casa por `id` estático ou por `name`); já havia teste cobrindo o cenário de UUID do Supabase. Nada foi alterado, só verificado. |
| 05/08/2026 | **REF-03** — concluído | Sonnet 5 | — | Partes (a) e (b) adiantadas antes de REF-02 e fechadas com teste nesta sessão: `PdfPreviewModal.test.tsx` (5 casos) e `pdfGenerator.test.ts` (3 casos). Achado: `jsPDF.text` é propriedade de instância, não do prototype — `vi.mock('jspdf', ...)` foi o caminho, não `spyOn(prototype)`. 146 testes JS, build OK. |
| 05/08/2026 | **DEBT-03** — concluído | Sonnet 5 | — | `sala-estetica.html` removido (autorizado pela Ester na conversa: "não faz parte desse projeto"). Ícones PWA quantizados sem perda visível (−90%, `public/` de 1,3 MB para 256 KB). `globPatterns` do service worker restrito a `js/css/html/woff2` — ícones seguem precacheados via `includeAssets`; achado: `logo sem fundo treinavisa.png`, não usado em lugar nenhum, estava sendo precacheado à toa pelo glob antigo. Precache: 72→66 entradas. Arquivos de negócio na raiz preservados, como já decidido. |
| 05/08/2026 | **REF-01** — concluído | Sonnet 5 | — | `docs/referencias/inventario.csv`: 918 itens (100% de cobertura), via `scripts/ref01-build-inventory.ts` reusando `extractBaseLegislation`/`canonicalLegislationKey`. Achado: bug real em `canonicalLegislationKey` (também usada ao vivo por `PdfPreviewModal.tsx`) fragmentava um mesmo ato em várias chaves quando o texto começava com "Art. N" antes da citação — caso confirmado: Lei Municipal 1.812/2014 (19 itens) virava 5 chaves diferentes. |
| 05/08/2026 | Correção do bug de `canonicalLegislationKey` (tarefa em segundo plano acionada pela Ester) | Sonnet 5 | — | `extractBaseLegislation` passou a reconhecer "Municipal"/"Ordinária" como qualificador de `Lei` (com sigla de UF opcional); `canonicalLegislationKey` passou a ancorar a busca do número na posição do tipo reconhecido, não no início da string. `src/__tests__/utils/legislationRefs.test.ts` novo, 6 casos. Inventário do REF-01 regerado: 62 → 57 chaves canônicas (as 19 respostas da Lei Municipal 1.812/2014 se uniram em uma só). 152 testes JS, build OK. |
| 06/08/2026 | **REL-01** — concluído | Opus 5 | — | O relatório passou a listar, na íntegra, os itens cumpridos (bloco `RELAÇÃO DOS ITENS CUMPRIDOS`, uma tabela por seção, com código, descrição completa e base legal), logo depois da tabela de conformidade por área. Antes, item cumprido sem observação digitada não aparecia em lugar nenhum — só as falhas eram nomeadas. Coluna `Regularizado` marca o que estava em NC em visita anterior, reusando o `recurringItemIds` já carregado (sem consulta nova; sem histórico, nenhuma etiqueta). Achado corrigido de quebra: `addFooter` rodava em dois laços e imprimia `Página 1 de 8` por baixo de `Página 1 de 9` em **todo** relatório já emitido. 4 testes novos, 21 no diretório `utils`, `tsc -b` limpo, conferido em PDF real. |
| 06/08/2026 | **AGD-01** — concluído, 1 linha recriada em produção | Opus 5 | `a47a400` | A inspeção do Icaraí de 30/06 nunca foi apagada: 114 respostas íntegras, agendamento vinculado. Faltava a linha em `appointment_requests` — no lote de 7 visitas criadas em 16/06 entre 20h41 e 20h54, só a do Icaraí não gerou solicitação, e sem trilha de auditoria do staff não dá para separar falha de escrita de exclusão manual. Recriada com autorização, status `completed` (nenhum PDF publicado no portal). Código: `min` de data removido do modal de agendamento e do de Nova visita (as datas bloqueadas mantêm, de propósito) — não havia validação equivalente no serviço nem `CHECK` no banco; painel passou a ordenar do mais recente para o mais antigo, paginar de 10 em 10 nas três seções e abrir com Ativas e Encerradas recolhidas. 173 testes e build OK. |
| 07/08/2026 | **PORT-01** — concluído, aplicado em produção | Opus 5 | `96d344b` | Achado que motivou metade do card: ligar "suspender agendamento" **também** bloqueava o download de tudo que já tinha sido entregue — a Edge Function usava `scheduling_suspended` para decidir se assinava a URL dos anexos, desde junho. Separado: atraso suspende agendar; esconder entrega virou decisão explícita por conta, em `client_portal_account_features` (liberado/oculto/programado + travar em atraso), com `private.portal_account_gates` como fonte única lida pelo overview, pelo plano de ação, pelo agendamento e pela Edge Function (v5→v6). Suspensão virou modo (`auto`/`always_open`/`suspended`) com tolerância de 5 dias por tenant; liberação programada sem cron, decidida na leitura. Controles reorganizados num modal "Acesso do portal"; o toggle saiu do modal de Pagamento. Medido antes de aplicar: nenhuma das 3 contas ativas muda de estado (atraso exige vencimento cadastrado). Prova no app com conta 30 dias vencida: agendamento suspenso sozinho e relatório/foto/score visíveis ao mesmo tempo. Suíte SQL nova; 235/239 testes. |
| 07/08/2026 | **P360-011** — concluído, aplicado em produção | Opus 5 | `ae8f38c` | O cliente passou a responder a pendência: manda a prova, a consultora aprova ou devolve com orientação. Três decisões seguraram o desenho — **upload não resolve nada** (aprovar o arquivo e resolver a pendência são dois botões separados, `p_resolve_item`); **o cliente não escolhe onde o arquivo cai** (nome e caminho gerados no servidor, extensão vinda do MIME conferido, `../../etc/passwd` vira `passwd.pdf`); e **bucket próprio** `client-action-evidence`, privado, porque o `client-portal-files` tem policy que libera para `anon` todo objeto de `appointment_attachments`. Nenhum papel do navegador escreve no bucket: as RPCs de envio/leitura/descarte só têm grant para `service_role`, e a Edge Function é a única porta — ela confere os **magic bytes**, então `.exe` renomeado de `.pdf` não entra. Idempotência por `(item, upload_key)`, com caminho derivado da chave: retry sobrescreve o mesmo objeto. Registra primeiro, sobe depois, e desfaz o registro se a subida falhar. Prova contra produção e as Edge Functions reais: envio, retry sem duplicar, devolver, reenviar, aprovar sem resolver, aprovar e resolver, trava do portal, URL assinada expirando em 8s e renovando, objeto inacessível sem token e para `anon`, e auditoria sem caminho nem URL. Dados de teste apagados e conferidos em zero, inclusive no Storage. Suíte SQL nova + 20 testes JS; 259/259. |
| 07/08/2026 | **PORT-02** — concluído, aplicado em produção | Opus 5 | `df3eca0` | A Rede Sênior tem **13 casas atrás de uma conta só**: quem acompanha a correção em cada casa é o gestor dela, e não havia como dar acesso sem entregar o login do dono, que abre as treze. Decisão da Ester: o link do relatório passa a abrir **sem senha**, com a contrapartida que ela propôs — **nome e função obrigatórios em todo envio de evidência**, nos dois caminhos, porque a conta do portal é da empresa e nunca respondeu quem foi. O link não afrouxa o resto: `report_hidden` fecha tudo (é o botão de pânico para link vazado), o arquivo segue no bucket privado com URL temporária, o token só abre a unidade daquela visita e, sem conta, não vai link de pagamento na resposta. **Efeito retroativo registrado:** é o mesmo `public_token` de sempre, então todo link já enviado por WhatsApp passou a abrir sem login. A regra de registro virou uma só (`private.register_action_evidence`) para os dois caminhos, e a assinatura antiga que aceitava envio anônimo foi derrubada de propósito (há teste que falha se voltar). Provado contra a visita real da Icaraí: abre sem login com os 44 anexos assinados, o caminho logado não regrediu, conta de outro cliente segue negada e `anon` não registra evidência direto (`permission denied`). Suíte SQL nova; 266/266. |
| 07/08/2026 | **REL-03** — concluído | Opus 5 | `15fd415` | Fecha o ciclo: a prova que o cliente manda chega até a tela em que a decisão sanitária acontece — o roteiro, dentro da casa — e até o relatório final. O elo é o `source_item_id`, que já era o id do item do roteiro desde o P360-010. Na vistoria, a caixa "Plano de ação anterior" mostra a alegação, quem assinou, quando e o arquivo por URL temporária; a busca roda fora do `await` da abertura, então sem sinal o roteiro abre igual. No PDF, como a Ester decidiu: **registro textual sempre, imagem só do que ela aprovou** — item que voltou a ser NC leva a alegação junto do achado, e o que a vistoria confirmou ganha a seção "EVIDÊNCIAS APRESENTADAS PELO CLIENTE", com a frase que impede a leitura errada (a conclusão é a verificação em campo, não o recebimento do arquivo). Conferido em PDF real com `pdftotext`: sem vazamento de caixa. Sem migration. 278/278. |
| 07/08/2026 | **PORT-03** — concluído, aplicado em produção | Opus 5 | `9d39cd9` | Lacuna que a Ester apontou: *"não tem onde dizer que a pasta não foi feita"*. A única ação do cliente no plano era anexar arquivo; quem ainda não corrigiu ficava mudo, e mudo é indistinguível de "nem abriu o portal". Três estados — "Já corrigi", "Estou providenciando", "Ainda não fiz" — com justificativa obrigatória só no último, porque "não fiz" sozinho não serve para a próxima visita e exigir texto nos outros faria o cliente desistir de responder. Assinatura obrigatória como no PORT-02, e **declarar não resolve pendência**: continua sendo a consultora, com a vistoria em campo confirmando (REL-03). A resposta chega ao painel, à caixa do item na nova vistoria e ao relatório final, antes da evidência. Junto veio o conserto do que ela viu: o plano de ação subiu para o **topo** da página do relatório e passa a aparecer **mesmo vazio**, explicando que ainda não há pendência publicada — sumir quando vazio foi o que a fez concluir que o link não abria o plano, com `client_action_items` zerado em produção. Suíte SQL nova; 281/281. |
| 07/08/2026 | **P360-010** — concluído, aplicado em produção | Opus 5 | `3bd8376` | `client_action_items` é projeção, não espelho: publicar o relatório copia as NCs, e nada no portal toca em `responses`. Um índice único parcial (`where status <> 'resolved'`) resolve os três casos de uma vez — republicação idempotente, reincidência somando ocorrência no item aberto, e item resolvido preservado como histórico quando a inspeção nova republica o mesmo requisito. Gate de visibilidade é o `report_hidden` da visita, reaplicado em tempo real na leitura; suspensão de agendamento **não** esconde item (decisão registrada). Vencimento ancorado em `America/Sao_Paulo`. Grants conferidos em produção com `has_table_privilege`. Prova feita no app contra o banco de produção com conta de teste — plano de ação, prazo vencido, resolver e histórico confirmados na tela — e todos os dados de teste apagados depois. 17 testes JS novos + suíte SQL nova; 235/239 testes (as 4 falhas são anteriores, confirmado com `git stash`). |
| 06/08/2026 | **REF-06** — concluído, aplicado em produção | Opus 5 | `071adb2`, `8796143` |  Medido: dos 303 `item_id` órfãos, 272 eram "defeito" no papel mas só 6 inspeções tinham id de código; o que degradava mesmo eram 19 dos 26 relatórios concluídos (376 respostas), por três causas — inspeção criada antes do sync de roteiros, `city`/`state` que o servidor não devolve (suplemento regional some offline) e item reescrito no lugar trocando a pergunta de 18 respostas já entregues (o REF-05 fez a terceira). Decidido não remapear `responses`: congela-se o roteiro da época em `inspection_report_versions`. Roteiros `tpl-ilpi-v1` e federal-97 reconstruídos do git; o de 97 confere seção a seção com o PDF entregue ao Lar Recanto do Sossego em 14/04/2026. Código, scripts e simulação prontos e conferidos; 162 testes passando (as 4 falhas de `sync.test.ts` são anteriores). Duas cargas: a primeira congelou 15 relatórios e marcou 28 respostas com `deleted_at`; a segunda, depois de corrigir o script (a seção degradada estava sendo usada como fonte de texto), refez 6. Diagnóstico final: **0 respostas degradadas** nos 26 relatórios, contra 376 no começo. |
| 08/08/2026 | **P360-015** — concluído; sem migration, com dados de homologação criados em produção | Opus 5 | a registrar após o deploy | Três premissas do card não existiam: **não havia homologação** (um tenant com dados, nenhuma conta de teste), **não havia CI** (`.github/` ausente; o Vercel publica direto do push) e **as ondas do Portal 360 já estavam liberadas** no tenant de produção — o card chega como mecanismo daqui em diante, não como escalonamento do que já foi. Entregues: marca de build (`/build-info.json` + meta `build-sha`, fora do precache de propósito), smoke que procura a **string literal** de cada onda dentro dos chunks do `sw.js`, CI com três jobs (build+vitest, as 15 suítes SQL em Postgres puro, E2E sob demanda), tenant de homologação com seed e teardown que confere em zero, e 25 testes Playwright rodados em desktop e Pixel 5 (**50 execuções, todas passando**). Prova do bundle: o publicado é idêntico ao build local do `33c11fd` depois de normalizar hashes, com **uma** diferença de conteúdo — a env `VITE_DEFAULT_TENANT_ID` da Vercel tem um **BOM (U+FEFF)**, hoje neutralizado por `cleanTenantId` e perigoso para o próximo consumidor. Achados de segurança sem exploração ativa viraram **SEC-01**: bucket `photos` público (vazio, sem uso) e grants de `anon` em 20 tabelas antigas (provado com `set role anon` que não rendem nada — só o RLS segura). Corrigido de quebra: os labels do login da equipe não tinham `htmlFor`/`id`, e um leitor de tela anunciava o campo de senha como "••••••••" — o E2E achou porque procura o campo pelo rótulo. Também descoberto: o catch-all do `vercel.json` responde **200 com o index.html** para caminho inexistente, então "health endpoint responde" não prova nada aqui. 314 testes JS, 15 suítes SQL, build OK. |
| 15/08/2026 | **PORT-02 (emenda)** — anexo genérico sai do link aberto, exige conta | Sonnet 5 | — | A Ester revisou a decisão original do PORT-02 depois de ver a aba Documentos do portal: os `kind='attachment'` (arquivos soltos, diferentes de relatório e foto) carregam documento confidencial, e o nome do arquivo sozinho já revela isso — não dá pra deixar nem a lista visível pra quem só tem o link. Relatório e fotos **continuam** abrindo sem login (mantém o caso original da Rede Sênior — gestor de casa sem conta própria); só `attachment` passou a exigir `accountToken` válido em `client-appointment-assets`. Sem `account`, a linha nem entra no array `visibleRows` — quem abre só o link não recebe nome de arquivo nenhum, não é só a URL assinada que fica de fora. Edge Function redeployada em produção (v9) e testada direto contra uma visita real (Riocentro) sem `accountToken`: o `attachment` publicado sumiu da resposta, relatório e as 44 fotos continuaram. Sem migration — só código da Edge Function. |
