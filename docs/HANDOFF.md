# Handoff único — InspecVISA

**Última atualização:** 06/08/2026 (BRT), ao concluir o código do REF-04 ·
**Branch:** `main`, sincronizada com `origin/main` · O estado da seção 2 foi verificado em 03/08/2026,
com as correções de 04/08 e 05/08 anotadas nas tabelas.

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

**A omissão silenciosa do relatório foi corrigida no REF-03** (05/08): `drawReferencesABNT` não
descarta mais a norma que não tem verbete na biblioteca. O REF-02 removeu, além disso, uma cópia
defasada de `extractBaseLegislation` que vivia dentro de `pdfGenerator.ts` e nunca recebeu as
correções do REF-01 — era ela que fazia a página de referências listar a mesma lei municipal cinco
vezes, uma por artigo citado.

**O que o REF-02 deixou aberto, e o REF-04 fechou** (06/08): os 48 itens `legal` que continuavam sem
URL não tinham problema de resolução — a citação simplesmente não nomeava ato ("Boas Práticas",
"Normas do Corpo de Bombeiros"). 47 deles estão em roteiros `[ARQUIVADO]` e 1 no ILPI Goiás. Ver
REF-04 para a tabela de decisões. Registre-se, porque é fácil confundir: **`requirement_type` não
entra no cálculo do score** — `scoring.ts` usa só `weight` e `isCritical`; o campo só muda o rótulo e
a página de referências do PDF.

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
| **REF-02** | Sanear a biblioteca e ligá-la aos roteiros | Opus 5 | alto | REF-01 (concluído) | ✅ **código concluído 05/08** · carga em produção aguarda autorização |
| **REF-03** | Fontes consultadas e links no relatório | Sonnet 5 | médio | REF-02 (só para enriquecer, não bloqueia) | ✅ **concluído 05/08** |
| **REF-04** | Curar itens legais que citam texto genérico | Opus 5 | baixo | REF-02 (concluído) | 🟡 **código concluído 06/08** · gravação em produção pendente |
| **PROD-01** | Aviso de pagamento quebrado no portal | Opus 5 | médio | — | ✅ **concluído 04/08** |
| **PROD-02** | Auditoria do portal não grava nada | Opus 5 | baixo | — | ✅ **concluído 04/08** |
| **P360-008** | Detalhe, notificações e calendário | Sonnet 5 | alto | — | ⬜ pendente |
| **P360-009** | Início do portal por próximas ações | Sonnet 5 | alto | P360-008 | ⬜ pendente |
| **P360-010** | Projeção segura do plano de ação | Opus 5 | alto | — | ⬜ pendente |
| **P360-011** | Evidências do cliente e revisão técnica | Opus 5 | alto | P360-010 | ⬜ pendente |
| **P360-012** | Solicitações estruturadas de consultoria | Opus 5 | alto | — | ⬜ pendente |
| **P360-013** | Painel operacional das consultoras | Sonnet 5 | alto | 010, 011, 012 | ⬜ pendente |
| **P360-014** | Acessibilidade e responsividade | Sonnet 5 | médio | superfícies estáveis | ⬜ pendente |
| **P360-015** | E2E, rollout e prova de produção | Opus 5 | alto | onda a publicar | ⬜ pendente |
| **DEBT-01** | Margem pública de 4 h por tipo | Sonnet 5 | médio | — | ✅ **concluído 04/08** |
| **DEBT-02** | Dívida de lint | Sonnet 5 | médio | — | ⬜ pendente |
| **DEBT-03** | Pontas soltas do repositório | Haiku 4.5 | baixo | — | ✅ **concluído 05/08** |

Ordem sugerida: aplicar a carga do **REF-02** em produção (migration + backfill, ambos aguardando
autorização) e a partir daí a onda do Portal 360. (INFRA-01, INFRA-02, EST-01, EST-02, PROD-01,
PROD-02, PROD-03, REF-01, REF-02, REF-03 e DEBT-03 já saíram da fila.)

Cards P360-001 a P360-007 foram concluídos e não aparecem aqui.

## 4.1 Divisão por modelo

São **8 cards pendentes** (EST-02, REF-01, REF-02, REF-03 e DEBT-03 concluídos em 05/08). A divisão abaixo é
o critério de despacho: abra a sessão com o modelo indicado e cole o card correspondente.

### Opus 5 — 4 cards

Tudo que toca **banco, segurança ou decisão normativa**. O erro aqui é caro e silencioso: uma RPC
sem grant correto quebra só para quem está logado, uma norma revogada citada como vigente vira
laudo errado, e um mapeamento de item malfeito reescreve a inspeção de uma cliente real.

| Card | Por que Opus 5 |
|---|---|
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

- [ ] `npx tsx scripts/ref04-curadoria-requirement-type.ts` reporta `legais sem ato e sem decisão: 0`.
- [ ] Depois do `--apply`, `scripts/ref02-backfill-item-urls.ts` em simulação não lista mais nenhum
      item legal sem URL.
- [ ] Reexecutar o `--apply` não grava nada (`a gravar: 0`).
- [ ] `npx vitest run` sem regressão sobre a linha de base de 162 passando.

### Fora de escopo — registrado, não executado

A lacuna maior de `requirement_type` continua aberta: o padrão de seed em
`templateService.ts:272` é `item.requirementType || 'legal'`, então **todo** item de ILPI e de
alimentos nasceu `'legal'`. Depois deste card o banco tem 889 `legal` e 54 `good_practice`, e os
`good_practice` são só de estética. Esses itens **citam ato real** (por isso não apareceram aqui),
mas parte deles é boa prática rotulada como exigência legal. Curar ILPI e alimentos é card próprio,
com decisão sanitária item a item — não cabia neste.

Vale também avaliar estender o invariante "todo item legal resolve URL" do
`legislationLibrary.test.ts` (hoje só sobre os roteiros em código) para o banco.

### Resultado — 06/08/2026

**Código concluído; a gravação em produção não foi executada.** A simulação fecha em 48 itens
(29 → `good_practice`, 19 → `legal` reancorado), zero sem decisão. `npx vitest run`: 162 passando,
4 falhas preexistentes (`settingsStore.test.ts`, `sync.test.ts` — confirmadas com `git stash`, não
têm relação com esta alteração).

O `--apply` foi bloqueado pelo classificador de permissões do harness, não por falta de autorização
da Ester — ela autorizou o escopo completo na conversa de 06/08. Para concluir, rodar no terminal:

```
npx tsx scripts/ref04-curadoria-requirement-type.ts --apply
```

Depois disso, marcar os critérios de aceite e fechar o card.

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

## P360-008 — Detalhe, notificações e calendário do compromisso

**Modelo:** Sonnet 5 · **Esforço:** alto · **Prioridade:** P1

**Resultado:** o cliente recebe confirmação útil, link de reunião e opção de adicionar ao calendário.

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

---

# Bloco 5 — Dívida técnica

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

## DEBT-02 — Dívida de lint

**Modelo:** Sonnet 5 · **Esforço:** médio · **Prioridade:** baixa, mas bloqueia lint no CI

`npm run lint` falha no projeto inteiro, com ~425 erros majoritariamente
`@typescript-eslint/no-explicit-any`.

### Implementação

1. `npx eslint . -f json` e agrupar por regra e por diretório para dimensionar.
2. Atacar por fatia, começando por `src/services/`, onde `any` esconde erro de contrato com o
   Supabase. Um PR por fatia, sem misturar com mudança de comportamento.
3. Ligar o lint no CI só quando a fatia estiver zerada; até lá, um `--max-warnings` por diretório
   evita regressão.

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
