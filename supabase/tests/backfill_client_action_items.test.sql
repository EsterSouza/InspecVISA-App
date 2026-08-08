\set ON_ERROR_STOP on

-- P360-010 (adendo) — projeção retroativa. Continua de onde o fixture do P360-010 para
-- (contas, unidades, visitas com `inspection_id` e a RPC de publicação).
\ir client_action_items.test.sql

-- Tabelas da inspeção que o fixture de agenda não cria.
create table if not exists public.inspections (
  id uuid primary key,
  tenant_id uuid not null,
  client_id uuid,
  status text not null default 'completed',
  inspection_date timestamptz,
  deleted_at timestamptz
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null,
  item_id text,
  result text,
  situation_description text,
  corrective_action text,
  responsible text,
  deadline text,
  custom_description text,
  deleted_at timestamptz
);

create table if not exists public.checklist_items (
  id uuid primary key,
  description text,
  weight integer,
  is_critical boolean not null default false
);

create table if not exists public.inspection_report_versions (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null,
  version integer not null,
  snapshot_json jsonb not null
);

-- Visita e inspeção próprias: as do fixture do P360-010 já têm plano de ação publicado, e
-- reaproveitá-las misturaria as contagens deste teste com as de lá.
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status, requested_date,
  appointment_type, inspection_id
) values (
  '50000000-0000-4000-8000-000000000031',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000032',
  'Unidade teste',
  'Centro',
  'report_available',
  date '2026-06-10',
  'inspection',
  '60000000-0000-4000-8000-000000000031'
);

-- Inspeção concluída da unidade que a conta enxerga.
insert into public.inspections (id, tenant_id, client_id, status, inspection_date)
values (
  '60000000-0000-4000-8000-000000000031',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  'completed',
  timestamptz '2026-06-10 14:00:00-03'
);

-- Inspeção AINDA em andamento (visita …0005): não pode virar plano de ação.
insert into public.inspections (id, tenant_id, client_id, status, inspection_date)
values (
  '60000000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  'in_progress',
  timestamptz '2026-07-10 14:00:00-03'
);

-- Inspeção da outra consultoria (visita …0009): outro tenant, fora do alcance.
insert into public.inspections (id, tenant_id, client_id, status, inspection_date)
values (
  '60000000-0000-4000-8000-000000000005',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '20000000-0000-4000-8000-000000000021',
  'completed',
  timestamptz '2026-05-20 14:00:00-03'
);

-- Roteiro VIVO: o item crítico foi reescrito depois da visita (é o cenário do REF-05).
insert into public.checklist_items (id, description, weight, is_critical)
values
  ('90000000-0000-4000-8000-000000000001', 'DESCRICAO REESCRITA DEPOIS DA VISITA', 3, false),
  ('90000000-0000-4000-8000-000000000002', 'Lavatorio exclusivo (roteiro vivo)', 5, false);

-- Roteiro CONGELADO no relatório: é o que o cliente leu no PDF.
insert into public.inspection_report_versions (inspection_id, version, snapshot_json)
values (
  '60000000-0000-4000-8000-000000000031',
  1,
  jsonb_build_object(
    'reportSnapshot', jsonb_build_object(
      'template', jsonb_build_object(
        'sections', jsonb_build_array(
          jsonb_build_object(
            'items', jsonb_build_array(
              jsonb_build_object(
                'id', '90000000-0000-4000-8000-000000000001',
                'description', 'Possuir alvara sanitario vigente',
                'weight', 10,
                'isCritical', true
              ),
              jsonb_build_object(
                'id', '90000000-0000-4000-8000-000000000002',
                'description', 'Lavatorio exclusivo para higienizacao das maos',
                'weight', 5,
                'isCritical', false
              )
            )
          )
        )
      )
    )
  )
);

insert into public.responses (
  inspection_id, item_id, result, situation_description, corrective_action, responsible, deadline
) values
  (
    '60000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000001',
    'not_complies', 'Alvara vencido desde janeiro.', 'Protocolar a renovacao.', 'Direcao tecnica', 'Imediato'
  ),
  (
    '60000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000002',
    'not_complies', 'Sala de curativos sem lavatorio.', 'Instalar lavatorio.', null, '30 dias'
  ),
  -- Conforme: não vira pendência.
  (
    '60000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000002',
    'complies', null, null, null, null
  );

-- Item avulso, sem roteiro nenhum: o título tem de vir da descrição própria.
insert into public.responses (
  inspection_id, item_id, result, situation_description, custom_description, deadline
) values (
  '60000000-0000-4000-8000-000000000031', 'item-avulso-sem-roteiro',
  'not_complies', 'Achado fora do roteiro.', 'Extintor com carga vencida', 'assim que possivel'
);

-- Resposta apagada: não entrou no relatório, não entra na projeção.
insert into public.responses (
  inspection_id, item_id, result, situation_description, deleted_at
) values (
  '60000000-0000-4000-8000-000000000031', 'item-apagado',
  'not_complies', 'Nao deveria aparecer.', now()
);

-- NC na inspeção em andamento e na de outro tenant, para provar que ficam de fora.
insert into public.responses (inspection_id, item_id, result, situation_description)
values
  ('60000000-0000-4000-8000-000000000003', 'item-em-andamento', 'not_complies', 'Inspecao aberta.'),
  ('60000000-0000-4000-8000-000000000005', 'item-outro-tenant', 'not_complies', 'Outra consultoria.');

\ir ../migrations/20260808002000_backfill_client_action_items.sql

-- ─── Conversão do prazo ───────────────────────────────────────────────────────
do $$
begin
  if private.deadline_to_days('Imediato') is distinct from 0
     or private.deadline_to_days('24 horas') is distinct from 1
     or private.deadline_to_days('12 horas') is distinct from 1
     or private.deadline_to_days('30 dias') is distinct from 30
     or private.deadline_to_days('2 semanas') is distinct from 14
     or private.deadline_to_days('3 meses') is distinct from 90
     or private.deadline_to_days('1 mês') is distinct from 30 then
    raise exception 'conversao de prazo divergente de deadlineToDays';
  end if;

  -- O que não dá para datar continua sem prazo, em vez de ganhar prazo inventado.
  if private.deadline_to_days('assim que possivel') is not null
     or private.deadline_to_days('30') is not null
     or private.deadline_to_days('') is not null
     or private.deadline_to_days(null) is not null then
    raise exception 'prazo indatavel virou data';
  end if;
end;
$$;

-- ─── Ensaio: não escreve nada ─────────────────────────────────────────────────
do $$
declare
  v_before integer;
  v_after integer;
  v_result jsonb;
begin
  select count(*) into v_before from public.client_action_items;
  v_result := public.admin_backfill_client_action_items();

  if (v_result ->> 'dry_run')::boolean is distinct from true then
    raise exception 'o padrao da funcao deixou de ser ensaio: %', v_result;
  end if;

  select count(*) into v_after from public.client_action_items;
  if v_after <> v_before then
    raise exception 'o ensaio escreveu no banco (% -> %)', v_before, v_after;
  end if;

  -- A visita …0003 tem 3 NCs projetáveis (2 do roteiro + 1 avulsa).
  if not exists (
    select 1 from jsonb_array_elements(v_result -> 'detail') d
    where (d ->> 'appointment_request_id')::uuid = '50000000-0000-4000-8000-000000000031'
      and (d ->> 'items')::int = 3
  ) then
    raise exception 'o ensaio nao contou as NCs da visita concluida: %', v_result;
  end if;

  -- Inspeção em andamento e visita de outro tenant não aparecem nem no ensaio.
  if exists (
    select 1 from jsonb_array_elements(v_result -> 'detail') d
    where (d ->> 'appointment_request_id')::uuid in (
      '50000000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000009'
    )
  ) then
    raise exception 'o ensaio alcancou inspecao aberta ou de outro tenant: %', v_result;
  end if;
end;
$$;

-- ─── Backfill de verdade ──────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_item public.client_action_items%rowtype;
begin
  v_result := public.admin_backfill_client_action_items(
    '50000000-0000-4000-8000-000000000031', false
  );
  if (v_result ->> 'created')::int <> 3 then
    raise exception 'o backfill nao criou as 3 pendencias: %', v_result;
  end if;

  -- O texto vem do roteiro CONGELADO, não do que foi reescrito depois.
  select * into v_item
  from public.client_action_items
  where source_item_id = '90000000-0000-4000-8000-000000000001'
    and appointment_request_id = '50000000-0000-4000-8000-000000000031';

  if v_item.title <> 'Possuir alvara sanitario vigente' then
    raise exception 'o titulo veio do roteiro de hoje, nao do relatorio entregue: %', v_item.title;
  end if;
  if v_item.priority <> 'urgent' then
    raise exception 'item critico no relatorio nao virou urgente: %', v_item.priority;
  end if;
  -- `Imediato` na visita de 10/06 vence no mesmo dia.
  if v_item.due_date is distinct from date '2026-06-10' then
    raise exception 'prazo imediato nao caiu na data da visita: %', v_item.due_date;
  end if;
  if v_item.responsible is distinct from 'Direcao tecnica' then
    raise exception 'perdeu o responsavel da resposta: %', v_item.responsible;
  end if;

  select * into v_item
  from public.client_action_items
  where source_item_id = '90000000-0000-4000-8000-000000000002'
    and appointment_request_id = '50000000-0000-4000-8000-000000000031';
  if v_item.priority <> 'important' or v_item.due_date is distinct from date '2026-07-10' then
    raise exception 'item de peso 5 com 30 dias saiu errado: % / %', v_item.priority, v_item.due_date;
  end if;

  -- Item avulso: título da descrição própria e, sem prazo datável, sem prazo.
  select * into v_item
  from public.client_action_items
  where source_item_id = 'item-avulso-sem-roteiro';
  if v_item.title <> 'Extintor com carga vencida' then
    raise exception 'item avulso perdeu a descricao propria: %', v_item.title;
  end if;
  if v_item.due_date is not null then
    raise exception 'prazo indatavel virou data no item avulso: %', v_item.due_date;
  end if;

  -- Resposta apagada e resposta conforme ficaram de fora.
  if exists (select 1 from public.client_action_items where source_item_id = 'item-apagado') then
    raise exception 'resposta apagada entrou na projecao';
  end if;
  if (
    select count(*) from public.client_action_items
    where appointment_request_id = '50000000-0000-4000-8000-000000000031'
  ) <> 3 then
    raise exception 'a projecao criou mais linhas do que ha NCs';
  end if;
end;
$$;

-- ─── Rodar de novo não duplica ────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_total integer;
begin
  v_result := public.admin_backfill_client_action_items(
    '50000000-0000-4000-8000-000000000031', false
  );
  if (v_result ->> 'created')::int <> 0 or (v_result ->> 'updated')::int <> 3 then
    raise exception 'o segundo backfill nao foi idempotente: %', v_result;
  end if;

  select count(*) into v_total
  from public.client_action_items
  where appointment_request_id = '50000000-0000-4000-8000-000000000031';
  if v_total <> 3 then
    raise exception 'o segundo backfill duplicou linhas: %', v_total;
  end if;
end;
$$;

-- ─── O cliente enxerga o que foi projetado ────────────────────────────────────
do $$
declare
  v_items jsonb;
begin
  v_items := public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items';

  if not exists (
    select 1 from jsonb_array_elements(v_items) item
    where item ->> 'title' = 'Possuir alvara sanitario vigente'
      and item ->> 'priority' = 'urgent'
  ) then
    raise exception 'a pendencia retroativa nao chegou ao portal do cliente: %', v_items;
  end if;

  -- O id do requisito continua sendo assunto interno.
  if exists (select 1 from jsonb_array_elements(v_items) item where item ? 'source_item_id') then
    raise exception 'o backfill vazou o id do requisito para o cliente';
  end if;
end;
$$;

\echo 'backfill_client_action_items.test.sql OK'
