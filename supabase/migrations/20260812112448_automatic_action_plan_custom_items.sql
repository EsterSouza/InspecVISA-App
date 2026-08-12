-- Automatic action plan and persistent custom checklist items.
-- Additive only: completed inspections and frozen report versions are never rewritten.

alter table public.responses
  add column if not exists custom_item_meta jsonb,
  add column if not exists confirmed_client_evidence_ids jsonb not null default '[]'::jsonb;

create or replace function private.is_uuid_text_array(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_item text;
begin
  if jsonb_typeof(p_value) <> 'array' then return false; end if;
  for v_item in select jsonb_array_elements_text(p_value) loop
    begin
      perform v_item::uuid;
    exception when invalid_text_representation then
      return false;
    end;
  end loop;
  return true;
end;
$function$;

revoke all on function private.is_uuid_text_array(jsonb) from public, anon;
grant execute on function private.is_uuid_text_array(jsonb) to authenticated, service_role;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.responses'::regclass
      and conname = 'responses_confirmed_evidence_array_check'
  ) then
    alter table public.responses
      add constraint responses_confirmed_evidence_array_check
      check (private.is_uuid_text_array(confirmed_client_evidence_ids));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.responses'::regclass
      and conname = 'responses_custom_item_meta_check'
  ) then
    alter table public.responses
      add constraint responses_custom_item_meta_check
      check (
        custom_item_meta is null
        or (
          jsonb_typeof(custom_item_meta) = 'object'
          and coalesce(trim(custom_item_meta ->> 'sectionId'), '') <> ''
          and coalesce(custom_item_meta ->> 'order', '') ~ '^[1-9][0-9]*$'
          and custom_item_meta ->> 'weight' in ('1', '2', '5', '10')
          and custom_item_meta ->> 'isCritical' in ('true', 'false')
          and custom_item_meta ->> 'state' in ('active', 'discontinued')
          and (custom_item_meta ->> 'isCritical' <> 'true' or custom_item_meta ->> 'weight' = '10')
        )
      );
  end if;
end
$migration$;

comment on column public.responses.custom_item_meta is
  'Stable section/order/weight/critical/state metadata for custom checklist items.';
comment on column public.responses.confirmed_client_evidence_ids is
  'Evidence UUID strings explicitly confirmed by the consultant for this response.';

create or replace function public.admin_reconcile_inspection_action_plan(
  p_inspection_id uuid,
  p_confirmed_evidence_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_inspection public.inspections%rowtype;
  v_reviewer text;
  v_approved integer := 0;
  v_resolved integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessao autenticada obrigatoria';
  end if;

  select * into v_inspection
  from public.inspections
  where id = p_inspection_id
    and deleted_at is null;

  if not found then
    raise exception 'Inspecao invalida';
  end if;

  if not private.is_tenant_staff(v_inspection.tenant_id) then
    raise exception 'Usuario sem permissao para reconciliar este tenant';
  end if;

  if v_inspection.status <> 'in_progress' then
    raise exception 'Inspecao precisa estar em andamento para reconciliar';
  end if;

  if coalesce(nullif(trim(v_inspection.last_edited_by), ''), nullif(trim(v_inspection.consultant_name), '')) is null
     and coalesce(array_length(v_inspection.consultant_names, 1), 0) = 0 then
    raise exception 'Inspecao sem consultora identificada';
  end if;

  v_reviewer := coalesce(
    nullif(trim(v_inspection.last_edited_by), ''),
    nullif(trim(v_inspection.consultant_name), ''),
    auth.uid()::text
  );

  update public.client_action_evidence as evidence
     set status = 'approved',
         review_note = coalesce(evidence.review_note, 'Confirmada durante a inspeção técnica.'),
         reviewed_at = now(),
         reviewed_by = v_reviewer,
         updated_at = now()
    from public.client_action_items as action_item,
         public.responses as response
   where evidence.id = any(coalesce(p_confirmed_evidence_ids, '{}'::uuid[]))
     and evidence.status = 'pending'
     and evidence.action_item_id = action_item.id
     and evidence.tenant_id = v_inspection.tenant_id
     and evidence.client_id = v_inspection.client_id
     and action_item.tenant_id = v_inspection.tenant_id
     and action_item.client_id = v_inspection.client_id
     and response.inspection_id = v_inspection.id
     and response.tenant_id = v_inspection.tenant_id
     and response.item_id = action_item.source_item_id
     and response.deleted_at is null
     and response.result = 'complies'
     and response.confirmed_client_evidence_ids ? evidence.id::text;
  get diagnostics v_approved = row_count;

  update public.client_action_items as action_item
     set status = 'resolved',
         resolved_at = coalesce(action_item.resolved_at, now()),
         updated_at = now()
   where action_item.tenant_id = v_inspection.tenant_id
     and action_item.client_id = v_inspection.client_id
     and action_item.status <> 'resolved'
     and exists (
       select 1
       from public.responses as response
       where response.inspection_id = v_inspection.id
         and response.tenant_id = v_inspection.tenant_id
         and response.item_id = action_item.source_item_id
         and (
           (response.deleted_at is null and response.result = 'complies')
           or response.custom_item_meta ->> 'state' = 'discontinued'
         )
     );
  get diagnostics v_resolved = row_count;

  return jsonb_build_object(
    'ok', true,
    'approvedEvidenceCount', v_approved,
    'resolvedItemCount', v_resolved
  );
end;
$function$;

revoke all on function public.admin_reconcile_inspection_action_plan(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reconcile_inspection_action_plan(uuid, uuid[]) to authenticated, service_role;

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
    last_edited_by, finalized_by, completed_at, deleted_at, created_at, updated_at, tenant_id
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
    v_tenant_id
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
    tenant_id = excluded.tenant_id
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
