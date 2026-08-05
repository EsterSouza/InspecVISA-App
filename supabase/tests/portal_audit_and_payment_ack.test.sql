\set ON_ERROR_STOP on

-- PROD-01 — reaproveita o schema falso do fixture de disponibilidade (contas de portal, clientes,
-- solicitações e os helpers `private`) e continua de onde ele para.
\ir appointment_availability.test.sql

-- Colunas e tabela que o fixture não cria e a migration referencia.
alter table public.client_portal_accounts add column if not exists payment_updated_at timestamptz;
alter table public.client_portal_accounts add column if not exists updated_at timestamptz;

create table if not exists public.appointment_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_request_id uuid not null references public.appointment_requests(id),
  kind text,
  storage_bucket text not null default 'relatorios',
  storage_path text not null default 'teste.pdf',
  created_at timestamptz not null default now()
);

-- Conta inativa da mesma consultoria, para o caminho de acesso revogado.
insert into public.client_portal_accounts (id, tenant_id, name, portal_token, is_active)
values (
  '20000000-0000-4000-8000-000000000004',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Conta desativada',
  '20000000-0000-4000-8000-000000000005',
  false
);

-- Solicitação sem cliente vinculado: existe, mas está fora do acesso da conta. Fica como
-- `cancelled` porque compromisso ativo exigiria horário, e o horário não importa para este teste.
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status
) values (
  '4a000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  null,
  '4a000000-0000-4000-8000-000000000002',
  'Unidade sem vinculo',
  'Centro',
  'cancelled'
);

\ir ../migrations/20260805010139_client_portal_audit_and_payment_ack.sql

-- Acesso: o app usa um cliente Supabase só, então a RPC pública precisa dos dois papéis.
do $$
declare
  signature regprocedure;
begin
  foreach signature in array array[
    'public.client_portal_audit_event(uuid,text,jsonb,uuid,uuid,text)'::regprocedure,
    'public.client_portal_payment_acknowledge(uuid,text,text)'::regprocedure
  ]
  loop
    if not has_function_privilege('anon', signature, 'execute') then
      raise exception 'anon nao executa %', signature;
    end if;
    if not has_function_privilege('authenticated', signature, 'execute') then
      raise exception 'authenticated nao executa %', signature;
    end if;
  end loop;
end;
$$;

-- A trilha é somente leitura para o staff e invisível para o anônimo.
do $$
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.client_portal_audit_events'::regclass
  ) then
    raise exception 'RLS nao esta ativo na trilha de auditoria';
  end if;

  if has_table_privilege('anon', 'public.client_portal_audit_events', 'select')
     or has_table_privilege('anon', 'public.client_portal_audit_events', 'insert') then
    raise exception 'anon enxerga a trilha de auditoria';
  end if;

  if not has_table_privilege('authenticated', 'public.client_portal_audit_events', 'select') then
    raise exception 'staff perdeu a leitura da trilha de auditoria';
  end if;

  if has_table_privilege('authenticated', 'public.client_portal_audit_events', 'insert')
     or has_table_privilege('authenticated', 'public.client_portal_audit_events', 'update')
     or has_table_privilege('authenticated', 'public.client_portal_audit_events', 'delete') then
    raise exception 'a trilha deixou de ser append-only para o staff';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'client_portal_audit_events'
      and cmd <> 'SELECT'
  ) then
    raise exception 'sobrou policy de escrita na trilha de auditoria';
  end if;
end;
$$;

-- Token válido: o aviso entra na trilha e carimba o pagamento na conta.
do $$
declare
  v_result jsonb;
  v_event public.client_portal_audit_events%rowtype;
  v_payment_updated_at timestamptz;
begin
  v_result := public.client_portal_payment_acknowledge(
    '20000000-0000-4000-8000-000000000003',
    '  paguei por pix hoje  ',
    'Mozilla/5.0 (teste)'
  );

  if v_result <> jsonb_build_object('ok', true) then
    raise exception 'aviso de pagamento com token valido retornou %', v_result;
  end if;

  select * into v_event
  from public.client_portal_audit_events
  where event_type = 'payment_acknowledged';

  if not found then
    raise exception 'aviso de pagamento nao gerou linha de auditoria';
  end if;

  if v_event.account_id <> '20000000-0000-4000-8000-000000000002'
     or v_event.tenant_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'auditoria do pagamento saiu com conta ou consultoria errada';
  end if;

  if v_event.payload ->> 'note' <> 'paguei por pix hoje' then
    raise exception 'a observacao do cliente nao foi preservada: %', v_event.payload;
  end if;

  if v_event.user_agent <> 'Mozilla/5.0 (teste)' then
    raise exception 'user agent nao foi registrado';
  end if;

  select payment_updated_at into v_payment_updated_at
  from public.client_portal_accounts
  where id = '20000000-0000-4000-8000-000000000002';

  if v_payment_updated_at is null then
    raise exception 'payment_updated_at continuou nulo depois do aviso';
  end if;
end;
$$;

-- Token inexistente e conta desativada não escrevem nada.
do $$
declare
  v_before bigint;
  v_after bigint;
  v_result jsonb;
begin
  select count(*) into v_before from public.client_portal_audit_events;

  v_result := public.client_portal_payment_acknowledge('99999999-9999-4999-8999-999999999999');
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'token inexistente foi aceito: %', v_result;
  end if;

  v_result := public.client_portal_payment_acknowledge('20000000-0000-4000-8000-000000000005');
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'conta desativada avisou pagamento: %', v_result;
  end if;

  select count(*) into v_after from public.client_portal_audit_events;
  if v_after <> v_before then
    raise exception 'acesso invalido gravou % linha(s) na trilha', v_after - v_before;
  end if;
end;
$$;

-- Auditoria genérica: evento válido entra; evento vazio, token inválido e visita fora do acesso não.
do $$
declare
  v_result jsonb;
  v_before bigint;
  v_after bigint;
  v_event public.client_portal_audit_events%rowtype;
begin
  v_result := public.client_portal_audit_event(
    '20000000-0000-4000-8000-000000000003',
    '  Report_Download_Clicked  ',
    jsonb_build_object('file_name', 'relatorio.pdf')
  );
  if v_result <> jsonb_build_object('ok', true) then
    raise exception 'evento valido foi recusado: %', v_result;
  end if;

  select * into v_event
  from public.client_portal_audit_events
  where event_type = 'report_download_clicked';

  if not found then
    raise exception 'evento valido nao normalizou o tipo para minusculo sem espacos';
  end if;

  select count(*) into v_before from public.client_portal_audit_events;

  v_result := public.client_portal_audit_event('20000000-0000-4000-8000-000000000003', '   ');
  if v_result ->> 'error' is distinct from 'evento invalido' then
    raise exception 'evento vazio foi aceito: %', v_result;
  end if;

  v_result := public.client_portal_audit_event('99999999-9999-4999-8999-999999999999', 'login');
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'token inexistente registrou evento: %', v_result;
  end if;

  v_result := public.client_portal_audit_event('20000000-0000-4000-8000-000000000005', 'login');
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'conta desativada registrou evento: %', v_result;
  end if;

  v_result := public.client_portal_audit_event(
    '20000000-0000-4000-8000-000000000003',
    'appointment_viewed',
    '{}'::jsonb,
    '99999999-9999-4999-8999-999999999998'
  );
  if v_result ->> 'error' is distinct from 'solicitacao invalida' then
    raise exception 'visita inexistente foi aceita: %', v_result;
  end if;

  v_result := public.client_portal_audit_event(
    '20000000-0000-4000-8000-000000000003',
    'appointment_viewed',
    '{}'::jsonb,
    '4a000000-0000-4000-8000-000000000002'
  );
  if v_result ->> 'error' is distinct from 'solicitacao fora do acesso' then
    raise exception 'visita fora do acesso da conta foi aceita: %', v_result;
  end if;

  select count(*) into v_after from public.client_portal_audit_events;
  if v_after <> v_before then
    raise exception 'evento recusado gravou % linha(s) na trilha', v_after - v_before;
  end if;
end;
$$;

select 'Portal audit and payment acknowledge tests passed' as result;
