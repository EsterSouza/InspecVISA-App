-- PROD-01 / PROD-02 — auditoria do portal do cliente e aviso de pagamento.
--
-- Substitui `20260613125641_client_portal_audit.sql`, que foi escrita em junho/2026 e nunca chegou
-- a ser aplicada em produção. O conteúdo é o mesmo, com o endurecimento que virou padrão depois:
-- `set search_path = ''` com todos os identificadores qualificados, grants explícitos de tabela e
-- trilha somente-leitura para quem está logado. Idempotente: pode rodar sobre o banco que já tenha
-- recebido a versão de junho.
--
-- Em produção foi aplicada em duas etapas: `20260805010139` (este arquivo) e `20260805010218`, que
-- corrigiu os grants de tabela. Este arquivo já traz o resultado final das duas.

create table if not exists public.client_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid references public.client_portal_accounts(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  appointment_request_id uuid references public.appointment_requests(id) on delete set null,
  attachment_id uuid references public.appointment_attachments(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.client_portal_audit_events is
  'Trilha de auditoria do portal do cliente. Escrita apenas pelas funções security definer '
  '`client_portal_audit_event` e `client_portal_payment_acknowledge`; para o staff é somente leitura.';

create index if not exists idx_client_portal_audit_events_tenant_created
  on public.client_portal_audit_events (tenant_id, created_at desc);

create index if not exists idx_client_portal_audit_events_account_created
  on public.client_portal_audit_events (account_id, created_at desc);

create index if not exists idx_client_portal_audit_events_client_created
  on public.client_portal_audit_events (client_id, created_at desc);

create index if not exists idx_client_portal_audit_events_request_created
  on public.client_portal_audit_events (appointment_request_id, created_at desc);

alter table public.client_portal_audit_events enable row level security;

-- A trilha é append-only: só as funções abaixo escrevem, e elas rodam como definer.
drop policy if exists "staff read portal audit events" on public.client_portal_audit_events;
create policy "staff read portal audit events"
  on public.client_portal_audit_events for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

drop policy if exists "staff update portal audit events" on public.client_portal_audit_events;
drop policy if exists "staff delete portal audit events" on public.client_portal_audit_events;

-- O Supabase concede `all` por padrão em tabela nova do schema public para `anon` e
-- `authenticated`. A RLS já barraria a escrita, mas o privilégio precisa ser revogado explicitamente
-- para a trilha ser append-only também no nível de tabela.
revoke all on table public.client_portal_audit_events from public;
revoke all on table public.client_portal_audit_events from anon;
revoke all on table public.client_portal_audit_events from authenticated;
grant select on table public.client_portal_audit_events to authenticated;

create or replace function public.client_portal_audit_event(
  p_token uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_appointment_token uuid default null,
  p_attachment_id uuid default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.client_portal_accounts%rowtype;
  v_request public.appointment_requests%rowtype;
  v_attachment public.appointment_attachments%rowtype;
  v_client_id uuid;
  v_event_type text := lower(trim(coalesce(p_event_type, '')));
begin
  if v_event_type = '' then
    return jsonb_build_object('error', 'evento invalido');
  end if;

  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    return jsonb_build_object('error', 'payload invalido');
  end if;

  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if p_appointment_token is not null then
    select * into v_request
    from public.appointment_requests
    where public_token = p_appointment_token
      and tenant_id = v_account.tenant_id;

    if not found then
      return jsonb_build_object('error', 'solicitacao invalida');
    end if;

    if v_request.client_id is null
       or not exists (
         select 1
         from public.client_portal_account_clients ac
         where ac.account_id = v_account.id
           and ac.client_id = v_request.client_id
       ) then
      return jsonb_build_object('error', 'solicitacao fora do acesso');
    end if;

    v_client_id := v_request.client_id;
  end if;

  if p_attachment_id is not null then
    select * into v_attachment
    from public.appointment_attachments
    where id = p_attachment_id
      and tenant_id = v_account.tenant_id;

    if not found then
      return jsonb_build_object('error', 'arquivo invalido');
    end if;

    if v_request.id is not null and v_attachment.appointment_request_id <> v_request.id then
      return jsonb_build_object('error', 'arquivo fora da visita');
    end if;

    if v_request.id is null then
      select * into v_request
      from public.appointment_requests
      where id = v_attachment.appointment_request_id
        and tenant_id = v_account.tenant_id;

      if not found
         or v_request.client_id is null
         or not exists (
           select 1
           from public.client_portal_account_clients ac
           where ac.account_id = v_account.id
             and ac.client_id = v_request.client_id
         ) then
        return jsonb_build_object('error', 'arquivo fora do acesso');
      end if;

      v_client_id := v_request.client_id;
    end if;
  end if;

  insert into public.client_portal_audit_events (
    tenant_id,
    account_id,
    client_id,
    appointment_request_id,
    attachment_id,
    event_type,
    payload,
    user_agent
  )
  values (
    v_account.tenant_id,
    v_account.id,
    v_client_id,
    v_request.id,
    p_attachment_id,
    v_event_type,
    coalesce(p_payload, '{}'::jsonb),
    left(nullif(p_user_agent, ''), 500)
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- O app usa um cliente Supabase só: com sessão de staff no navegador a mesma RPC pública chega
-- como `authenticated`. Sem os dois grants, o portal quebra justamente para quem está logado.
revoke execute on function public.client_portal_audit_event(uuid, text, jsonb, uuid, uuid, text) from public;
grant execute on function public.client_portal_audit_event(uuid, text, jsonb, uuid, uuid, text) to anon;
grant execute on function public.client_portal_audit_event(uuid, text, jsonb, uuid, uuid, text) to authenticated;

create or replace function public.client_portal_payment_acknowledge(
  p_token uuid,
  p_note text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.client_portal_accounts%rowtype;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  insert into public.client_portal_audit_events (
    tenant_id,
    account_id,
    event_type,
    payload,
    user_agent
  )
  values (
    v_account.tenant_id,
    v_account.id,
    'payment_acknowledged',
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')),
    left(nullif(p_user_agent, ''), 500)
  );

  update public.client_portal_accounts
  set payment_updated_at = now(),
      updated_at = now()
  where id = v_account.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.client_portal_payment_acknowledge(uuid, text, text) from public;
grant execute on function public.client_portal_payment_acknowledge(uuid, text, text) to anon;
grant execute on function public.client_portal_payment_acknowledge(uuid, text, text) to authenticated;
