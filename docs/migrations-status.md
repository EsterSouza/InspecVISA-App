# INFRA-02 — Ledger de migrations × schema real

**Auditoria:** 04/08/2026 (BRT) · **Projeto:** `pfjacmawaigndqclgvpn` (produção)
**Correção do ledger:** aplicada em 04/08/2026, com autorização da Ester. Nenhuma migration de
schema foi aplicada — as escritas foram só na tabela de registro
(`supabase_migrations.schema_migrations`).

---

## Situação atual: resolvido

**As 23 migrations de `supabase/migrations/` estão registradas sob a versão do próprio arquivo.**
Um `supabase db push` hoje não teria nada a aplicar. Antes da correção, teria tentado aplicar 19 das
23 e revertido comportamento em produção.

O que foi corrigido no ledger:

| Situação encontrada | Quantos | O que foi feito |
|---|---|---|
| Arquivo aplicado no banco, **ausente** do ledger | 7 | linha inserida com a versão do arquivo |
| Arquivo registrado **sob outra versão** | 12 | versão da linha renomeada para a do arquivo |
| Arquivo com versão **já correta** | 4 | nada |
| Entrada **duplicada** (`checklist_items_requirement_type`) | 1 | linha `20260803205941` apagada |

O ledger foi de 39 para **45 linhas**: 23 correspondem 1:1 aos arquivos e 22 são história anterior a
junho/2026, sem arquivo em `supabase/migrations/` (seção C).

---

## Método da auditoria

Para cada arquivo, em vez de conferir se a versão constava no ledger, foi conferido se **o conteúdo
está no banco**: colunas em `information_schema.columns`, funções e assinaturas em `pg_proc` (com
`prosecdef` e `proconfig`), gatilhos em `pg_trigger`, policies em `pg_policies`, índices em
`pg_indexes`, constraints em `pg_constraint`, grants por `has_function_privilege` /
`has_table_privilege`, buckets em `storage.buckets`.

Para as funções redefinidas muitas vezes, a verificação foi por **marcador de conteúdo** dentro de
`pg_get_functiondef` — por exemplo, se `client_portal_overview` em produção menciona
`main_drive_folder_url`, então a migration de agosto que introduziu esse campo está aplicada de fato,
e não apenas registrada.

---

## A. `supabase/migrations/` — 23 arquivos

Coluna "ledger antes": onde a linha estava antes da correção de 04/08/2026. Hoje todas estão sob a
versão do arquivo.

| Arquivo | Conteúdo no banco? | Ledger antes | Evidência no schema real |
|---|---|---|---|
| `20260525135030_add_ilpi_cleaning_metrics` | ✅ | já correta | `inspections.observed_cleaning_staff`, `usable_area_m2` |
| `20260611091522_client_portal_access_email_calendar` | ✅ | **ausente** | `client_portal_overview` e `client_portal_create_appointment` existem, já superadas por versões de agosto |
| `20260611101800_client_portal_access_links_and_folder` | ✅ | **ausente** | `client_portal_accounts.username`, `access_code_plain`; `clients.has_personalized_sanitary_folder`, `personalized_sanitary_folder_url` |
| `20260611132931_persist_consultant_settings` | ✅ | **ausente** | tabela `profiles` com `consultant_settings`, `consultant_role`, `coren`; RLS ativa |
| `20260611202749_lock_down_public_portal_token_access` | ✅ | **ausente** | `public_get_appointment_status` e `public_get_appointment_assets` sem execute para `anon` **e** `authenticated` |
| `20260612101234_portal_account_contact_and_payment_due_date` | ✅ | **ausente** | `client_portal_accounts.payment_type/status/link/updated_at/due_date` |
| `20260612113611_client_contacts_and_payment_links` | ✅ | **ausente** | `clients.contacts`; `client_portal_accounts.payment_links` |
| `20260613125641_client_portal_audit` | ⚠️ nunca aplicada | **ausente** | os objetos existem, mas vindos de `20260805010139` — com `search_path = ''` e sem policy de escrita. Registrada como aplicada para nunca rodar; ver aviso no topo do arquivo |
| `20260627120000_portal_area_scores` | ✅ | `20260627164215` | `appointment_requests.sanitary_score`, `nutrition_score`; overview menciona `nutrition_score` |
| `20260709060000_appointment_requests_add_nc_stats` | ✅ | `20260709082424` | `critical/important/total/recurring/immediate_nc_count`, `nc_items` |
| `20260709060100_client_portal_overview_add_nc_stats` | ✅ | `20260709082437` | overview menciona `immediate_nc_count` |
| `20260717090000_client_portal_invoices` | ✅ | `20260717135804` | tabela `client_portal_invoices` (1 linha), RLS ativa |
| `20260801134443_portal_main_folder_and_settings` | ✅ | `20260802113029` | tabela `client_portal_settings`; `client_portal_accounts.main_drive_folder_url`; overview menciona `action_plan_enabled` |
| `20260801144828_harden_portal_rpc_permissions` | ✅ | já correta | `admin_*` sem execute para `anon`, com execute para `authenticated` |
| `20260801161550_appointment_domain` | ✅ | `20260802113042` | `appointment_type` em requests e schedules; gatilho `enforce_sanitary_appointment_attachment`; índices `idx_*_tenant_type` |
| `20260802105852_appointment_availability_intervals` | ✅ | `20260802113057` | tabela `appointment_blocks`; `private.appointment_has_conflict`, `resolve_appointment_duration_minutes`, os 3 gatilhos de disponibilidade |
| `20260802115342_portal_public_request_purpose` | ✅ | `20260803162735`, com o nome do arquivo inteiro no campo `name` | `public_create_calendar_appointment_request` menciona `subject` |
| `20260803190000_public_briefing_only` | ✅ | `20260803194019` | as duas RPCs de criação mencionam `briefing`; `resolve_appointment_duration_minutes` com 4 argumentos |
| `20260803200000_checklist_items_requirement_type` | ✅ | `20260803205941` **e** `20260803221936` | `checklist_items.requirement_type` + check constraint; `legislation_url` |
| `20260804120000_appointment_triggers_security_definer` | ✅ | `20260804174652` | os 3 gatilhos `private.enforce_*` com `prosecdef = true` e `search_path = ''` |
| `20260804140000_appointment_buffer_por_registro` | ✅ | `20260805001248` | `private.appointment_conflict_buffer` existe; `appointment_has_conflict` chama ela |
| `20260805010139_client_portal_audit_and_payment_ack` | ✅ | já correta | tabela `client_portal_audit_events`, as 2 funções com `search_path = ''` |
| `20260805010218_client_portal_audit_events_append_only_grants` | ✅ | já correta | `authenticated` só com select na trilha; `anon` sem nada |

### Por que as 12 "sob outra versão" também precisavam de conserto

Não era cosmético, como esta auditoria chegou a supor num primeiro momento. O CLI compara a **versão
do arquivo** com as versões do ledger. Um arquivo `20260627120000_*` registrado como `20260627164215`
aparece como pendente, e o `db push` o reaplicaria — recolocando no ar a versão de junho de
`client_portal_overview`, sem o suporte a pasta principal, scores por área e estatísticas de NC que
vieram depois. A correção foi renomear a versão da linha, preservando a linha (e portanto a data real
da aplicação no campo `name` e no histórico deste documento).

### O caso `20260613125641_client_portal_audit`

É o único arquivo cujo conteúdo **nunca rodou** em produção. Os objetos que ele descreve existem, mas
vieram da reescrita endurecida do PROD-01. Ele foi registrado como aplicado justamente para nunca
rodar: se rodasse, voltaria `search_path = public` nas duas funções do portal e recriaria as policies
de update e delete na trilha de auditoria, desfazendo o trabalho de 04/08. O arquivo tem esse aviso
no cabeçalho e fica como histórico.

---

## B. Entradas do ledger sem arquivo em `supabase/migrations/`

São 22 e correspondem à era anterior a junho/2026. Não atrapalham: o CLI ignora versão remota que não
tem arquivo local.

| Versão | Nome no ledger | Origem | Conteúdo confirmado no banco |
|---|---|---|---|
| `20260328142119` | `add_updated_at_to_sync_tables` | sem arquivo no repositório | `sync_jobs` (3.189 linhas), `sync_batches`, gatilho `set_updated_at` |
| `20260410175757` | `add_observed_staff_to_inspections` | sem arquivo | `inspections.observed_staff` |
| `20260411135144` | `dynamic_checklists_schema` | sem arquivo | `checklist_templates`, `checklist_sections`, `checklist_items` |
| `20260414203113` | `add_observed_nursing_techs` | sem arquivo | `inspections.observed_nursing_techs` |
| `20260423115728` | `enable_rls_and_clean_policies` | sem arquivo | RLS ativa nas 26 tabelas de `public`, 63 policies |
| `20260426113521` | `add_inspection_id_to_schedules` | sem arquivo | `schedules.inspection_id` |
| `20260426123119` | `optimize_indices_for_latency` | sem arquivo | `idx_responses_inspection_id`, `idx_inspections_client_id`, `idx_*_tenant_id`, `idx_*_deleted_at` (71 índices em `public`) |
| `20260426140859` | `convert_template_ids_to_text` | sem arquivo | `checklist_templates.id` é `text`, não uuid — é o que deixa `tpl-*` conviver com UUID |
| `20260610204412` | `calendar_4h_interval_tz_fix` | `migrations/016_*` | superada pelo modelo de disponibilidade de agosto |
| `20260610211314` | `client_portal_accounts_blocked_dates` | `migrations/017_*` | `appointment_blocked_dates` |
| `20260611081232` | `remove_lunch_slots` | `migrations/018_*` | `appointment_slots` existe com **0 linhas** — modelo abandonado |
| `20260611082308` | `notify_new_appointment_trigger` | `migrations/019_*` | gatilho `trg_notify_new_appointment` |
| `20260611083654` | `harden_legacy_rls_policies` | `migrations/020_*` | policies endurecidas |
| `20260611083822` | `client_portal_scheduling_and_units` | `migrations/021_*` | `client_portal_account_clients` |
| `20260611225244` | `security_hardening_anon_surface` | `migrations/022_security_*` | `public_create_appointment_request` e `public_list_available_slots` não existem mais |
| `20260611225309` | `public_request_flood_guard` | `migrations/023_public_*` | vivia dentro de `public_create_calendar_appointment_request`, redefinida depois |
| `20260611233847` | `client_portal_payment` | `migrations/024_client_*` | colunas de pagamento |
| `20260612092533` | `appointment_compliance_score` | sem arquivo | `appointment_requests.compliance_score` + check |
| `20260616110716` | `025_legislation_uf_segments` | `migrations/025_*` | `legislations.uf`, `segments` |
| `20260616111511` | `026_portal_suspend_and_hide_report` | `migrations/026_*` | `client_portal_accounts.scheduling_suspended`, `appointment_requests.report_hidden` |
| `20260616111537` | `026b_create_appointment_suspend_guard` | ⚠️ **sem arquivo em lugar nenhum** | a guarda existe: `client_portal_create_appointment` menciona `scheduling_suspended` |
| `20260618104844` | `inspection_attribution_and_cofinalize` | `migrations/027_*` | `inspections.consultant_names`, `finalized_by`, `last_edited_by` |

**Sobre o `026b`:** foi aplicado direto em produção e o arquivo nunca foi commitado. Não virou
problema porque as três migrations de agosto que redefiniram `client_portal_create_appointment`
(`20260802105852`, `20260802115342`, `20260803190000`) **carregaram a guarda adiante** — as três
mencionam `scheduling_suspended`, e produção também. Foi sorte, não processo: bastaria uma delas ter
sido escrita sem a guarda para a suspensão de agendamento parar de funcionar em silêncio.

---

## C. A pasta `migrations/` da raiz — **histórica, não morta**

33 arquivos, numeração `001_` a `027_`. Último commit que a tocou: `b621a32`, de **18/06/2026**.
Desde então, todo trabalho novo vai para `supabase/migrations/`.

- **4 arquivos são cópias byte a byte** de arquivos em `supabase/migrations/`:
  `012_add_ilpi_cleaning_metrics`, `022_client_portal_access_email_calendar`,
  `023_client_portal_access_links_and_folder`, `024_persist_consultant_settings`.
- **29 arquivos não têm cópia** e são o **único registro** de coisas que estão em produção:
  multi-tenant e RLS (`001`–`004`), bucket de fotos (`005` — os buckets `photos`,
  `inspection-photos` e `client-portal-files` existem), o sync em lote (`006`–`010` —
  `sync_inspection_bundle`, `trim_sync_batch_payload`, `sync_jobs` com 3.189 linhas), campos de ILPI
  (`011`, `013`, `015`), o calendário público antigo (`014` — `appointment_slots`, hoje com 0
  linhas), e as normas e o portal de junho (`025`–`027`).
- **Nenhum dos arquivos `001`–`015` consta no ledger**, e nenhuma das entradas de março e abril do
  ledger tem arquivo. São dois registros históricos disjuntos do mesmo banco.

**Recomendação, ainda pendente:** não apagar e não rodar. Renomear para `migrations-legadas/` (ou
mover para `docs/`) com um README de uma linha dizendo que é histórico anterior a 18/06/2026 e que o
caminho ativo é `supabase/migrations/`. As 4 duplicatas exatas podem sair. É mudança só de
repositório, sem efeito em produção.

---

## D. O que foi executado em 04/08/2026

Com autorização explícita da Ester, e só na tabela de registro:

```sql
-- 1. as 7 que faltavam
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260611091522','client_portal_access_email_calendar'),
  ('20260611101800','client_portal_access_links_and_folder'),
  ('20260611132931','persist_consultant_settings'),
  ('20260611202749','lock_down_public_portal_token_access'),
  ('20260612101234','portal_account_contact_and_payment_due_date'),
  ('20260612113611','client_contacts_and_payment_links'),
  ('20260613125641','client_portal_audit')
on conflict (version) do nothing;

-- 2. a duplicata
delete from supabase_migrations.schema_migrations where version = '20260803205941';

-- 3. as 12 registradas sob outra versão (uma linha por migration; exemplo)
update supabase_migrations.schema_migrations set version = '20260627120000' where version = '20260627164215';
-- ... idem para 20260709060000, 20260709060100, 20260717090000, 20260801134443, 20260801161550,
--     20260802105852, 20260802115342 (também corrigindo `name`), 20260803190000, 20260803200000,
--     20260804120000, 20260804140000
```

**Verificação depois:** 45 linhas no ledger; as 23 versões de arquivo de `supabase/migrations/`
presentes; uma única linha com `name = 'checklist_items_requirement_type'`.

---

## E. Observações que não são deste card

- **`public.is_tenant_admin`, `public.is_tenant_staff` e `public.my_tenant_ids` existem em duplicata
  no schema `public`**, além das versões em `private`. As de `public` estão expostas via PostgREST
  para `authenticated` (aparecem no `get_advisors`). As policies usam as de `private`. Candidatas a
  remoção num card de segurança.
- **`public.sync_inspection_bundle` tem execute para `anon`.** É `security invoker`, então a RLS se
  aplica e não é buraco aberto, mas não há motivo para o papel anônimo enxergar essa função.
- **`appointment_slots` está com 0 linhas** e o modelo atual é `appointment_blocks` +
  `private.appointment_has_conflict`. Provavelmente é tabela morta; confirmar antes de remover.

---

## F. Reconferência de 08/08/2026 — depois do P360-015

Comparação direta entre `supabase/migrations/` (35 arquivos na conferência; 37 depois do SEC-01) e
o ledger de produção (`supabase_migrations.schema_migrations`, 59 linhas; 61 depois do SEC-01):

- **Os 35 arquivos estão no ledger, um a um.** Nada pendente de aplicar; `supabase db push` continua
  sem nada a fazer.
- **Duas linhas do ledger não têm arquivo próprio** — `20260808105841_backfill_uses_finalized_report_snapshot`
  e `20260808110104_backfill_severity_from_delivered_report_only`. São as duas correções do backfill
  do P360-012, aplicadas por MCP logo depois da migration original. O arquivo
  `20260808105105_backfill_client_action_items.sql` **já foi reescrito com o resultado final das
  três** — conferido em produção: `private.client_action_items_from_inspection` contém o `has_frozen`
  da segunda correção. Um clone limpo aplicando só os arquivos chega ao mesmo estado do banco.
  Registrado como nota no topo do arquivo em vez de virar dois arquivos que replicariam uma versão
  obsoleta no meio do caminho.
- `20260613125641_client_portal_audit` segue como está descrito na seção A: registrada para nunca
  rodar, com o conteúdo real vindo de `20260805010139`.

As 22 linhas restantes do ledger são história anterior a junho/2026, sem arquivo — mesma situação da
seção C.

As duas migrations do SEC-01 (`20260808185142_sec01_close_photos_bucket` e
`20260808185210_sec01_revoke_anon_table_grants`) foram aplicadas pelo MCP em 08/08/2026 e o arquivo
local já nasceu com a versão que o ledger gravou — a regra da seção D valendo na prática.

## `legislations_abnt_municipio` — aplicada por MCP em 18/08/2026

Duas colunas aditivas em `public.legislations`, para a base unificada `@visa/legislacao`:
`abnt` (referência NBR 6023 completa) e `municipio` (alcance municipal do ato). O comentário de
`status` também foi atualizado, porque o domínio ganhou `nao_verificado`.

Aplicada pelo MCP e registrada no ledger com o mesmo conteúdo do arquivo local
`supabase/migrations/20260818141657_legislations_abnt_municipio.sql`. Confirmado por
`information_schema.columns` depois de aplicar.

> **Corrigido em 19/08/2026 (COND-04):** o arquivo local tinha sido escrito como `20260818090000`, e
> o ledger gravou `20260818141657` — o horário da aplicação, como sempre. A diferença ficou
> invisível por um dia e faria a próxima conferência acusar migration "pendente" que na verdade já
> está no banco. Arquivo renomeado; nada reaplicado.

**As linhas em si não vêm de migration.** A tabela tinha 77 verbetes e a biblioteca tem 119; a
diferença entra por **Admin → Legislações → Sincronizar**, que agora insere o que falta *e* atualiza
o que existe (antes só inseria, então coluna nova nunca chegava às linhas antigas). Uma migration com
os 119 verbetes teria 60 KB de `VALUES` duplicando dado que já viaja no bundle do app.

## `cond04_applicability_revisions` — aplicada por MCP em 19/08/2026

Persistência do motor de condicionais (`COND-04`, ver
[HANDOFF-CONDICIONAIS.md](HANDOFF-CONDICIONAIS.md)). Cria `public.checklist_template_revisions`
(regras e perguntas de roteamento, versionadas em rascunho × publicada), o gatilho de ciclo de vida,
RLS por tenant, grants sem `anon`, e a coluna `inspections.applicability_revision_id` com o gatilho
que só aceita revisão publicada.

**Autorizada pela Ester em 19/08/2026** ("aplique tudo que tiver pendente em produção"). Arquivo
local `supabase/migrations/20260819090603_cond04_applicability_revisions.sql`, já nomeado com a
versão que o ledger gravou.

**Aditiva e vazia.** Nenhuma linha existente foi lida, alterada ou apagada; a tabela nova nasceu com
zero linhas, então nenhum roteiro tem regra e nada mudou de comportamento. Conferido depois de
aplicar: RLS ligada, 4 policies, 2 gatilhos, coluna criada, `has_table_privilege('anon', …)` falso
para select/insert/update/delete, `get_advisors(security)` sem apontar os objetos novos.

**Reversão** (no cabeçalho do arquivo): derrubar os dois gatilhos, a coluna, a tabela e as três
funções. Segura enquanto nada do app escrever na coluna — a fiação é do `COND-05`/`COND-08`.

## `cond08_routing_answers_sync` — **escrita, testada, ainda NÃO aplicada**

Convergência da execução adaptativa (`COND-08`, ver [HANDOFF-CONDICIONAIS.md](HANDOFF-CONDICIONAIS.md)).
Arquivo `supabase/migrations/20260827100000_cond08_routing_answers_sync.sql`.

**O que faz.** Três colunas JSONB anuláveis em `public.inspections` — `applicability_context`,
`routing_answers`, `routing_answers_meta` — e um `create or replace` de `sync_inspection_bundle`
para ele carregar essas três **mais** a `applicability_revision_id`, que ele ignorava desde o
COND-04 (lista fixa de colunas). Sem isso, duas consultoras na mesma inspeção podem ficar com
árvores diferentes para sempre, que é o que o contrato § 6.5 proíbe.

**Aditiva e vazia.** Nenhuma linha é lida, alterada ou apagada; as colunas nascem nulas em 100% das
linhas, e nulo significa o mesmo de sempre: inspeção sem regra, sempre aplicável. Não mexe em RLS,
policy, grant nem gatilho.

**Ordem de implantação.** O app novo **não** depende dela para continuar sincronizando: o
`mapToPostgres` só envia as três chaves quando há valor, e inspeção sem regra não tem nenhuma
(`applicabilityColumns`, `src/services/inspectionService.ts`) — coluna que não existe derrubaria o
upsert inteiro da inspeção, e é por isso que a omissão existe. O que a migration habilita é a
**convergência**: sem ela, publicar a primeira revisão de condições faria a resposta de roteamento
morrer no aparelho de quem respondeu. **Aplicar antes de publicar a primeira revisão** (COND-10).

**Antes de aplicar, conferir a definição viva de `sync_inspection_bundle`** em produção contra o
corpo copiado aqui (veio de `20260812112448_automatic_action_plan_custom_items.sql`). Se a função no
banco tiver sido alterada por fora, o `create or replace` desta migration desfaria a alteração.

**Testada** em Postgres 16 limpo: `supabase/tests/cond08_routing_answers_sync.test.sql` prova que as
colunas nascem nulas, que o bundle leva as quatro chaves, que um app **antigo** (payload sem as
chaves) não apaga o que o app novo gravou, que jsonb que não é objeto não vira resposta e que `anon`
continua sem executar a função. As 22 suítes rodaram juntas: 22/22 OK.

**Reversão** (no cabeçalho do arquivo): derrubar as três colunas e reaplicar a versão anterior da
função. Segura enquanto a versão anterior do app estiver no ar — ela não lê nem escreve nenhuma das
três.
