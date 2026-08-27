-- ============================================================================
-- COND-08 — Execucao adaptativa: o contexto congelado e as respostas de
-- roteamento passam a viajar entre dispositivos.
--
-- Normativo: docs/contrato-aplicabilidade.md (§ 6.5) · plano: docs/HANDOFF-CONDICIONAIS.md
-- Schema do que entra em `routing_answers`: src/domain/applicability/schema.ts
--
-- ─── O problema que esta migration resolve ──────────────────────────────────
--
-- O motor decide aplicabilidade a partir de tres coisas: a revisao congelada, o
-- contexto congelado e as respostas de roteamento. Ate aqui so a PRIMEIRA tinha
-- caminho ate o servidor (`applicability_revision_id`, COND-04) — e mesmo essa o
-- bundle de sincronizacao descartava, porque `sync_inspection_bundle` tem lista
-- fixa de colunas. Resultado: duas consultoras na mesma inspecao podiam ficar com
-- arvores diferentes para sempre, que e o que o contrato § 6.5 proibe.
--
-- ─── O que esta migration faz ───────────────────────────────────────────────
--
--   1. Tres colunas JSONB novas em `public.inspections`, todas anulaveis e sem
--      default: `applicability_context`, `routing_answers`, `routing_answers_meta`.
--   2. `sync_inspection_bundle` passa a carregar as tres MAIS a
--      `applicability_revision_id`, que ele ja ignorava desde o COND-04.
--
-- ─── O que ela NAO faz ──────────────────────────────────────────────────────
--
--   * Zero backfill. Nenhuma linha existente e lida, alterada ou apagada — as
--     colunas nascem nulas nas 100% das linhas, e nulo significa exatamente o que
--     significava antes: inspecao sem regra, sempre aplicavel.
--   * Nao persiste `reportTemplateSnapshot`. O vinculo por revisao publicada e
--     imutavel da convergencia sem duplicar o roteiro inteiro em cada inspecao
--     (decisao do COND-04; o payload do sync ja teve problema de tamanho em
--     `008_trim_sync_batch_payload`).
--   * Nao mexe em RLS, policy, grant nem gatilho. As colunas herdam a RLS da
--     tabela; `anon` continua sem privilegio nenhum em `inspections`.
--
-- ─── Ordem de implantacao ───────────────────────────────────────────────────
--
-- O app novo NAO depende desta migration para continuar sincronizando: o
-- `mapToPostgres` so envia as tres chaves quando ha valor, e inspecao sem regra
-- nao tem nenhuma (src/services/inspectionService.ts, `applicabilityColumns`).
-- Coluna que nao existe derrubaria o upsert inteiro da inspecao — por isso a
-- omissao, e por isso o app novo roda contra o banco de ontem.
--
-- O que ESTA migration habilita e a convergencia: sem ela, publicar revisao de
-- condicoes faria a resposta de roteamento morrer no aparelho de quem respondeu.
-- Aplicar antes de publicar a primeira revisao (que e o COND-10, o piloto).
--
-- ─── Reversao ───────────────────────────────────────────────────────────────
--
--   alter table public.inspections
--     drop column if exists routing_answers_meta,
--     drop column if exists routing_answers,
--     drop column if exists applicability_context;
--   -- e reaplicar a versao da funcao que esta em
--   -- 20260812112448_automatic_action_plan_custom_items.sql
--
-- Segura enquanto a versao anterior do app estiver no ar: ela nao le nem escreve
-- nenhuma das tres.
-- ============================================================================

-- ─── 1 · As colunas ─────────────────────────────────────────────────────────

alter table public.inspections
  add column if not exists applicability_context jsonb,
  add column if not exists routing_answers jsonb,
  add column if not exists routing_answers_meta jsonb;

comment on column public.inspections.applicability_context is
  'COND-08 · contexto congelado da inspecao (UF, municipio, categoria, numeros do wizard) como estava na criacao. O motor de aplicabilidade le daqui, nunca do cadastro vivo do cliente (contrato § 4 e § 6.2).';

comment on column public.inspections.routing_answers is
  'COND-08 · respostas das perguntas de roteamento, por id de pergunta. NAO sao respostas sanitarias: nao entram no score, no plano de acao nem na lista de exigencias (contrato § 3). Por isso ficam aqui, e nao em public.responses.';

comment on column public.inspections.routing_answers_meta is
  'COND-08 · quando cada resposta de roteamento foi dada e por quem. E o que permite o merge POR PERGUNTA entre dois dispositivos: sem o carimbo, o merge do registro inteiro apagaria a resposta que a colega deu offline a outra pergunta (contrato § 6.5).';

-- ─── 2 · O bundle de sincronizacao ──────────────────────────────────────────
-- Copia fiel da versao de 20260812112448_automatic_action_plan_custom_items.sql,
-- com quatro colunas a mais no insert de `inspections` e nada mais alterado.
--
-- `coalesce(excluded.X, public.inspections.X)` no on conflict: um cliente antigo,
-- que ainda nao envia estas chaves, NAO pode apagar o que o cliente novo gravou.
-- Mesma prudencia que o `mapFromPostgres` tem do outro lado.

create or replace function public.sync_inspection_bundle(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_inspection jsonb := p_payload -> 'inspection';
  v_responses jsonb := coalesce(p_payload -> 'responses', '[]'::jsonb);
  v_photos jsonb := coalesce(p_payload -> 'photos', '[]'::jsonb);
  v_finalize_report boolean := coalesce((p_payload ->> 'finalizeReport')::boolean, false);
  v_tenant_id uuid;
  v_inspection_id uuid;
  v_batch_id uuid;
  v_report_version_id uuid;
  v_next_version integer;
  v_server_updated_at timestamptz := now();
  v_invalid_count integer;
begin
  if v_inspection is null then
    raise exception 'Payload sem inspection';
  end if;

  v_tenant_id := coalesce(v_inspection ->> 'tenant_id', v_inspection ->> 'tenantId')::uuid;
  v_inspection_id := (v_inspection ->> 'id')::uuid;
  if v_tenant_id is null or v_inspection_id is null then
    raise exception 'Payload sem tenant_id ou inspection.id';
  end if;
  if not private.is_tenant_staff(v_tenant_id) then
    raise exception 'Usuario sem permissao para sincronizar este tenant';
  end if;

  insert into public.sync_batches (
    tenant_id, inspection_id, client_sync_id, status, payload, updated_at
  ) values (
    v_tenant_id, v_inspection_id, p_payload ->> 'clientSyncId', 'syncing', p_payload, v_server_updated_at
  ) returning id into v_batch_id;

  insert into public.inspections (
    id, client_id, template_id, consultant_name, consultant_names,
    inspection_date, status, observations, reference_sources,
    ilpi_capacity, residents_total, residents_male, residents_female,
    dependency_level1, dependency_level2, dependency_level3,
    dependency_level_1, dependency_level_2, dependency_level_3,
    observed_staff, observed_nursing_techs, usable_area_m2, observed_cleaning_staff,
    accompanist_name, accompanist_role, signature_data_url,
    last_edited_by, finalized_by, completed_at, deleted_at, created_at, updated_at, tenant_id,
    applicability_revision_id, applicability_context, routing_answers, routing_answers_meta
  ) values (
    v_inspection_id,
    (v_inspection ->> 'client_id')::uuid,
    v_inspection ->> 'template_id',
    v_inspection ->> 'consultant_name',
    case when jsonb_typeof(v_inspection -> 'consultant_names') = 'array'
      then array(select jsonb_array_elements_text(v_inspection -> 'consultant_names')) end,
    (v_inspection ->> 'inspection_date')::timestamptz,
    v_inspection ->> 'status',
    nullif(v_inspection ->> 'observations', ''),
    case when jsonb_typeof(v_inspection -> 'reference_sources') = 'array'
      then v_inspection -> 'reference_sources' end,
    nullif(v_inspection ->> 'ilpi_capacity', '')::integer,
    nullif(v_inspection ->> 'residents_total', '')::integer,
    nullif(v_inspection ->> 'residents_male', '')::integer,
    nullif(v_inspection ->> 'residents_female', '')::integer,
    nullif(v_inspection ->> 'dependency_level1', '')::integer,
    nullif(v_inspection ->> 'dependency_level2', '')::integer,
    nullif(v_inspection ->> 'dependency_level3', '')::integer,
    nullif(v_inspection ->> 'dependency_level_1', '')::integer,
    nullif(v_inspection ->> 'dependency_level_2', '')::integer,
    nullif(v_inspection ->> 'dependency_level_3', '')::integer,
    nullif(v_inspection ->> 'observed_staff', '')::integer,
    nullif(v_inspection ->> 'observed_nursing_techs', '')::integer,
    nullif(v_inspection ->> 'usable_area_m2', '')::integer,
    nullif(v_inspection ->> 'observed_cleaning_staff', '')::integer,
    nullif(v_inspection ->> 'accompanist_name', ''),
    nullif(v_inspection ->> 'accompanist_role', ''),
    nullif(v_inspection ->> 'signature_data_url', ''),
    nullif(v_inspection ->> 'last_edited_by', ''),
    coalesce(v_inspection -> 'finalized_by', '[]'::jsonb),
    nullif(v_inspection ->> 'completed_at', '')::timestamptz,
    nullif(v_inspection ->> 'deleted_at', '')::timestamptz,
    coalesce(nullif(v_inspection ->> 'created_at', '')::timestamptz, v_server_updated_at),
    coalesce(nullif(v_inspection ->> 'updated_at', '')::timestamptz, v_server_updated_at),
    v_tenant_id,
    -- COND-08 · o vinculo com a revisao e o que a inspecao congelou de contexto e
    -- de resposta de roteamento. Sem estas quatro colunas o bundle descartava tudo
    -- em silencio, e os dois aparelhos calculavam arvores diferentes.
    nullif(v_inspection ->> 'applicability_revision_id', '')::uuid,
    case when jsonb_typeof(v_inspection -> 'applicability_context') = 'object'
      then v_inspection -> 'applicability_context' end,
    case when jsonb_typeof(v_inspection -> 'routing_answers') = 'object'
      then v_inspection -> 'routing_answers' end,
    case when jsonb_typeof(v_inspection -> 'routing_answers_meta') = 'object'
      then v_inspection -> 'routing_answers_meta' end
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    template_id = excluded.template_id,
    consultant_name = excluded.consultant_name,
    consultant_names = excluded.consultant_names,
    inspection_date = excluded.inspection_date,
    status = excluded.status,
    observations = excluded.observations,
    reference_sources = excluded.reference_sources,
    ilpi_capacity = excluded.ilpi_capacity,
    residents_total = excluded.residents_total,
    residents_male = excluded.residents_male,
    residents_female = excluded.residents_female,
    dependency_level1 = excluded.dependency_level1,
    dependency_level2 = excluded.dependency_level2,
    dependency_level3 = excluded.dependency_level3,
    dependency_level_1 = excluded.dependency_level_1,
    dependency_level_2 = excluded.dependency_level_2,
    dependency_level_3 = excluded.dependency_level_3,
    observed_staff = excluded.observed_staff,
    observed_nursing_techs = excluded.observed_nursing_techs,
    usable_area_m2 = excluded.usable_area_m2,
    observed_cleaning_staff = excluded.observed_cleaning_staff,
    accompanist_name = excluded.accompanist_name,
    accompanist_role = excluded.accompanist_role,
    signature_data_url = excluded.signature_data_url,
    last_edited_by = excluded.last_edited_by,
    finalized_by = excluded.finalized_by,
    completed_at = excluded.completed_at,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at,
    tenant_id = excluded.tenant_id,
    applicability_revision_id = coalesce(excluded.applicability_revision_id, public.inspections.applicability_revision_id),
    applicability_context = coalesce(excluded.applicability_context, public.inspections.applicability_context),
    routing_answers = coalesce(excluded.routing_answers, public.inspections.routing_answers),
    routing_answers_meta = coalesce(excluded.routing_answers_meta, public.inspections.routing_answers_meta)
  where public.inspections.tenant_id = v_tenant_id
     or public.inspections.tenant_id is null;

  if not exists (
    select 1 from public.inspections
    where id = v_inspection_id and tenant_id = v_tenant_id
  ) then
    raise exception 'Inspecao nao pertence ao tenant informado';
  end if;

  select count(*) into v_invalid_count
  from jsonb_to_recordset(v_responses) as response(tenant_id uuid)
  where response.tenant_id is distinct from v_tenant_id;
  if v_invalid_count > 0 then
    raise exception 'Resposta com tenant_id divergente';
  end if;

  insert into public.responses (
    id, inspection_id, item_id, result, situation_description, corrective_action,
    responsible, deadline, custom_description, links, custom_item_meta,
    confirmed_client_evidence_ids, last_edited_by, deleted_at, created_at, updated_at, tenant_id
  )
  select
    response.id,
    v_inspection_id,
    response.item_id,
    response.result,
    nullif(response.situation_description, ''),
    nullif(response.corrective_action, ''),
    nullif(response.responsible, ''),
    nullif(response.deadline, ''),
    nullif(response.custom_description, ''),
    response.links,
    response.custom_item_meta,
    coalesce(response.confirmed_client_evidence_ids, '[]'::jsonb),
    nullif(response.last_edited_by, ''),
    response.deleted_at,
    coalesce(response.created_at, v_server_updated_at),
    coalesce(response.updated_at, v_server_updated_at),
    v_tenant_id
  from jsonb_to_recordset(v_responses) as response(
    id uuid,
    item_id text,
    result text,
    situation_description text,
    corrective_action text,
    responsible text,
    deadline text,
    custom_description text,
    links jsonb,
    custom_item_meta jsonb,
    confirmed_client_evidence_ids jsonb,
    last_edited_by text,
    deleted_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    tenant_id uuid
  )
  on conflict (id) do update set
    inspection_id = excluded.inspection_id,
    item_id = excluded.item_id,
    result = excluded.result,
    situation_description = excluded.situation_description,
    corrective_action = excluded.corrective_action,
    responsible = excluded.responsible,
    deadline = excluded.deadline,
    custom_description = excluded.custom_description,
    links = excluded.links,
    custom_item_meta = excluded.custom_item_meta,
    confirmed_client_evidence_ids = excluded.confirmed_client_evidence_ids,
    last_edited_by = excluded.last_edited_by,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at,
    tenant_id = excluded.tenant_id
  where public.responses.tenant_id = v_tenant_id
     or public.responses.tenant_id is null;

  select count(*) into v_invalid_count
  from jsonb_to_recordset(v_photos) as photo(tenant_id uuid)
  where photo.tenant_id is distinct from v_tenant_id;
  if v_invalid_count > 0 then
    raise exception 'Foto com tenant_id divergente';
  end if;

  insert into public.photos (
    id, response_id, data_url, caption, taken_at, updated_at, deleted_at, tenant_id
  )
  select
    photo.id,
    photo.response_id,
    nullif(photo.data_url, ''),
    nullif(photo.caption, ''),
    coalesce(photo.taken_at, v_server_updated_at),
    coalesce(photo.updated_at, v_server_updated_at),
    photo.deleted_at,
    v_tenant_id
  from jsonb_to_recordset(v_photos) as photo(
    id uuid,
    response_id uuid,
    data_url text,
    caption text,
    taken_at timestamptz,
    updated_at timestamptz,
    deleted_at timestamptz,
    tenant_id uuid
  )
  on conflict (id) do update set
    response_id = excluded.response_id,
    data_url = excluded.data_url,
    caption = excluded.caption,
    taken_at = excluded.taken_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    tenant_id = excluded.tenant_id
  where public.photos.tenant_id = v_tenant_id
     or public.photos.tenant_id is null;

  if v_finalize_report then
    select coalesce(max(version), 0) + 1 into v_next_version
    from public.inspection_report_versions
    where inspection_id = v_inspection_id
      and tenant_id = v_tenant_id;

    insert into public.inspection_report_versions (
      tenant_id, inspection_id, version, snapshot_json, created_by
    ) values (
      v_tenant_id, v_inspection_id, v_next_version, p_payload, auth.uid()
    ) returning id into v_report_version_id;
  end if;

  update public.sync_batches
     set status = 'synced',
         error = null,
         result = jsonb_build_object(
           'ok', true,
           'inspectionId', v_inspection_id,
           'syncBatchId', v_batch_id,
           'serverUpdatedAt', v_server_updated_at,
           'reportVersionId', v_report_version_id,
           'failedItems', '[]'::jsonb
         ),
         updated_at = v_server_updated_at
   where id = v_batch_id;

  return jsonb_build_object(
    'ok', true,
    'inspectionId', v_inspection_id,
    'syncBatchId', v_batch_id,
    'serverUpdatedAt', v_server_updated_at,
    'reportVersionId', v_report_version_id,
    'failedItems', '[]'::jsonb
  );
end;
$function$;

revoke all on function public.sync_inspection_bundle(jsonb) from public, anon;
grant execute on function public.sync_inspection_bundle(jsonb) to authenticated, service_role;
