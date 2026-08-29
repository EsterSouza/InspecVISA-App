-- AGD-02 — "Outros pontos" na agenda: marcos avulsos por unidade, sem recorrência e sem
-- categoria (a Ester só quer registrar um lembrete numa data — não é vistoria, não é prazo
-- automático de relatório). Junto da entrega da pasta sanitária personalizada (já existente em
-- `clients.personalized_sanitary_folder_expected_delivery_date`), eles aparecem na grade de
-- agenda do admin como evento de dia inteiro, visualmente distinto do compromisso de visita.
--
-- Exclusão é física (sem `deleted_at`): marco errado ou obsoleto simplesmente some, não há
-- histórico a preservar como no plano de ação. Escrita só por RPC — a leitura direta
-- (`select` sob RLS) é suficiente para a agenda carregar o range visível de uma vez.

create table if not exists public.client_milestones (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  title           text not null,
  note            text,
  milestone_date  date not null,
  done_at         timestamptz,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists client_milestones_tenant_date_idx
  on public.client_milestones (tenant_id, milestone_date);

create index if not exists client_milestones_client_idx
  on public.client_milestones (client_id, milestone_date);

alter table public.client_milestones enable row level security;

-- Tabela nova no `public` nasce com ALL para anon/authenticated por causa dos default
-- privileges do Supabase; o revoke tem de ser explícito. Ver PROD-01.
revoke all on table public.client_milestones from public;
revoke all on table public.client_milestones from anon;
revoke all on table public.client_milestones from authenticated;
grant select on table public.client_milestones to authenticated;

drop policy if exists "staff reads client milestones" on public.client_milestones;
create policy "staff reads client milestones"
  on public.client_milestones for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Sem policy de insert/update/delete: escrita só pelas RPCs abaixo, que resolvem o tenant a
-- partir do cliente (ou do próprio marco), nunca de um `tenant_id` vindo do navegador.

comment on table public.client_milestones is
  'AGD-02 — "outros pontos" da agenda: marco avulso por unidade, sem recorrência, sem '
  'categoria, exclusão física. Distinto da entrega de pasta sanitária, que continua vivendo '
  'em clients.personalized_sanitary_folder_expected_delivery_date.';

-- ─── Criar ──────────────────────────────────────────────────────────────────

create or replace function public.admin_create_client_milestone(
  p_client_id uuid,
  p_title text,
  p_milestone_date date,
  p_note text default null,
  p_created_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_id uuid;
begin
  select tenant_id into v_tenant
  from public.clients
  where id = p_client_id
    and deleted_at is null;

  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'titulo e obrigatorio';
  end if;
  if p_milestone_date is null then
    raise exception 'data e obrigatoria';
  end if;

  insert into public.client_milestones (
    tenant_id, client_id, title, note, milestone_date, created_by
  ) values (
    v_tenant,
    p_client_id,
    trim(p_title),
    nullif(trim(coalesce(p_note, '')), ''),
    p_milestone_date,
    nullif(trim(coalesce(p_created_by, '')), '')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$function$;

revoke all on function public.admin_create_client_milestone(uuid, text, date, text, text) from public;
revoke all on function public.admin_create_client_milestone(uuid, text, date, text, text) from anon;
grant execute on function public.admin_create_client_milestone(uuid, text, date, text, text) to authenticated;

-- ─── Editar ─────────────────────────────────────────────────────────────────

create or replace function public.admin_update_client_milestone(
  p_id uuid,
  p_title text,
  p_milestone_date date,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant
  from public.client_milestones
  where id = p_id;

  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'titulo e obrigatorio';
  end if;
  if p_milestone_date is null then
    raise exception 'data e obrigatoria';
  end if;

  update public.client_milestones
  set title = trim(p_title),
      milestone_date = p_milestone_date,
      note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_id;
end;
$function$;

revoke all on function public.admin_update_client_milestone(uuid, text, date, text) from public;
revoke all on function public.admin_update_client_milestone(uuid, text, date, text) from anon;
grant execute on function public.admin_update_client_milestone(uuid, text, date, text) to authenticated;

-- ─── Concluir / reabrir ───────────────────────────────────────────────────────

create or replace function public.admin_set_client_milestone_done(
  p_id uuid,
  p_done boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant
  from public.client_milestones
  where id = p_id;

  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  update public.client_milestones
  set done_at = case when coalesce(p_done, false) then coalesce(done_at, now()) end,
      updated_at = now()
  where id = p_id;
end;
$function$;

revoke all on function public.admin_set_client_milestone_done(uuid, boolean) from public;
revoke all on function public.admin_set_client_milestone_done(uuid, boolean) from anon;
grant execute on function public.admin_set_client_milestone_done(uuid, boolean) to authenticated;

-- ─── Excluir (físico) ─────────────────────────────────────────────────────────

create or replace function public.admin_delete_client_milestone(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant
  from public.client_milestones
  where id = p_id;

  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  delete from public.client_milestones where id = p_id;
end;
$function$;

revoke all on function public.admin_delete_client_milestone(uuid) from public;
revoke all on function public.admin_delete_client_milestone(uuid) from anon;
grant execute on function public.admin_delete_client_milestone(uuid) to authenticated;
