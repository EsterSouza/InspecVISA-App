# INFRA-02 — Ledger de migrations × schema real

**Data:** 04/08/2026 (BRT) · **Projeto:** `pfjacmawaigndqclgvpn` (produção) · **Somente leitura:
nenhuma migration foi aplicada durante esta auditoria.**

---

## Veredito

**O schema de produção está correto.** Os 23 arquivos de `supabase/migrations/` têm o conteúdo no
banco — verificado objeto a objeto, não pelo número da versão. O que está errado é só o **ledger**
(`supabase_migrations.schema_migrations`), em três formas:

1. **7 arquivos de junho/2026 não constam no ledger**, embora o conteúdo esteja aplicado. Foram
   aplicados por fora do CLI (editor SQL ou MCP).
2. **9 arquivos constam sob outra versão**, porque foram reaplicados por outro caminho e o registro
   pegou o horário da reaplicação, não o nome do arquivo.
3. **Uma entrada está duplicada** (`checklist_items_requirement_type`).

**O risco concreto:** se alguém rodar `supabase db push`, o CLI vai tentar aplicar os 7 arquivos que
"faltam" — inclusive `20260613125641_client_portal_audit`, que **reverteria o endurecimento feito no
PROD-01** (voltaria `search_path = public` e recriaria as policies de update/delete na trilha de
auditoria). Este é o único item que exige ação; o resto é higiene.

---

## Método

Para cada arquivo, em vez de conferir se a versão consta no ledger, foi conferido se **o conteúdo
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

| Arquivo | Aplicado? | Versão no ledger | Evidência no schema real | Ação |
|---|---|---|---|---|
| `20260525135030_add_ilpi_cleaning_metrics` | ✅ | **mesma** `20260525135030` | `inspections.observed_cleaning_staff`, `usable_area_m2` | nenhuma |
| `20260611091522_client_portal_access_email_calendar` | ✅ conteúdo | ❌ ausente | `client_portal_overview` e `client_portal_create_appointment` existem, já superadas por versões de agosto | `repair --status applied` |
| `20260611101800_client_portal_access_links_and_folder` | ✅ conteúdo | ❌ ausente | `client_portal_accounts.username`, `access_code_plain`; `clients.has_personalized_sanitary_folder`, `personalized_sanitary_folder_url` | `repair --status applied` |
| `20260611132931_persist_consultant_settings` | ✅ conteúdo | ❌ ausente | tabela `profiles` com `consultant_settings`, `consultant_role`, `coren`; RLS ativa | `repair --status applied` |
| `20260611202749_lock_down_public_portal_token_access` | ✅ conteúdo | ❌ ausente | `public_get_appointment_status` e `public_get_appointment_assets` sem execute para `anon` **e** `authenticated` | `repair --status applied` |
| `20260612101234_portal_account_contact_and_payment_due_date` | ✅ conteúdo | ❌ ausente | `client_portal_accounts.payment_type/status/link/updated_at/due_date` | `repair --status applied` |
| `20260612113611_client_contacts_and_payment_links` | ✅ conteúdo | ❌ ausente | `clients.contacts`; `client_portal_accounts.payment_links` (jsonb, not null) | `repair --status applied` |
| `20260613125641_client_portal_audit` | ❌ **nunca aplicada** | ❌ ausente | os objetos existem, mas vindos de `20260805010139` — com `search_path = ''` e sem policy de escrita | ⚠️ **`repair --status applied` ou remover o arquivo.** Aplicar reverteria o PROD-01 |
| `20260627120000_portal_area_scores` | ✅ | `20260627164215` | `appointment_requests.sanitary_score`, `nutrition_score`; `client_portal_overview` menciona `nutrition_score` | nenhuma |
| `20260709060000_appointment_requests_add_nc_stats` | ✅ | `20260709082424` | `critical/important/total/recurring/immediate_nc_count`, `nc_items` | nenhuma |
| `20260709060100_client_portal_overview_add_nc_stats` | ✅ | `20260709082437` | `client_portal_overview` menciona `immediate_nc_count` | nenhuma |
| `20260717090000_client_portal_invoices` | ✅ | `20260717135804` | tabela `client_portal_invoices` (1 linha), RLS ativa | nenhuma |
| `20260801134443_portal_main_folder_and_settings` | ✅ | `20260802113029` | tabela `client_portal_settings`; `client_portal_accounts.main_drive_folder_url`; overview menciona `main_drive_folder_url` e `action_plan_enabled` | nenhuma |
| `20260801144828_harden_portal_rpc_permissions` | ✅ | **mesma** `20260801144828` | `admin_*` sem execute para `anon`, com execute para `authenticated` | nenhuma |
| `20260801161550_appointment_domain` | ✅ | `20260802113042` | `appointment_type` em requests e schedules; gatilho `enforce_sanitary_appointment_attachment`; índices `idx_*_tenant_type` | nenhuma |
| `20260802105852_appointment_availability_intervals` | ✅ | `20260802113057` | tabela `appointment_blocks`; `private.appointment_has_conflict`, `resolve_appointment_duration_minutes`, os 3 gatilhos de disponibilidade; índices de intervalo | nenhuma |
| `20260802115342_portal_public_request_purpose` | ✅ | `20260803162735` — registrada **com o nome do arquivo inteiro** | `public_create_calendar_appointment_request` menciona `subject` | cosmético; corrigir junto do repair |
| `20260803190000_public_briefing_only` | ✅ | `20260803194019` | as duas RPCs de criação mencionam `briefing`; `resolve_appointment_duration_minutes` com 4 argumentos | nenhuma |
| `20260803200000_checklist_items_requirement_type` | ✅ | `20260803205941` **e** `20260803221936` (duplicada) | `checklist_items.requirement_type` + check constraint; `legislation_url` | ⚠️ ver seção C |
| `20260804120000_appointment_triggers_security_definer` | ✅ | `20260804174652` | os 3 gatilhos `private.enforce_*` com `prosecdef = true` e `search_path = ''` | nenhuma |
| `20260804140000_appointment_buffer_por_registro` | ✅ | `20260805001248` | `private.appointment_conflict_buffer` existe; `appointment_has_conflict` chama ela | nenhuma |
| `20260805010139_client_portal_audit_and_payment_ack` | ✅ | **mesma** `20260805010139` | tabela `client_portal_audit_events`, as 2 funções com `search_path = ''` | nenhuma |
| `20260805010218_client_portal_audit_events_append_only_grants` | ✅ | **mesma** `20260805010218` | `authenticated` só com select na trilha; `anon` sem nada | nenhuma |

**Placar:** 23 arquivos, 23 com conteúdo em produção. 5 batem versão com o ledger, 9 constam sob
outra versão, 7 não constam, 1 (a de junho) tem o conteúdo no banco por outra via e o arquivo é
histórico.

---

## B. Entradas do ledger sem arquivo em `supabase/migrations/`

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
| `20260616111537` | `026b_create_appointment_suspend_guard` | ⚠️ **sem arquivo em lugar nenhum** | a guarda existe em produção: `client_portal_create_appointment` menciona `scheduling_suspended` |
| `20260618104844` | `inspection_attribution_and_cofinalize` | `migrations/027_*` | `inspections.consultant_names`, `finalized_by`, `last_edited_by` |

**Sobre o `026b`:** foi aplicado direto em produção e o arquivo nunca foi commitado. Não virou
problema porque as três migrations de agosto que redefiniram `client_portal_create_appointment`
(`20260802105852`, `20260802115342`, `20260803190000`) **carregaram a guarda adiante** — as três
mencionam `scheduling_suspended`, e produção também. Foi sorte, não processo: bastaria uma delas ter
sido escrita sem a guarda para a suspensão de agendamento parar de funcionar em silêncio.

---

## C. A duplicata `checklist_items_requirement_type`

Consta duas vezes: `20260803205941` e `20260803221936`. O arquivo é
`20260803200000_checklist_items_requirement_type.sql`, e o schema está correto — `requirement_type`
existe uma vez, com uma única check constraint, e `legislation_url` também.

**Recomendação:** apagar a linha **`20260803205941`** e manter `20260803221936`, que é a aplicação
mais recente e a que corresponde ao estado atual. É uma linha de ledger, não altera schema:

```sql
delete from supabase_migrations.schema_migrations where version = '20260803205941';
```

Não foi executado — é escrita em produção e depende de autorização.

---

## D. A pasta `migrations/` da raiz — **histórica, não morta**

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

**Recomendação:** não apagar e não rodar. Renomear para `migrations-legadas/` (ou mover para
`docs/`) com um README de uma linha dizendo que é histórico anterior a 18/06/2026 e que o caminho
ativo é `supabase/migrations/`. As 4 duplicatas exatas podem sair.

---

## E. O que fazer, em ordem

1. **Antes de qualquer `supabase db push`**, marcar como aplicadas as 7 versões de junho que faltam
   — em especial `20260613125641`, que se rodar reverte o PROD-01:

   ```bash
   supabase migration repair --status applied 20260611091522 20260611101800 20260611132931 20260611202749 20260612101234 20260612113611 20260613125641
   ```

2. Apagar a linha duplicada `20260803205941` (seção C).
3. Renomear a pasta legada da raiz e remover as 4 duplicatas exatas (seção D).
4. As 9 divergências de versão da seção A **não precisam de conserto**: o conteúdo está aplicado e o
   CLI não vai tentar reaplicar, porque o que ele compara é a versão registrada, e todas essas têm
   registro. Corrigir daria trabalho e ganho zero.

Os itens 1 e 2 escrevem no ledger de produção e dependem de autorização da Ester.

---

## Observações que não são deste card

- **`public.is_tenant_admin`, `public.is_tenant_staff` e `public.my_tenant_ids` existem em duplicata
  no schema `public`**, além das versões em `private`. As de `public` estão expostas via PostgREST
  para `authenticated` (aparecem no `get_advisors`). As policies usam as de `private`. Candidatas a
  remoção num card de segurança.
- **`public.sync_inspection_bundle` tem execute para `anon`.** É `security invoker`, então a RLS se
  aplica e não é buraco aberto, mas não há motivo para o papel anônimo enxergar essa função.
- **`appointment_slots` está com 0 linhas** e o modelo atual é `appointment_blocks` +
  `private.appointment_has_conflict`. Provavelmente é tabela morta; confirmar antes de remover.
