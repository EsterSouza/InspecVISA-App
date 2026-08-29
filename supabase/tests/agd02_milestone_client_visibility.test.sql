\set ON_ERROR_STOP on

-- ============================================================================
-- AGD-02b — o portal só vê o marco marcado como visível.
-- Migrations: supabase/migrations/20260829093956_agd02_client_milestones.sql
--             supabase/migrations/20260829160000_agd02_milestone_visible_to_client.sql
--             supabase/migrations/20260829161000_agd02_milestone_client_overview.sql
--
-- Encadeia no fixture mais próximo do que este card toca de fato: `client_portal_overview` é
-- redefinida em `portal_service_dates.test.sql` (fixture próprio, não a cadeia PORT-*), e é
-- exatamente essa função que ganha a chave `milestones` aqui.
-- ============================================================================

\ir portal_service_dates.test.sql

-- `portal_service_dates.test.sql` já cria o schema `private` (para `portal_account_gates`), mas
-- não precisa de RLS por staff (só testa a RPC pública) — não define os dois helpers de tenant.
-- A migration de `client_milestones` referencia os dois na policy — precisam existir antes de
-- rodar.
create function private.my_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

create function private.is_tenant_staff(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select p_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

grant usage on schema private to authenticated;
grant execute on function private.my_tenant_ids() to authenticated;
grant execute on function private.is_tenant_staff(uuid) to authenticated;

\ir ../migrations/20260829093956_agd02_client_milestones.sql
\ir ../migrations/20260829160000_agd02_milestone_visible_to_client.sql
\ir ../migrations/20260829161000_agd02_milestone_client_overview.sql

-- Unidade A ('10000000-0000-4000-8000-000000000003') já existe no fixture do PORT service dates,
-- na conta de portal_token '10000000-0000-4000-8000-000000000002'.
insert into public.client_milestones (tenant_id, client_id, title, note, milestone_date, visible_to_client)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000003',
   'Obra na area externa', 'Acesso pela lateral no dia.', '2026-08-22', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000003',
   'Cobrar renovacao de contrato', null, '2026-08-23', false);

do $$
declare
  v_overview jsonb;
  v_milestones jsonb;
begin
  v_overview := public.client_portal_overview('10000000-0000-4000-8000-000000000002');
  v_milestones := v_overview #> '{units,0,milestones}';

  if jsonb_array_length(v_milestones) <> 1 then
    raise exception 'o portal viu %s marco(s), esperava so o visivel: %', jsonb_array_length(v_milestones), v_milestones;
  end if;

  if v_milestones -> 0 ->> 'title' <> 'Obra na area externa' then
    raise exception 'o portal viu o marco errado: %', v_milestones;
  end if;
  if v_milestones -> 0 ->> 'note' <> 'Acesso pela lateral no dia.' then
    raise exception 'a nota do marco nao chegou ao portal: %', v_milestones;
  end if;
  if v_milestones -> 0 ->> 'milestone_date' <> '2026-08-22' then
    raise exception 'a data do marco nao chegou ao portal: %', v_milestones;
  end if;
  if (v_milestones -> 0 ? 'done_at') is not true then
    raise exception 'o campo done_at nao veio no marco do portal: %', v_milestones;
  end if;

  -- O marco interno (visible_to_client = false) não aparece em lugar nenhum do array.
  if exists (
    select 1 from jsonb_array_elements(v_milestones) as m
    where m ->> 'title' = 'Cobrar renovacao de contrato'
  ) then
    raise exception 'marco interno vazou para o portal: %', v_milestones;
  end if;
end;
$$;

-- ─── Ligar a visibilidade depois não é permanente: reflete o último valor mandado ──
do $$
declare
  v_id uuid;
  v_overview jsonb;
begin
  select id into v_id from public.client_milestones where title = 'Cobrar renovacao de contrato';

  perform public.admin_update_client_milestone(v_id, 'Cobrar renovacao de contrato', '2026-08-23', null, true);
  v_overview := public.client_portal_overview('10000000-0000-4000-8000-000000000002');
  if jsonb_array_length(v_overview #> '{units,0,milestones}') <> 2 then
    raise exception 'ligar a visibilidade nao fez o marco aparecer: %', v_overview;
  end if;

  perform public.admin_update_client_milestone(v_id, 'Cobrar renovacao de contrato', '2026-08-23', null, false);
  v_overview := public.client_portal_overview('10000000-0000-4000-8000-000000000002');
  if jsonb_array_length(v_overview #> '{units,0,milestones}') <> 1 then
    raise exception 'desligar a visibilidade nao escondeu o marco de novo: %', v_overview;
  end if;
end;
$$;

select 'AGD-02b milestone client visibility tests passed' as result;
