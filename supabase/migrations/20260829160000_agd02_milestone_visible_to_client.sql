-- AGD-02b — o marco pode aparecer para o cliente, mas só quando a consultora decidir.
--
-- Pedido da Ester depois de ver a primeira versão do card: "outros pontos" pode ser um lembrete
-- interno dela ("cobrar renovação de contrato") ou algo que o próprio cliente deveria ver ("obra
-- na área externa dia X"). Por padrão nasce interno (`visible_to_client = false`) — só o que ela
-- marcar explicitamente entra na agenda do portal. Nunca afeta disponibilidade de horário: o
-- marco é só sinalização, a rotina de conflito de agenda (`private.appointment_has_conflict`)
-- nem sabe que esta tabela existe.
--
-- Separada da migration que expõe isso em `client_portal_overview` (20260829161000) porque as
-- duas mexem em domínios diferentes — esta só toca `client_milestones` e suas RPCs — e porque
-- juntas quebravam a suíte independente de `client_milestones.test.sql` (fixture sem
-- `client_portal_accounts`, que `client_portal_overview` exige em `%rowtype`).

alter table public.client_milestones
  add column if not exists visible_to_client boolean not null default false;

comment on column public.client_milestones.visible_to_client is
  'Só true faz o marco aparecer na agenda do portal do cliente (client_portal_overview). '
  'Default false: nasce interno, a consultora liga por marco.';

-- ─── Criar: mesmo corpo de 20260829093956, com o parâmetro novo ───────────────

drop function if exists public.admin_create_client_milestone(uuid, text, date, text, text);

create or replace function public.admin_create_client_milestone(
  p_client_id uuid,
  p_title text,
  p_milestone_date date,
  p_note text default null,
  p_created_by text default null,
  p_visible_to_client boolean default false
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
    tenant_id, client_id, title, note, milestone_date, created_by, visible_to_client
  ) values (
    v_tenant,
    p_client_id,
    trim(p_title),
    nullif(trim(coalesce(p_note, '')), ''),
    p_milestone_date,
    nullif(trim(coalesce(p_created_by, '')), ''),
    coalesce(p_visible_to_client, false)
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$function$;

revoke all on function public.admin_create_client_milestone(uuid, text, date, text, text, boolean) from public;
revoke all on function public.admin_create_client_milestone(uuid, text, date, text, text, boolean) from anon;
grant execute on function public.admin_create_client_milestone(uuid, text, date, text, text, boolean) to authenticated;

-- ─── Editar: idem, com o parâmetro novo ───────────────────────────────────────

drop function if exists public.admin_update_client_milestone(uuid, text, date, text);

create or replace function public.admin_update_client_milestone(
  p_id uuid,
  p_title text,
  p_milestone_date date,
  p_note text default null,
  p_visible_to_client boolean default false
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
      visible_to_client = coalesce(p_visible_to_client, false),
      updated_at = now()
  where id = p_id;
end;
$function$;

revoke all on function public.admin_update_client_milestone(uuid, text, date, text, boolean) from public;
revoke all on function public.admin_update_client_milestone(uuid, text, date, text, boolean) from anon;
grant execute on function public.admin_update_client_milestone(uuid, text, date, text, boolean) to authenticated;
