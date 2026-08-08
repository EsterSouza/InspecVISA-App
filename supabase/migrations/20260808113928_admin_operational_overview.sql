-- P360-013 — Painel operacional das consultoras.
--
-- Até aqui a equipe descobria pendência vasculhando tela por tela: agenda (`schedules`),
-- solicitações (`client_service_requests`, P360-012), plano de ação (`client_action_items`,
-- P360-010) e evidência (`client_action_evidence`, P360-011) não tinham nenhum ponto de
-- agregação. Esta migration não cria tabela nova — só soma, no servidor, o que já existe.
--
-- Duas RPCs, com papéis diferentes de propósito:
--
-- 1. `admin_operational_counts` — só contagem, uma chamada, todos os seis blocos. É o que
--    alimenta os números do topo do painel a cada troca de filtro, sem tocar em anexo nem em
--    resposta de checklist (critério de aceite do card).
-- 2. `admin_operational_items` — a lista paginada de UM bloco por vez, carregada só quando a
--    consultora expande aquele bloco.
--
-- **Indisponibilidade parcial por módulo, feita no servidor**: `admin_operational_counts` é
-- `plpgsql`, e cada bloco vive dentro do seu próprio `begin/exception`. Se um bloco quebrar
-- (índice ausente, tipo mudou, o que for), os outros cinco continuam voltando normalmente — o
-- bloco quebrado só marca `{"error": true}`. Sem isso, um bug em "financeiro" apagaria a tela
-- inteira da consultora no meio do dia.
--
-- **Consultora é texto livre, nunca `user_id`** — mesma regra do P360-012 (`assigned_to`) e do
-- P360-010 (`responsible`): comparação por nome normalizado (`lower(btrim(...))`), nunca por FK.
-- `client_action_evidence` não tem coluna de consultora própria — o filtro passa pelo
-- `client_action_items.responsible` do item pai. `client_portal_accounts` (financeiro) não tem
-- consultora confiável — o filtro de consultora simplesmente não se aplica a esse bloco.
--
-- **Sem `p_tenant_id`**: assim como `client_action_items`/`client_service_requests`, o escopo
-- vem de `private.my_tenant_ids()` + `private.is_tenant_staff(tenant_id)` — o mesmo padrão de
-- toda leitura de staff nesta base. Pedir o tenant por fora seria só mais uma chance de vazar
-- dado de outro tenant se o front esquecer de passar certo.

-- ─── Índice de apoio ────────────────────────────────────────────────────────────
--
-- `client_action_items_client_idx` já cobre (client_id, status, due_date); o painel filtra por
-- tenant primeiro (todas as consultoras, todos os clientes) — vale um índice líder por tenant.

create index if not exists client_action_items_tenant_status_due_idx
  on public.client_action_items (tenant_id, status, due_date);

create index if not exists schedules_tenant_scheduled_idx
  on public.schedules (tenant_id, scheduled_at);

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

  -- Evidências aguardando revisão
  begin
    select count(*) into v_count
    from public.client_action_evidence e
    join public.client_action_items i on i.id = e.action_item_id
    where e.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(e.tenant_id)
      and e.status = 'pending'
      and (p_client_id is null or e.client_id = p_client_id)
      and (v_consultant is null or lower(btrim(coalesce(i.responsible, ''))) = v_consultant);
    v_result := jsonb_set(v_result, array['evidence_pending'], jsonb_build_object('count', v_count), true);
  exception when others then
    v_result := jsonb_set(v_result, array['evidence_pending'], jsonb_build_object('error', true), true);
  end;

  -- Planos de ação vencidos (mesma regra de public.client_portal_action_items)
  begin
    select count(*) into v_count
    from public.client_action_items i
    where i.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(i.tenant_id)
      and i.status = 'published'
      and i.due_date is not null
      and i.due_date < v_today
      and (p_client_id is null or i.client_id = p_client_id)
      and (v_consultant is null or lower(btrim(coalesce(i.responsible, ''))) = v_consultant);
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
    where e.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(e.tenant_id)
      and e.status = 'pending'
      and (p_client_id is null or e.client_id = p_client_id)
      and (p_due_before is null or e.submitted_at::date <= p_due_before)
      and (v_consultant is null or lower(btrim(coalesce(i.responsible, ''))) = v_consultant);

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
    from (
      select e.id, e.client_id, c.name as client_name, i.title, e.action_item_id,
             i.responsible, e.submitted_at as due_at, e.file_name
      from public.client_action_evidence e
      join public.client_action_items i on i.id = e.action_item_id
      join public.clients c on c.id = e.client_id
      where e.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(e.tenant_id)
        and e.status = 'pending'
        and (p_client_id is null or e.client_id = p_client_id)
        and (p_due_before is null or e.submitted_at::date <= p_due_before)
        and (v_consultant is null or lower(btrim(coalesce(i.responsible, ''))) = v_consultant)
      order by e.submitted_at asc
      limit v_limit offset v_offset
    ) t;

  elsif p_block = 'action_items_overdue' then
    select count(*) into v_total
    from public.client_action_items i
    where i.tenant_id in (select private.my_tenant_ids())
      and private.is_tenant_staff(i.tenant_id)
      and i.status = 'published'
      and i.due_date is not null
      and i.due_date < v_today
      and (p_client_id is null or i.client_id = p_client_id)
      and (v_type is null or lower(i.priority) = v_type)
      and (p_due_before is null or i.due_date <= p_due_before)
      and (v_consultant is null or lower(btrim(coalesce(i.responsible, ''))) = v_consultant);

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
    from (
      select i.id, i.client_id, c.name as client_name, i.title,
             i.priority as type, i.due_date as due_at, i.responsible
      from public.client_action_items i
      join public.clients c on c.id = i.client_id
      where i.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(i.tenant_id)
        and i.status = 'published'
        and i.due_date is not null
        and i.due_date < v_today
        and (p_client_id is null or i.client_id = p_client_id)
        and (v_type is null or lower(i.priority) = v_type)
        and (p_due_before is null or i.due_date <= p_due_before)
        and (v_consultant is null or lower(btrim(coalesce(i.responsible, ''))) = v_consultant)
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
