\set ON_ERROR_STOP on

-- Reaproveita o schema falso e as asserções de P360-005/P360-006 e continua de onde elas param.
\ir appointment_availability.test.sql

-- O fixture de disponibilidade não define esta RPC; a migration só precisa dela para o grant.
create or replace function public.client_portal_overview(p_token uuid)
returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
grant execute on function public.client_portal_overview(uuid) to anon;

\ir ../migrations/20260803190000_public_briefing_only.sql

-- Acesso: quem esta logado na plataforma usa o mesmo cliente Supabase e chega como `authenticated`.
do $$
declare
  signature regprocedure;
begin
  foreach signature in array array[
    'public.public_list_calendar_days(uuid,date,integer,text,integer)'::regprocedure,
    'public.public_list_available_times(uuid,date,text,integer)'::regprocedure,
    'public.public_create_calendar_appointment_request(jsonb)'::regprocedure,
    'public.client_portal_create_appointment(jsonb)'::regprocedure
  ]
  loop
    if not has_function_privilege('anon', signature, 'execute') then
      raise exception 'anon perdeu acesso a %', signature;
    end if;
    if not has_function_privilege('authenticated', signature, 'execute') then
      raise exception 'authenticated continua sem acesso a %', signature;
    end if;
  end loop;
end;
$$;

-- Duracao: briefing aceita 15/30/45 e assume 30 quando as RPCs de listagem consultam sem duracao.
do $$
begin
  if private.resolve_appointment_duration_minutes('briefing', 15) <> 15
     or private.resolve_appointment_duration_minutes('briefing', 45) <> 45
     or private.resolve_appointment_duration_minutes('briefing', null) <> 30 then
    raise exception 'briefing rejeitou duracao valida ou perdeu o default de 30 minutos';
  end if;

  begin
    perform private.resolve_appointment_duration_minutes('briefing', 60);
    raise exception 'briefing aceitou 60 minutos';
  exception when check_violation then
    null;
  end;

  begin
    perform private.resolve_appointment_duration_minutes('briefing', 20);
    raise exception 'briefing aceitou duracao fora de 15/30/45';
  exception when check_violation then
    null;
  end;
end;
$$;

-- Canal anonimo: so briefing, sempre online, com contato obrigatorio.
do $$
declare
  v_result jsonb;
begin
  begin
    perform public.public_create_calendar_appointment_request(jsonb_build_object(
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'unit_name', 'Lead novo',
      'responsible_name', 'Fulana',
      'phone', '21999999999',
      'appointment_type', 'inspection',
      'duration_minutes', 60,
      'requested_starts_at', '2027-05-03T12:30:00Z',
      'requested_ends_at', '2027-05-03T13:30:00Z'
    ));
    raise exception 'canal publico aceitou inspecao sem login no portal';
  exception when others then
    if sqlerrm not like '%apenas briefing%' then raise; end if;
  end;

  begin
    perform public.public_create_calendar_appointment_request(jsonb_build_object(
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'unit_name', 'Lead novo',
      'responsible_name', 'Fulana',
      'phone', '21999999999',
      'appointment_type', 'briefing',
      'duration_minutes', 60,
      'requested_starts_at', '2027-05-03T12:30:00Z',
      'requested_ends_at', '2027-05-03T13:30:00Z'
    ));
    raise exception 'canal publico aceitou briefing de 60 minutos';
  exception when check_violation then
    null;
  end;

  begin
    perform public.public_create_calendar_appointment_request(jsonb_build_object(
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'unit_name', 'Lead novo',
      'appointment_type', 'briefing',
      'duration_minutes', 45,
      'requested_starts_at', '2027-05-03T12:30:00Z',
      'requested_ends_at', '2027-05-03T13:15:00Z'
    ));
    raise exception 'canal publico aceitou briefing sem responsavel nem telefone';
  exception when others then
    if sqlerrm not like '%responsible_name e obrigatorio%' then raise; end if;
  end;

  -- Modalidade presencial no payload e ignorada: briefing e sempre online.
  select public.public_create_calendar_appointment_request(jsonb_build_object(
    'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'unit_name', 'Lead novo',
    'responsible_name', 'Fulana',
    'phone', '21999999999',
    'attendance_mode', 'presencial',
    'municipality', 'Rio de Janeiro',
    'district', 'Centro',
    'appointment_type', 'briefing',
    'duration_minutes', 45,
    'requested_starts_at', '2027-05-03T12:30:00Z',
    'requested_ends_at', '2027-05-03T13:15:00Z'
  )) into v_result;

  if not exists (
    select 1
    from public.appointment_requests
    where public_token = (v_result->>'public_token')::uuid
      and appointment_type = 'briefing'
      and duration_minutes = 45
      and attendance_mode = 'online'
      and district = 'Online'
      and municipality is null
      and client_id is null
  ) then
    raise exception 'briefing publico nao foi gravado como online e sem vinculo de cliente';
  end if;
end;
$$;

-- Portal e o caminho de quem ja e cliente: briefing nao entra por la.
do $$
begin
  begin
    perform public.client_portal_create_appointment(jsonb_build_object(
      'portal_token', '20000000-0000-4000-8000-000000000003',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'attendance_mode', 'online',
      'appointment_type', 'briefing',
      'duration_minutes', 30,
      'requested_starts_at', '2027-05-10T12:30:00Z',
      'requested_ends_at', '2027-05-10T13:00:00Z'
    ));
    raise exception 'portal aceitou briefing, que e canal de primeiro contato';
  exception when others then
    if sqlerrm not like '%exclusivo do canal publico%' then raise; end if;
  end;
end;
$$;

select 'P360-007 public briefing-only tests passed' as result;
