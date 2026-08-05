# Handoff único — InspecVISA

**Última atualização:** 04/08/2026 (BRT), ao concluir PROD-01 · **Branch:** `main`, sincronizada com
`origin/main` · O estado da seção 2 foi verificado em 03/08/2026, com as correções de 04/08 anotadas
nas tabelas.

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
objeto — em [`docs/migrations-status.md`](migrations-status.md). **Não rodar `supabase db push`**
antes do `migration repair` descrito lá: o CLI tentaria aplicar a migration de junho da auditoria e
reverteria o endurecimento do PROD-01.

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

### 2.6 Referências legislativas — o problema real

| Medida | Valor |
|---|---|
| Registros na tabela `legislations` | **42** |
| Referências distintas citadas nos itens dos roteiros | **457** |
| Atos normativos distintos por trás dessas referências (aprox.) | **~170** |
| Referências dos roteiros que existem em `legislations` | **10** |
| Itens de checklist no banco | 917 |
| Itens **sem** `legislation_url` | **801** (87%) |
| Registros em `legislations` sem UF | 32 |
| Registros em `legislations` sem segmento | 16 |

Há uma consequência direta e silenciosa disso no produto. Em
`src/utils/pdfGenerator.ts`, a função `drawReferencesABNT` monta a página "REFERÊNCIAS
LEGISLATIVAS" e, no caminho automático, só inclui uma norma **se ela existir na biblioteca com
`name` e `summary` preenchidos**:

```ts
if (libEntry && libEntry.name && libEntry.summary) {
  mentionedSet.add(b);
}
```

Como só 10 dos ~170 atos citados estão na biblioteca, **a página de referências do relatório
descarta em silêncio a grande maioria das normas efetivamente aplicadas**. O relatório não avisa
que omitiu nada. Ver REF-01, REF-02 e REF-03.

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
| **EST-02** | Verificar suplemento RJ de estética | Sonnet 5 | baixo | — | ⬜ pendente |
| **REF-01** | Catalogar os ~170 atos citados | Haiku 4.5 | médio | — | ⬜ pendente |
| **REF-02** | Sanear a biblioteca e ligá-la aos roteiros | Opus 5 | alto | REF-01 | ⬜ pendente |
| **REF-03** | Fontes consultadas e links no relatório | Sonnet 5 | médio | REF-02 | ⬜ pendente |
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
| **DEBT-03** | Pontas soltas do repositório | Haiku 4.5 | baixo | — | ⬜ pendente |

Ordem sugerida: **REF-01 → REF-02 → REF-03**, e a partir daí a onda do Portal 360.
(INFRA-01, INFRA-02, EST-01, PROD-01 e PROD-02 já saíram da fila.)

Cards P360-001 a P360-007 foram concluídos e não aparecem aqui.

## 4.1 Divisão por modelo

São **14 cards pendentes**. A divisão abaixo é o critério de despacho: abra a sessão com o modelo
indicado e cole o card correspondente.

### Opus 5 — 5 cards

Tudo que toca **banco, segurança ou decisão normativa**. O erro aqui é caro e silencioso: uma RPC
sem grant correto quebra só para quem está logado, uma norma revogada citada como vigente vira
laudo errado, e um mapeamento de item malfeito reescreve a inspeção de uma cliente real.

| Card | Por que Opus 5 |
|---|---|
| **REF-02** | Verificação de vigência de ~170 atos e carga na biblioteca. Norma revogada cadastrada como vigente é erro que sai no relatório. |
| **P360-010** | RLS, projeção de dados sanitários, isolamento entre tenants. |
| **P360-011** | Storage privado, URL assinada, upload autenticado por token. |
| **P360-012** | Tabelas novas tenant-scoped, rate limit, permissão por papel. |
| **P360-015** | Revisão final de segurança e prova de produção. |

### Sonnet 5 — 7 cards

**Feature de UI e refatoração com critério de aceite objetivo.** Escopo fechado, o resultado se vê
na tela e o teste diz se está certo.

| Card | Por que Sonnet 5 |
|---|---|
| **EST-02** | Verificação pontual de código com resposta objetiva: o suplemento RJ funciona ou não. |
| **REF-03** | Feature de UI + seção nova no PDF, seguindo o padrão que `PdfPreviewModal` já usa. |
| **P360-008** | Geração de `.ics`, templates de e-mail, timeline condicional. Muita mecânica, pouca decisão. |
| **P360-009** | Decomposição de página e regra de prioridade determinística. |
| **P360-013** | Painel agregado sobre estruturas que os cards anteriores já terão criado. |
| **P360-014** | Acessibilidade e responsividade — critério objetivo e verificável por ferramenta. |
| **DEBT-02** | Fatiar `any` por diretório, um PR por fatia, sem mudar comportamento. |

> **P360-015 é a exceção da regra.** Os testes E2E podem ser escritos por Sonnet 5, mas a revisão
> de segurança, migrations e prova de produção tem de ser feita com Opus 5.

### Haiku 4.5 — 2 cards

**Varredura mecânica, sem decisão.** Entrada e saída bem definidas, nenhum julgamento técnico.

| Card | Por que Haiku 4.5 |
|---|---|
| **REF-01** | Extrair, normalizar com funções que já existem e tabular. Nenhuma decisão de vigência — isso é REF-02. |
| **DEBT-03** | Quatro pontas soltas independentes e já descritas, sem ambiguidade. |

### O que não delegar por modelo, e sim à Ester

Três pontos de decisão que nenhum modelo resolve sozinho, e que os cards marcam como parada
obrigatória:

1. **REF-02** — acordar a meta de cobertura da biblioteca.

EST-01 e PROD-01 já passaram por essa parada: o mapa de migração foi aprovado item a item em
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

**O schema de produção está certo; o ledger é que está sujo.** 7 arquivos de junho não constam,
9 constam sob outra versão, 1 está duplicado.

**O achado que importa:** se alguém rodar `supabase db push`, o CLI vai tentar aplicar os 7 que
"faltam" — inclusive `20260613125641_client_portal_audit`, que **reverteria o PROD-01**: voltaria
`search_path = public` nas duas funções e recriaria as policies de update e delete na trilha de
auditoria. Enquanto o `migration repair` não for feito, não rodar `db push`.

**Segundo achado:** a entrada `026b_create_appointment_suspend_guard` está no ledger e **não tem
arquivo em lugar nenhum** — foi aplicada direto em produção e nunca commitada. A guarda de suspensão
de agendamento sobreviveu por acaso: as três migrations de agosto que redefiniram
`client_portal_create_appointment` carregaram `scheduling_suspended` adiante. Bastava uma delas ter
sido escrita sem a guarda para a suspensão parar de funcionar em silêncio.

**A pasta `migrations/` da raiz é histórica, não morta.** Último commit em 18/06/2026. 4 arquivos são
cópias byte a byte de arquivos em `supabase/migrations/`; os outros 29 são o único registro de coisas
que estão em produção (multi-tenant, RLS, bucket de fotos, o sync em lote com 3.189 linhas em
`sync_jobs`). Não apagar, não rodar — renomear para `migrations-legadas/` com um README.

**Pendente de autorização da Ester** (as duas escrevem no ledger de produção): o `migration repair`
das 7 versões e o `delete` da linha duplicada `20260803205941`.

Nenhuma migration foi aplicada durante este card.

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

## EST-02 — Verificar o suplemento RJ de estética

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

---

# Bloco 2 — Referências e banco de referências

## REF-01 — Catalogar os atos normativos citados nos roteiros

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

## DEBT-03 — Pontas soltas do repositório

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
| 04/08/2026 | **INFRA-02** — concluído | Opus 5 | — | `docs/migrations-status.md`: 23 arquivos verificados objeto a objeto no banco. Schema certo, ledger sujo (7 ausentes, 9 sob outra versão, 1 duplicado). **Não rodar `supabase db push`** antes do `migration repair`: ele reaplicaria a migration de junho e reverteria o PROD-01. Pasta `migrations/` da raiz é histórica, não morta. Nada aplicado. |
| 04/08/2026 | **PROD-02** — concluído | Opus 5 | — | Falha de auditoria deixou de ser silenciosa: `console.error` + `auditHealth()` no portal, e o painel da consultora passou a distinguir "não consegui ler a trilha" de "nenhuma atividade". 138 testes JS e build passando. Confirmação com linha real depende do próximo acesso de cliente. |
| 04/08/2026 | **PROD-01** — concluído (e a parte de banco do **PROD-02**) | Opus 5 | — | O aviso de pagamento voltou a funcionar. A função já existia pronta na migration de junho que nunca foi aplicada; foi reescrita endurecida e aplicada como `20260805010139` + `20260805010218`. Trilha de auditoria criada, append-only, com grants para `anon` e `authenticated`. Suíte SQL nova, 135 testes JS passando. |
| 04/08/2026 | **PROD-04 + DEBT-01** — concluídos | Opus 5 | — | Solicitação órfã não bloqueia mais o horário e `deleteSchedule` cancela a vinculada; margem pública passou a ser por registro (inspeção 4 h, demais 30 min). Migration `20260804140000` aplicada em produção; 135 testes JS e as duas suítes SQL passando. Falta autorização para limpar 7 linhas `confirmed` órfãs. |
| 04/08/2026 | **PROD-03** — concluído | Opus 5 | — | Gatilhos de disponibilidade viraram `security definer`; agendamento pelo app voltou a funcionar. Migration `20260804120000` aplicada em produção. |
| 03/08/2026 | **EST-01** — concluído | Opus 5 | — | Roteiro de clínica ajustado (CNAE crítico; manipulados reintroduzido) de 113 para 114 itens. Migração executada: 124/124 respostas, 0 órfãs, 8 fotos preservadas. Agendamento vinculado, entrega automática destravada. |
