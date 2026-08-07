\set ON_ERROR_STOP on

-- PORT-01 — continua de onde o fixture do P360-010 para (contas, unidades, visitas,
-- client_action_items e os helpers `private`).
\ir client_action_items.test.sql

-- Tabela de configuracao do tenant, que o fixture nao cria.
create table if not exists public.client_portal_settings (
  tenant_id uuid primary key,
  tutorial_pdf_url text,
  support_whatsapp text,
  quick_access_enabled boolean not null default true,
  multi_purpose_schedule boolean not null default false,
  action_plan_enabled boolean not null default true,
  service_requests_enabled boolean not null default false
);

insert into public.client_portal_settings (tenant_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
on conflict do nothing;

-- Colunas de pagamento que o fixture de disponibilidade nao traz.
alter table public.client_portal_accounts add column if not exists payment_status text not null default 'pending';
alter table public.client_portal_accounts add column if not exists payment_due_date date;
alter table public.client_portal_accounts add column if not exists payment_type text;
alter table public.client_portal_accounts add column if not exists payment_link text;
alter table public.client_portal_accounts add column if not exists payment_links jsonb not null default '[]'::jsonb;
alter table public.client_portal_accounts add column if not exists payment_updated_at timestamptz;
alter table public.client_portal_accounts add column if not exists main_drive_folder_url text;
alter table public.client_portal_accounts add column if not exists updated_at timestamptz;

alter table public.appointment_requests add column if not exists compliance_score smallint;
alter table public.appointment_requests add column if not exists sanitary_score smallint;
alter table public.appointment_requests add column if not exists nutrition_score smallint;
alter table public.appointment_requests add column if not exists critical_nc_count smallint;
alter table public.appointment_requests add column if not exists important_nc_count smallint;
alter table public.appointment_requests add column if not exists total_nc_count smallint;
alter table public.appointment_requests add column if not exists recurring_nc_count smallint;
alter table public.appointment_requests add column if not exists immediate_nc_count smallint;
alter table public.appointment_requests add column if not exists nc_items jsonb not null default '[]'::jsonb;
alter table public.appointment_requests add column if not exists report_due_at date;

alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists has_personalized_sanitary_folder boolean not null default false;
alter table public.clients add column if not exists personalized_sanitary_folder_url text;
alter table public.clients add column if not exists has_audit_service boolean not null default false;
alter table public.clients add column if not exists has_online_followup boolean not null default false;

create table if not exists public.appointment_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  inspection_id uuid,
  kind text,
  storage_bucket text not null default 'client-portal-files',
  storage_path text not null default 'teste.pdf',
  file_name text,
  mime_type text,
  caption text,
  created_at timestamptz not null default now()
);

-- Um relatorio, uma foto e um anexo na visita que a conta enxerga, e numeros de conformidade.
insert into public.appointment_attachments (tenant_id, appointment_request_id, kind)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '50000000-0000-4000-8000-000000000001', 'report_pdf'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '50000000-0000-4000-8000-000000000001', 'photo'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '50000000-0000-4000-8000-000000000001', 'attachment');

update public.appointment_requests
set compliance_score = 72, total_nc_count = 5, critical_nc_count = 1,
    nc_items = jsonb_build_array(jsonb_build_object('id', 'x', 'd', 'achado', 'c', true))
where id = '50000000-0000-4000-8000-000000000001';

-- A RPC de overview do fixture nao existe; a migration a substitui inteira, mas precisa de
-- uma versao anterior para o `create or replace` nao brigar com assinatura. Nao ha: o
-- `create or replace` cria do zero. Segue direto.
\ir ../migrations/20260807174939_portal_feature_gates.sql

-- Atalho do teste: o fixture tem varias visitas, entao pegar `visits -> 0` pega a mais
-- recente, que nao e a desta suite. Busca pela visita certa, pelo token publico.
create or replace function public.test_visit(p_token uuid, p_visit_token text)
returns jsonb
language sql
as $$
  select visit
  from jsonb_array_elements(public.client_portal_overview(p_token) -> 'units') as unit,
       jsonb_array_elements(unit -> 'visits') as visit
  where visit ->> 'public_token' = p_visit_token
  limit 1;
$$;

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.client_portal_account_features'::regclass) then
    raise exception 'RLS nao esta ativo em client_portal_account_features';
  end if;

  if has_table_privilege('anon', 'public.client_portal_account_features', 'select')
     or has_table_privilege('anon', 'public.client_portal_account_features', 'insert') then
    raise exception 'anon enxerga as travas do portal no nivel de tabela';
  end if;

  if has_table_privilege('authenticated', 'public.client_portal_account_features', 'insert')
     or has_table_privilege('authenticated', 'public.client_portal_account_features', 'update')
     or has_table_privilege('authenticated', 'public.client_portal_account_features', 'delete') then
    raise exception 'staff escreve direto nas travas em vez de passar pela RPC';
  end if;

  if not has_function_privilege('anon', 'public.client_portal_feature_gates(uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_feature_gates(uuid)'::regprocedure, 'execute') then
    raise exception 'a RPC de travas perdeu grant para anon ou authenticated';
  end if;

  if has_function_privilege('anon', 'public.admin_set_portal_feature(uuid,text,text,timestamptz,timestamptz,boolean,text)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.admin_set_portal_scheduling_mode(uuid,text)'::regprocedure, 'execute') then
    raise exception 'anon executa RPC de staff das travas';
  end if;

  -- A funcao de resolucao e interna: nem anon nem authenticated chamam direto.
  if has_function_privilege('anon', 'private.portal_account_gates(uuid)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'private.portal_account_gates(uuid)'::regprocedure, 'execute') then
    raise exception 'a resolucao interna das travas ficou executavel de fora';
  end if;
end;
$$;

-- ─── Sem regra nenhuma, tudo liberado ─────────────────────────────────────────
do $$
declare
  v_gates jsonb;
  v_overview jsonb;
  v_visit jsonb;
begin
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if not (v_gates -> 'features' = jsonb_build_object(
    'reports', true, 'photos', true, 'action_plan', true, 'compliance', true
  )) then
    raise exception 'conta sem regra nenhuma nao nasceu com tudo liberado: %', v_gates;
  end if;
  if (v_gates ->> 'overdue')::boolean then
    raise exception 'conta sem vencimento cadastrado foi marcada como em atraso';
  end if;

  v_visit := public.test_visit('20000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002');

  if (v_visit ->> 'report_count')::int <> 1
     or (v_visit ->> 'photo_count')::int <> 1
     or (v_visit ->> 'attachment_count')::int <> 1
     or (v_visit ->> 'compliance_score')::int <> 72 then
    raise exception 'sem trava, o overview deixou de mostrar entrega: %', v_visit;
  end if;
end;
$$;

-- ─── Ocultar por função, uma a uma ────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_overview jsonb;
  v_visit jsonb;
begin
  v_result := public.admin_set_portal_feature(
    '20000000-0000-4000-8000-000000000002', 'reports', 'hidden'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'ocultar relatorios falhou: %', v_result;
  end if;

  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  v_visit := public.test_visit('20000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002');

  if (v_visit ->> 'report_count')::int <> 0 or (v_visit ->> 'attachment_count')::int <> 0 then
    raise exception 'relatorios/documentos ocultos continuaram contando: %', v_visit;
  end if;
  -- Fotos e conformidade sao travas independentes: nao podem cair junto.
  if (v_visit ->> 'photo_count')::int <> 1 or (v_visit ->> 'compliance_score')::int <> 72 then
    raise exception 'ocultar relatorios derrubou funcao que nao foi tocada: %', v_visit;
  end if;
  if (v_overview -> 'feature_gates' ->> 'reports')::boolean then
    raise exception 'o overview nao avisou a trava de relatorios ao portal';
  end if;

  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'compliance', 'hidden');
  v_visit := public.test_visit('20000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002');
  if v_visit ->> 'compliance_score' is not null
     or v_visit ->> 'total_nc_count' is not null
     or jsonb_array_length(v_visit -> 'nc_items') <> 0 then
    raise exception 'indicadores ocultos vazaram score ou achados: %', v_visit;
  end if;

  -- Plano de acao tem trava propria.
  if jsonb_array_length(public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items') = 0 then
    raise exception 'ocultar indicadores derrubou o plano de acao junto';
  end if;
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'hidden');
  if jsonb_array_length(public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items') <> 0 then
    raise exception 'plano de acao oculto continuou saindo para o cliente';
  end if;

  -- Volta tudo ao normal.
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'reports', 'released');
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'compliance', 'released');
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'released');
end;
$$;

-- ─── Liberação e ocultação programadas ────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_gates jsonb;
begin
  -- Programada para o futuro: ainda fechada.
  v_result := public.admin_set_portal_feature(
    '20000000-0000-4000-8000-000000000002', 'reports', 'scheduled', now() + interval '2 days'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'programar liberacao falhou: %', v_result;
  end if;
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if (v_gates -> 'features' ->> 'reports')::boolean then
    raise exception 'liberacao programada para o futuro ja abriu';
  end if;

  -- Passada a data, abre sozinha, sem ninguem mexer.
  perform public.admin_set_portal_feature(
    '20000000-0000-4000-8000-000000000002', 'reports', 'scheduled', now() - interval '1 minute'
  );
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if not (v_gates -> 'features' ->> 'reports')::boolean then
    raise exception 'liberacao programada nao abriu depois da data';
  end if;

  -- Programar sem data e recusado: seria bloqueio permanente disfarcado.
  v_result := public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'reports', 'scheduled');
  if v_result ->> 'error' is distinct from 'liberacao programada exige data' then
    raise exception 'programar sem data foi aceito: %', v_result;
  end if;

  -- Ocultacao programada (fim de contrato): antes da data continua aberto.
  perform public.admin_set_portal_feature(
    '20000000-0000-4000-8000-000000000002', 'photos', 'released', null, now() + interval '2 days'
  );
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if not (v_gates -> 'features' ->> 'photos')::boolean then
    raise exception 'ocultacao programada fechou antes da hora';
  end if;

  perform public.admin_set_portal_feature(
    '20000000-0000-4000-8000-000000000002', 'photos', 'released', null, now() - interval '1 minute'
  );
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if (v_gates -> 'features' ->> 'photos')::boolean then
    raise exception 'ocultacao programada nao fechou depois da data';
  end if;

  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'reports', 'released');
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'photos', 'released');
end;
$$;

-- ─── Inadimplência ────────────────────────────────────────────────────────────
do $$
declare
  v_gates jsonb;
  v_overview jsonb;
  v_visit jsonb;
begin
  -- Vencido dentro da tolerancia de 5 dias: ainda nao e atraso.
  update public.client_portal_accounts
  set payment_status = 'pending',
      payment_due_date = ((now() at time zone 'America/Sao_Paulo')::date - 3)
  where id = '20000000-0000-4000-8000-000000000002';

  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if (v_gates ->> 'overdue')::boolean then
    raise exception 'tolerancia de 5 dias nao foi respeitada';
  end if;
  if (v_gates ->> 'scheduling_suspended')::boolean then
    raise exception 'agendamento foi suspenso dentro da tolerancia';
  end if;

  -- Passou a tolerancia: atraso e agendamento suspenso sozinho.
  update public.client_portal_accounts
  set payment_due_date = ((now() at time zone 'America/Sao_Paulo')::date - 10)
  where id = '20000000-0000-4000-8000-000000000002';

  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if not (v_gates ->> 'overdue')::boolean then
    raise exception 'atraso alem da tolerancia nao foi detectado';
  end if;
  if not (v_gates ->> 'scheduling_suspended')::boolean then
    raise exception 'modo auto nao suspendeu o agendamento em atraso';
  end if;

  -- **A regra que a Ester pediu**: em atraso, o que ja foi entregue continua visivel.
  v_visit := public.test_visit('20000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002');
  if (v_visit ->> 'report_count')::int <> 1 or (v_visit ->> 'photo_count')::int <> 1 then
    raise exception 'atraso escondeu entrega que ja tinha sido feita: %', v_visit;
  end if;
  if jsonb_array_length(public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items') = 0 then
    raise exception 'atraso escondeu o plano de acao sem ninguem pedir';
  end if;

  -- So esconde o que ela marcar para entrar na regra.
  perform public.admin_set_portal_feature(
    '20000000-0000-4000-8000-000000000002', 'reports', 'released', null, null, true
  );
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if (v_gates -> 'features' ->> 'reports')::boolean then
    raise exception 'funcao marcada para travar em atraso continuou aberta';
  end if;
  if not (v_gates -> 'features' ->> 'photos')::boolean then
    raise exception 'funcao NAO marcada travou junto por causa do atraso';
  end if;

  -- Pagou: reabre sozinha.
  update public.client_portal_accounts set payment_status = 'paid'
  where id = '20000000-0000-4000-8000-000000000002';
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if not (v_gates -> 'features' ->> 'reports')::boolean then
    raise exception 'pagamento confirmado nao reabriu a funcao travada por atraso';
  end if;
  if (v_gates ->> 'scheduling_suspended')::boolean then
    raise exception 'pagamento confirmado nao devolveu o agendamento';
  end if;
end;
$$;

-- ─── Trava manual de exceção e suspensão manual ───────────────────────────────
do $$
declare
  v_result jsonb;
  v_gates jsonb;
begin
  update public.client_portal_accounts
  set payment_status = 'pending',
      payment_due_date = ((now() at time zone 'America/Sao_Paulo')::date - 30)
  where id = '20000000-0000-4000-8000-000000000002';

  -- "Liberado mesmo em atraso": a excecao que a Ester pediu.
  v_result := public.admin_set_portal_scheduling_mode('20000000-0000-4000-8000-000000000002', 'always_open');
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'trava manual de excecao falhou: %', v_result;
  end if;
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if (v_gates ->> 'scheduling_suspended')::boolean then
    raise exception 'a trava manual nao segurou a suspensao automatica';
  end if;
  if not (v_gates ->> 'overdue')::boolean then
    raise exception 'a trava manual apagou o atraso em vez de so liberar o agendamento';
  end if;

  -- Suspensao manual permanente continua existindo.
  perform public.admin_set_portal_scheduling_mode('20000000-0000-4000-8000-000000000002', 'suspended');
  v_gates := public.client_portal_feature_gates('20000000-0000-4000-8000-000000000003');
  if not (v_gates ->> 'scheduling_suspended')::boolean then
    raise exception 'suspensao manual nao suspendeu';
  end if;

  -- O toggle antigo continua funcionando e escreve o modo novo.
  perform public.admin_set_portal_scheduling_suspended('20000000-0000-4000-8000-000000000002', false);
  if (select scheduling_suspension_mode from public.client_portal_accounts
      where id = '20000000-0000-4000-8000-000000000002') <> 'auto' then
    raise exception 'o toggle legado nao migrou para o modo novo';
  end if;

  v_result := public.admin_set_portal_scheduling_mode('20000000-0000-4000-8000-000000000002', 'qualquer');
  if v_result ->> 'error' is distinct from 'modo invalido' then
    raise exception 'modo invalido foi aceito: %', v_result;
  end if;

  update public.client_portal_accounts set payment_status = 'paid', payment_due_date = null
  where id = '20000000-0000-4000-8000-000000000002';
end;
$$;

-- ─── Tenant cruzado ───────────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  -- is_tenant_staff do fixture so reconhece o tenant "aaaa...".
  v_result := public.admin_set_portal_feature('20000000-0000-4000-8000-000000000022', 'reports', 'hidden');
  if v_result ->> 'error' is distinct from 'sem permissao' then
    raise exception 'staff de um tenant travou funcao da consultoria vizinha: %', v_result;
  end if;

  v_result := public.admin_set_portal_scheduling_mode('20000000-0000-4000-8000-000000000022', 'suspended');
  if v_result ->> 'error' is distinct from 'sem permissao' then
    raise exception 'staff de um tenant suspendeu agendamento do tenant vizinho: %', v_result;
  end if;

  v_result := public.client_portal_feature_gates('99999999-9999-4999-8999-999999999999');
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'token invalido leu as travas: %', v_result;
  end if;

  v_result := public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'agenda', 'hidden');
  if v_result ->> 'error' is distinct from 'funcao invalida' then
    raise exception 'funcao fora da lista foi aceita: %', v_result;
  end if;
end;
$$;

select 'Portal feature gates (PORT-01) tests passed' as result;
