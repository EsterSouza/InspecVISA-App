-- Correção do Painel operacional (bugs #1 e #2, catalogados como "fora de escopo" no HANDOFF-FRONTEND).
--
-- Bug #1 — filtro de consultora zerava planos de ação e evidências. Os blocos filtravam por
-- `client_action_items.responsible`, mas essa coluna guarda SETOR ("Gerência / Administração",
-- "Responsável Técnico (RT)"...), nunca o nome da consultora. Prova em produção: nenhuma das 14
-- grafias distintas de `responsible` é nome de consultora. A atribuição real vive em
-- `inspections.consultant_names` e `appointment_requests.consultant_names` (ambas ARRAY). Passa a
-- filtrar por elas — mesma regra "por consultant_name, nunca por setor nem user_id".
--
-- Bug #2 — o Painel contava item que o cliente não vê. A RPC do cliente
-- (`client_portal_action_items`) exclui em tempo real todo item de relatório oculto
-- (`appointment_requests.report_hidden = true`); o Painel não fazia esse join. Um relatório
-- ocultado depois da projeção sumia para o cliente mas seguia contando aqui. Passa a espelhar o
-- join (`client_action_items.appointment_request_id` já existe e tem índice).
--
-- Ambos os consertos entram com um único par de joins (appointment_requests + inspections) nos
-- blocos `evidence_pending` e `action_items_overdue` das duas funções. `create or replace` — sem
-- tabela nova, sem alterar assinatura. Só estes dois blocos mudam; os outros quatro são idênticos.

-- ─── Contagens ────────────────────────────────────────────────────────────────

create or replace function public.admin_operational_counts(
  p_consultant_name text default null,
  p_client_id uuid default null,
  p_days_ahead integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_consultant text := nullif(btrim(lower(coalesce(p_consultant_name, ''))), '');
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_result jsonb := '{}'::jsonb;
  v_count integer;
begin
  -- Compromissos próximos
  begin
    select count(*) into v_count
    from public.schedules s
    where s.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(s.tenant_id)
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and s.scheduled_at >= now()
      and s.scheduled_at < now() + make_interval(days => coalesce(p_days_ahead, 14))
      and (p_client_id is null or s.client_id = p_client_id)
      and (
        v_consultant is null
        or exists (select 1 from unnest(coalesce(s.consultant_names, '{}'::text[])) cn where lower(btrim(cn)) = v_consultant)
      );
    v_result := jsonb_set(v_result, array['appointments'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['appointments'], jsonb_build_object('error', true), true);
  end;

  -- Solicitações novas (ninguém assumiu ainda)
  begin
    select count(*) into v_count
    from public.client_service_requests r
    where r.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(r.tenant_id)
      and r.status = 'open'
      and (p_client_id is null or r.client_id = p_client_id)
      and (v_consultant is null or lower(btrim(coalesce(r.assigned_to, ''))) = v_consultant);
    v_result := jsonb_set(v_result, array['requests_new'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['requests_new'], jsonb_build_object('error', true), true);
  end;

  -- Clientes aguardando resposta (a bola está com o cliente)
  begin
    select count(*) into v_count
    from public.client_service_requests r
    where r.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(r.tenant_id)
      and r.status = 'awaiting_client'
      and (p_client_id is null or r.client_id = p_client_id)
      and (v_consultant is null or lower(btrim(coalesce(r.assigned_to, ''))) = v_consultant);
    v_result := jsonb_set(v_result, array['awaiting_client'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['awaiting_client'], jsonb_build_object('error', true), true);
  end;

  -- Evidências aguardando revisão (bug #1: consultora do item pai; bug #2: sem relatório oculto)
  begin
    select count(*) into v_count
    from public.client_action_evidence e
    join public.client_action_items i on i.id = e.action_item_id
    left join public.appointment_requests ar on ar.id = i.appointment_request_id
    left join public.inspections ins on ins.id = i.inspection_id
    where e.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(e.tenant_id)
      and e.status = 'pending'
      and coalesce(ar.report_hidden, false) = false
      and (p_client_id is null or e.client_id = p_client_id)
      and (
        v_consultant is null
        or exists (
          select 1 from unnest(coalesce(ins.consultant_names, '{}'::text[]) || coalesce(ar.consultant_names, '{}'::text[])) cn
          where lower(btrim(cn)) = v_consultant
        )
      );
    v_result := jsonb_set(v_result, array['evidence_pending'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['evidence_pending'], jsonb_build_object('error', true), true);
  end;

  -- Planos de ação vencidos (bug #1: consultora da inspeção; bug #2: sem relatório oculto)
  begin
    select count(*) into v_count
    from public.client_action_items i
    left join public.appointment_requests ar on ar.id = i.appointment_request_id
    left join public.inspections ins on ins.id = i.inspection_id
    where i.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(i.tenant_id)
      and i.status = 'published'
      and i.due_date is not null
      and i.due_date < v_today
      and coalesce(ar.report_hidden, false) = false
      and (p_client_id is null or i.client_id = p_client_id)
      and (
        v_consultant is null
        or exists (
          select 1 from unnest(coalesce(ins.consultant_names, '{}'::text[]) || coalesce(ar.consultant_names, '{}'::text[])) cn
          where lower(btrim(cn)) = v_consultant
        )
      );
    v_result := jsonb_set(v_result, array['action_items_overdue'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['action_items_overdue'], jsonb_build_object('error', true), true);
  end;

  -- Pendências financeiras (mesma regra de atraso de public.client_portal_account_features_state)
  begin
    select count(*) into v_count
    from public.client_portal_accounts a
    left join public.client_portal_settings st on st.tenant_id = a.tenant_id
    where a.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(a.tenant_id)
      and coalesce(a.payment_status, 'pending') <> 'paid'
      and a.payment_due_date is not null
      and v_today > a.payment_due_date + coalesce(st.overdue_grace_days, 5)
      and (
        p_client_id is null
        or exists (
          select 1 from public.client_portal_account_clients ac
          where ac.account_id = a.id and ac.client_id = p_client_id
        )
      );
    v_result := jsonb_set(v_result, array['financial_pending'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['financial_pending'], jsonb_build_object('error', true), true);
  end;

  return v_result;
end;
$function$;

revoke all on function public.admin_operational_counts(text, uuid, integer) from public;
revoke all on function public.admin_operational_counts(text, uuid, integer) from anon;
grant execute on function public.admin_operational_counts(text, uuid, integer) to authenticated;

-- ─── Itens de um bloco, paginados ───────────────────────────────────────────────

create or replace function public.admin_operational_items(
  p_block text,
  p_consultant_name text default null,
  p_client_id uuid default null,
  p_type text default null,
  p_due_before date default null,
  p_days_ahead integer default 14,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_consultant text := nullif(btrim(lower(coalesce(p_consultant_name, ''))), '');
  v_type text := nullif(btrim(lower(coalesce(p_type, ''))), '');
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_items jsonb;
  v_total integer;
begin
  if p_block = 'appointments' then
    select count(*) into v_total
    from public.schedules s
    where s.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(s.tenant_id)
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and s.scheduled_at >= now()
      and s.scheduled_at < now() + make_interval(days => coalesce(p_days_ahead, 14))
      and (p_client_id is null or s.client_id = p_client_id)
      and (v_type is null or lower(coalesce(s.appointment_type, '')) = v_type)
      and (p_due_before is null or s.scheduled_at::date <= p_due_before)
      and (
        v_consultant is null
        or exists (select 1 from unnest(coalesce(s.consultant_names, '{}'::text[])) cn where lower(btrim(cn)) = v_consultant)
      );

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
    from (
      select s.id, s.client_id, c.name as client_name, s.subject as title,
             s.appointment_type as type, s.scheduled_at as due_at, s.consultant_names
      from public.schedules s
      join public.clients c on c.id = s.client_id
      where s.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(s.tenant_id)
        and s.deleted_at is null
        and s.status <> 'cancelled'
        and s.scheduled_at >= now()
        and s.scheduled_at < now() + make_interval(days => coalesce(p_days_ahead, 14))
        and (p_client_id is null or s.client_id = p_client_id)
        and (v_type is null or lower(coalesce(s.appointment_type, '')) = v_type)
        and (p_due_before is null or s.scheduled_at::date <= p_due_before)
        and (
          v_consultant is null
          or exists (select 1 from unnest(coalesce(s.consultant_names, '{}'::text[])) cn where lower(btrim(cn)) = v_consultant)
        )
      order by s.scheduled_at asc
      limit v_limit offset v_offset
    ) t;

  elsif p_block = 'requests_new' or p_block = 'awaiting_client' then
    declare
      v_status text := case p_block when 'requests_new' then 'open' else 'awaiting_client' end;
    begin
      select count(*) into v_total
      from public.client_service_requests r
      where r.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(r.tenant_id)
        and r.status = v_status
        and (p_client_id is null or r.client_id = p_client_id)
        and (v_type is null or lower(r.category) = v_type)
        and (p_due_before is null or r.sla_hint_date <= p_due_before)
        and (v_consultant is null or lower(btrim(coalesce(r.assigned_to, ''))) = v_consultant);

      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
      from (
        select r.id, r.client_id, c.name as client_name, r.subject as title,
               r.category as type, r.sla_hint_date as due_at, r.priority, r.assigned_to,
               r.request_number, r.last_event_at
        from public.client_service_requests r
        join public.clients c on c.id = r.client_id
        where r.tenant_id in (select private.my_tenant_ids())
          and private.is_tenant_staff(r.tenant_id)
          and r.status = v_status
          and (p_client_id is null or r.client_id = p_client_id)
          and (v_type is null or lower(r.category) = v_type)
          and (p_due_before is null or r.sla_hint_date <= p_due_before)
          and (v_consultant is null or lower(btrim(coalesce(r.assigned_to, ''))) = v_consultant)
        order by r.last_event_at desc
        limit v_limit offset v_offset
      ) t;
    end;

  elsif p_block = 'evidence_pending' then
    select count(*) into v_total
    from public.client_action_evidence e
    join public.client_action_items i on i.id = e.action_item_id
    left join public.appointment_requests ar on ar.id = i.appointment_request_id
    left join public.inspections ins on ins.id = i.inspection_id
    where e.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(e.tenant_id)
      and e.status = 'pending'
      and coalesce(ar.report_hidden, false) = false
      and (p_client_id is null or e.client_id = p_client_id)
      and (p_due_before is null or e.submitted_at::date <= p_due_before)
      and (
        v_consultant is null
        or exists (
          select 1 from unnest(coalesce(ins.consultant_names, '{}'::text[]) || coalesce(ar.consultant_names, '{}'::text[])) cn
          where lower(btrim(cn)) = v_consultant
        )
      );

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
    from (
      select e.id, e.client_id, c.name as client_name, i.title, e.action_item_id,
             i.responsible, e.submitted_at as due_at, e.file_name
      from public.client_action_evidence e
      join public.client_action_items i on i.id = e.action_item_id
      join public.clients c on c.id = e.client_id
      left join public.appointment_requests ar on ar.id = i.appointment_request_id
      left join public.inspections ins on ins.id = i.inspection_id
      where e.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(e.tenant_id)
        and e.status = 'pending'
        and coalesce(ar.report_hidden, false) = false
        and (p_client_id is null or e.client_id = p_client_id)
        and (p_due_before is null or e.submitted_at::date <= p_due_before)
        and (
          v_consultant is null
          or exists (
            select 1 from unnest(coalesce(ins.consultant_names, '{}'::text[]) || coalesce(ar.consultant_names, '{}'::text[])) cn
            where lower(btrim(cn)) = v_consultant
          )
        )
      order by e.submitted_at asc
      limit v_limit offset v_offset
    ) t;

  elsif p_block = 'action_items_overdue' then
    select count(*) into v_total
    from public.client_action_items i
    left join public.appointment_requests ar on ar.id = i.appointment_request_id
    left join public.inspections ins on ins.id = i.inspection_id
    where i.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(i.tenant_id)
      and i.status = 'published'
      and i.due_date is not null
      and i.due_date < v_today
      and coalesce(ar.report_hidden, false) = false
      and (p_client_id is null or i.client_id = p_client_id)
      and (v_type is null or lower(i.priority) = v_type)
      and (p_due_before is null or i.due_date <= p_due_before)
      and (
        v_consultant is null
        or exists (
          select 1 from unnest(coalesce(ins.consultant_names, '{}'::text[]) || coalesce(ar.consultant_names, '{}'::text[])) cn
          where lower(btrim(cn)) = v_consultant
        )
      );

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
    from (
      select i.id, i.client_id, c.name as client_name, i.title,
             i.priority as type, i.due_date as due_at, i.responsible
      from public.client_action_items i
      join public.clients c on c.id = i.client_id
      left join public.appointment_requests ar on ar.id = i.appointment_request_id
      left join public.inspections ins on ins.id = i.inspection_id
      where i.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(i.tenant_id)
        and i.status = 'published'
        and i.due_date is not null
        and i.due_date < v_today
        and coalesce(ar.report_hidden, false) = false
        and (p_client_id is null or i.client_id = p_client_id)
        and (v_type is null or lower(i.priority) = v_type)
        and (p_due_before is null or i.due_date <= p_due_before)
        and (
          v_consultant is null
          or exists (
            select 1 from unnest(coalesce(ins.consultant_names, '{}'::text[]) || coalesce(ar.consultant_names, '{}'::text[])) cn
            where lower(btrim(cn)) = v_consultant
          )
        )
      order by i.due_date asc
      limit v_limit offset v_offset
    ) t;

  elsif p_block = 'financial_pending' then
    select count(*) into v_total
    from public.client_portal_accounts a
    left join public.client_portal_settings st on st.tenant_id = a.tenant_id
    where a.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(a.tenant_id)
      and coalesce(a.payment_status, 'pending') <> 'paid'
      and a.payment_due_date is not null
      and v_today > a.payment_due_date + coalesce(st.overdue_grace_days, 5)
      and (
        p_client_id is null
        or exists (select 1 from public.client_portal_account_clients ac where ac.account_id = a.id and ac.client_id = p_client_id)
      );

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
    from (
      select a.id, a.name as account_name, a.payment_status, a.payment_due_date as due_at,
             coalesce(
               (select jsonb_agg(c.name order by c.name)
                from public.client_portal_account_clients ac
                join public.clients c on c.id = ac.client_id
                where ac.account_id = a.id),
               '[]'::jsonb
             ) as client_names
      from public.client_portal_accounts a
      left join public.client_portal_settings st on st.tenant_id = a.tenant_id
      where a.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(a.tenant_id)
        and coalesce(a.payment_status, 'pending') <> 'paid'
        and a.payment_due_date is not null
        and v_today > a.payment_due_date + coalesce(st.overdue_grace_days, 5)
        and (
          p_client_id is null
          or exists (select 1 from public.client_portal_account_clients ac where ac.account_id = a.id and ac.client_id = p_client_id)
        )
      order by a.payment_due_date asc
      limit v_limit offset v_offset
    ) t;

  else
    return jsonb_build_object('error', 'bloco invalido');
  end if;

  return jsonb_build_object('items', v_items, 'total_count', v_total);
end;
$function$;

revoke all on function public.admin_operational_items(text, text, uuid, text, date, integer, integer, integer) from public;
revoke all on function public.admin_operational_items(text, text, uuid, text, date, integer, integer, integer) from anon;
grant execute on function public.admin_operational_items(text, text, uuid, text, date, integer, integer, integer) to authenticated;
