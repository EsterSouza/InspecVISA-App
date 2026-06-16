-- 026_portal_suspend_and_hide_report.sql
-- Item 5: suspensão de agendamento por falta de pagamento (por conta de portal)
-- e ocultação de relatório da visão do cliente (por visita).

alter table public.client_portal_accounts
  add column if not exists scheduling_suspended boolean not null default false;

alter table public.appointment_requests
  add column if not exists report_hidden boolean not null default false;

comment on column public.client_portal_accounts.scheduling_suspended is 'Quando true, o portal bloqueia novos agendamentos (ex.: inadimplência).';
comment on column public.appointment_requests.report_hidden is 'Quando true, o relatório fica oculto da visão do cliente no portal.';

-- RPC: staff alterna a suspensão de agendamento da conta de portal.
create or replace function public.admin_set_portal_scheduling_suspended(
  p_account_id uuid,
  p_suspended boolean
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.client_portal_accounts where id = p_account_id;
  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  update public.client_portal_accounts
  set scheduling_suspended = coalesce(p_suspended, false),
      updated_at = now()
  where id = p_account_id;
end;
$$;

revoke execute on function public.admin_set_portal_scheduling_suspended(uuid, boolean) from anon;
grant execute on function public.admin_set_portal_scheduling_suspended(uuid, boolean) to authenticated;

-- client_portal_overview: expõe scheduling_suspended e zera report_count quando report_hidden.
-- client_portal_create_appointment: bloqueia agendamento quando scheduling_suspended.
-- (Definições completas recriadas via apply_migration 026 / 026b — ver histórico do Supabase.)
