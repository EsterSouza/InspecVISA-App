-- ============================================================
-- 007_public_portal.sql
-- Portal público de agendamento — HUB TREINAVISA SERVIÇOS
-- ============================================================

-- ─── 1. TABELAS ──────────────────────────────────────────────

create table if not exists public.appointment_slots (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  starts_at      timestamptz,
  ends_at        timestamptz,
  period         text check (period in ('manha','tarde','noite','integral')),
  capacity       integer default 1,
  booked_count   integer default 0,
  is_public      boolean default true,
  status         text check (status in ('available','blocked','full','cancelled')) default 'available',
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.appointment_requests (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  slot_id             uuid references public.appointment_slots(id) on delete set null,
  client_id           uuid,
  schedule_id         uuid,
  inspection_id       uuid,
  public_token        uuid not null unique default gen_random_uuid(),
  unit_name           text not null,
  district            text not null,
  responsible_name    text,
  phone               text,
  email               text,
  requested_date      date,
  requested_period    text,
  requested_time      text,
  status              text check (status in (
                        'requested','confirmed','in_progress',
                        'rescheduled','completed','report_available','cancelled'
                      )) default 'requested',
  report_due_at       date,
  report_due_source   text check (report_due_source in ('business_days','manual')),
  report_pdf_path     text,
  notes               text,
  internal_notes      text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table if not exists public.appointment_attachments (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null,
  appointment_request_id   uuid not null references public.appointment_requests(id) on delete cascade,
  inspection_id            uuid,
  kind                     text check (kind in ('report_pdf','photo','attachment')),
  storage_bucket           text not null,
  storage_path             text not null,
  file_name                text,
  mime_type                text,
  caption                  text,
  created_at               timestamptz default now()
);

-- ─── 2. RLS ──────────────────────────────────────────────────

alter table public.appointment_slots       enable row level security;
alter table public.appointment_requests    enable row level security;
alter table public.appointment_attachments enable row level security;

grant usage on schema private to authenticated;
grant execute on function private.my_tenant_ids() to authenticated;
grant execute on function private.is_tenant_staff(uuid) to authenticated;

drop policy if exists "anon select public slots" on public.appointment_slots;
drop policy if exists "authenticated manage slots" on public.appointment_slots;
drop policy if exists "anon insert request" on public.appointment_requests;
drop policy if exists "authenticated manage requests" on public.appointment_requests;
drop policy if exists "authenticated manage attachments" on public.appointment_attachments;

-- appointment_slots: anon pode listar slots públicos disponíveis
create policy "anon select public slots"
  on public.appointment_slots for select to anon
  using (is_public = true and status = 'available');

-- appointment_slots: authenticated gerencia seus próprios slots
create policy "authenticated manage slots"
  on public.appointment_slots for all to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- appointment_requests: anon NÃO pode SELECT direto — apenas via RPC
-- appointment_requests: anon pode INSERT (criar solicitação)
create policy "anon insert request"
  on public.appointment_requests for insert to anon
  with check (true);

-- appointment_requests: authenticated gerencia suas solicitações
create policy "authenticated manage requests"
  on public.appointment_requests for all to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- appointment_attachments: sem acesso direto para anon
create policy "authenticated manage attachments"
  on public.appointment_attachments for all to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- ─── 3. RPCs SECURITY DEFINER ────────────────────────────────
-- Todas executáveis por anon. Não vazar tenant_id, internal_notes,
-- client_id, schedule_id, inspection_id nem dados de outros tokens.

-- 3a. Listar slots disponíveis para agendamento público
create or replace function public.public_list_available_slots(p_tenant_id uuid)
returns table (
  id          uuid,
  starts_at   timestamptz,
  ends_at     timestamptz,
  period      text,
  spots_left  integer,
  notes       text
)
language sql security definer set search_path = public as $$
  select
    id,
    starts_at,
    ends_at,
    period,
    (capacity - booked_count)::integer as spots_left,
    notes
  from public.appointment_slots
  where tenant_id     = p_tenant_id
    and is_public     = true
    and status        = 'available'
    and (starts_at is null or starts_at >= now())
    and (capacity - booked_count) > 0
  order by starts_at asc nulls last;
$$;

grant execute on function public.public_list_available_slots(uuid) to anon;

-- 3b. Criar solicitação pública de agendamento
create or replace function public.public_create_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_unit_name        text;
  v_district         text;
  v_phone            text;
  v_tenant_id        uuid;
  v_slot_id          uuid;
  v_token            uuid;
  v_slot_available   integer;
begin
  -- Validações obrigatórias
  v_unit_name  := trim(p_payload->>'unit_name');
  v_district   := trim(p_payload->>'district');
  v_phone      := trim(p_payload->>'phone');
  v_tenant_id  := (p_payload->>'tenant_id')::uuid;

  if v_unit_name is null or v_unit_name = '' then
    raise exception 'unit_name é obrigatório';
  end if;
  if v_district is null or v_district = '' then
    raise exception 'district é obrigatório';
  end if;
  if v_phone is null or v_phone = '' then
    raise exception 'phone é obrigatório';
  end if;
  if v_tenant_id is null then
    raise exception 'tenant_id é obrigatório';
  end if;

  -- Validar slot se fornecido
  v_slot_id := nullif(p_payload->>'slot_id', '')::uuid;
  if v_slot_id is not null then
    select (capacity - booked_count) into v_slot_available
    from public.appointment_slots
    where id = v_slot_id and tenant_id = v_tenant_id and status = 'available';

    if v_slot_available is null or v_slot_available <= 0 then
      raise exception 'slot indisponível ou inexistente';
    end if;

    -- Reservar vaga
    update public.appointment_slots
    set booked_count = booked_count + 1,
        status = case when (capacity - booked_count - 1) <= 0 then 'full' else 'available' end,
        updated_at = now()
    where id = v_slot_id;
  end if;

  -- Inserir solicitação
  insert into public.appointment_requests (
    tenant_id, slot_id, unit_name, district,
    responsible_name, phone, email,
    requested_date, requested_period, notes
  ) values (
    v_tenant_id,
    v_slot_id,
    v_unit_name,
    v_district,
    trim(p_payload->>'responsible_name'),
    v_phone,
    trim(p_payload->>'email'),
    nullif(p_payload->>'requested_date', '')::date,
    trim(p_payload->>'requested_period'),
    trim(p_payload->>'notes')
  )
  returning public_token into v_token;

  -- Retornar apenas o token — nada mais
  return jsonb_build_object('public_token', v_token);
end;
$$;

grant execute on function public.public_create_appointment_request(jsonb) to anon;

-- 3c. Consultar status pelo token público
create or replace function public.public_get_appointment_status(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.appointment_requests%rowtype;
begin
  select * into v_row
  from public.appointment_requests
  where public_token = p_token;

  if not found then
    return jsonb_build_object('error', 'token inválido');
  end if;

  -- Retornar apenas campos permitidos ao cliente — sem internal_notes, client_id, etc.
  return jsonb_build_object(
    'id',                v_row.id,
    'unit_name',         v_row.unit_name,
    'district',          v_row.district,
    'status',            v_row.status,
    'requested_date',    v_row.requested_date,
    'requested_period',  v_row.requested_period,
    'report_due_at',     v_row.report_due_at,
    'report_due_source', v_row.report_due_source,
    'created_at',        v_row.created_at,
    'updated_at',        v_row.updated_at
  );
end;
$$;

grant execute on function public.public_get_appointment_status(uuid) to anon;

-- 3d. Buscar assets (relatório, fotos, anexos) pelo token
-- Retorna signed URLs geradas internamente — nunca expõe storage_path ao cliente.
create or replace function public.public_get_appointment_assets(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_request_id uuid;
  v_assets     jsonb := '[]'::jsonb;
  v_row        public.appointment_attachments%rowtype;
begin
  select id into v_request_id
  from public.appointment_requests
  where public_token = p_token;

  if v_request_id is null then
    return jsonb_build_object('error', 'token inválido');
  end if;

  -- Retornar metadados dos assets sem expor storage_path
  -- A geração de signed URLs deve ser feita pelo backend/service (Edge Function ou service_role)
  -- Esta RPC retorna os metadados necessários para o backend gerar as URLs
  select jsonb_agg(
    jsonb_build_object(
      'id',          a.id,
      'kind',        a.kind,
      'storage_bucket', a.storage_bucket,
      'storage_path', a.storage_path,
      'file_name',   a.file_name,
      'mime_type',   a.mime_type,
      'caption',     a.caption,
      'created_at',  a.created_at
    )
  ) into v_assets
  from public.appointment_attachments a
  where a.appointment_request_id = v_request_id;

  return jsonb_build_object(
    'assets', coalesce(v_assets, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.public_get_appointment_assets(uuid) to anon;

-- ─── 4. STORAGE BUCKET ───────────────────────────────────────
-- Criar bucket client-portal-files (não público) para PDFs e anexos finais.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-portal-files',
  'client-portal-files',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload/gestão interna do bucket de portal por staff do tenant.
drop policy if exists "client_portal_files_select_staff" on storage.objects;
drop policy if exists "client_portal_files_insert_staff" on storage.objects;
drop policy if exists "client_portal_files_update_staff" on storage.objects;
drop policy if exists "client_portal_files_delete_staff" on storage.objects;
drop policy if exists "client_portal_published_assets_select_anon" on storage.objects;

create policy "client_portal_files_select_staff"
on storage.objects
for select to authenticated
using (
  bucket_id = 'client-portal-files'
  and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
);

create policy "client_portal_files_insert_staff"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'client-portal-files'
  and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
  and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

create policy "client_portal_files_update_staff"
on storage.objects
for update to authenticated
using (
  bucket_id = 'client-portal-files'
  and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
  and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'client-portal-files'
  and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
  and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

create policy "client_portal_files_delete_staff"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'client-portal-files'
  and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
  and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

-- Compatibilidade com a Fase 4 atual: o frontend público usa anon key para gerar
-- signed URLs. Isso libera SELECT apenas para objetos explicitamente publicados
-- em appointment_attachments. Uma Edge Function com service_role ainda é o
-- caminho mais forte para validar o public_token antes de assinar downloads.
create policy "client_portal_published_assets_select_anon"
on storage.objects
for select to anon
using (
  bucket_id in ('client-portal-files', 'inspection-photos')
  and exists (
    select 1
    from public.appointment_attachments a
    where a.storage_bucket = storage.objects.bucket_id
      and a.storage_path = storage.objects.name
  )
);
