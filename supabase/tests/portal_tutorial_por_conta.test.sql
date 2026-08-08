-- PORT-04 — tutorial por conta do portal, com o do tenant como padrão.
--
-- Continua de onde o PORT-01 para: aquela suíte já criou contas, unidades, visitas, anexos e as
-- travas, e já provou o comportamento do `client_portal_overview` de hoje.
--
-- Esta migration REESCREVE o `client_portal_overview` inteiro (o `create or replace` não aceita
-- remendo), então metade desta suíte não é sobre tutorial nenhum: é repetir as asserções do
-- PORT-01 **depois** da reescrita. Um campo trocado de lugar na transcrição — o risco real de
-- copiar uma função de 130 linhas — cai aqui, não em produção.

\set ON_ERROR_STOP on

\ir portal_feature_gates.test.sql

-- O fixture do PORT-01 não tem as colunas de credencial da conta, que a RPC grava junto.
alter table public.client_portal_accounts add column if not exists email text;
alter table public.client_portal_accounts add column if not exists username text;
update public.client_portal_accounts
set email = 'conta-' || left(id::text, 8) || '@exemplo.com'
where email is null;

-- Estado conhecido antes de começar: a conta do fixture não tem tutorial próprio, e o tenant
-- tem um. As travas do PORT-01 ficaram todas liberadas no fim daquela suíte.
update public.client_portal_settings
set tutorial_pdf_url = 'https://exemplo.com/tutorial-do-tenant.pdf',
    action_plan_enabled = true,
    service_requests_enabled = false
where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

\ir ../migrations/20260808191341_portal_tutorial_por_conta.sql

-- ─── Nada do PORT-01 pode ter mudado ──────────────────────────────────────────
--
-- Mesmas perguntas da suíte anterior, agora contra a função reescrita.
do $$
declare
  v_overview jsonb;
  v_visit jsonb;
begin
  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  v_visit := public.test_visit('20000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002');

  if (v_visit ->> 'report_count')::int <> 1
     or (v_visit ->> 'photo_count')::int <> 1
     or (v_visit ->> 'attachment_count')::int <> 1
     or (v_visit ->> 'compliance_score')::int <> 72 then
    raise exception 'a reescrita do overview mexeu no que a visita mostra: %', v_visit;
  end if;

  if jsonb_array_length(v_overview -> 'units') = 0 then
    raise exception 'a reescrita do overview perdeu as unidades da conta';
  end if;

  if v_overview -> 'feature_gates' is null
     or not (v_overview -> 'feature_gates' ->> 'reports')::boolean then
    raise exception 'a reescrita do overview perdeu as travas: %', v_overview -> 'feature_gates';
  end if;

  if v_overview -> 'payment' ->> 'status' is null then
    raise exception 'a reescrita do overview perdeu o bloco de pagamento';
  end if;

  if v_overview ->> 'account_name' is null or v_overview ->> 'main_drive_folder_url' is distinct from
     (select main_drive_folder_url from public.client_portal_accounts
      where id = '20000000-0000-4000-8000-000000000002') then
    raise exception 'a reescrita do overview perdeu dado da conta';
  end if;
end;
$$;

-- ─── Os dois campos que trocariam de lugar sem ninguém ver ────────────────────
--
-- `action_plan_enabled` e `service_requests_enabled` saem lado a lado do mesmo `select ... into`.
-- Se a ordem sair trocada, o portal liga a função errada — e nenhum outro teste percebe, porque
-- as duas são booleanas. Aqui elas são checadas com valores DIFERENTES, e depois invertidas.
do $$
declare
  v_overview jsonb;
begin
  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  if not (v_overview ->> 'action_plan_enabled')::boolean then
    raise exception 'action_plan_enabled voltou falso com a configuracao ligada';
  end if;
  if (v_overview ->> 'service_requests_enabled')::boolean then
    raise exception 'service_requests_enabled voltou verdadeiro com a configuracao desligada';
  end if;

  update public.client_portal_settings
  set action_plan_enabled = false, service_requests_enabled = true
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  if (v_overview ->> 'action_plan_enabled')::boolean then
    raise exception 'action_plan_enabled ficou preso no valor anterior';
  end if;
  if not (v_overview ->> 'service_requests_enabled')::boolean then
    raise exception 'service_requests_enabled ficou preso no valor anterior';
  end if;

  update public.client_portal_settings
  set action_plan_enabled = true, service_requests_enabled = false
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
end;
$$;

-- ─── A herança: conta sem tutorial cai no do tenant ───────────────────────────
do $$
declare
  v_overview jsonb;
begin
  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  if v_overview ->> 'tutorial_pdf_url' is distinct from 'https://exemplo.com/tutorial-do-tenant.pdf' then
    raise exception 'conta sem tutorial proprio nao caiu no padrao do tenant: %',
      v_overview ->> 'tutorial_pdf_url';
  end if;
end;
$$;

-- ─── Com tutorial próprio, o da conta ganha ───────────────────────────────────
do $$
declare
  v_overview jsonb;
begin
  perform public.admin_update_client_portal_account_configuration(
    '20000000-0000-4000-8000-000000000002',
    'conta-20000000@exemplo.com',
    null,
    null,
    'https://exemplo.com/tutorial-da-rede-senior.pdf'
  );

  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  if v_overview ->> 'tutorial_pdf_url' is distinct from 'https://exemplo.com/tutorial-da-rede-senior.pdf' then
    raise exception 'o tutorial da conta nao ganhou do padrao do tenant: %',
      v_overview ->> 'tutorial_pdf_url';
  end if;
end;
$$;

-- ─── Sem padrão no tenant, a conta continua com o dela ────────────────────────
do $$
declare
  v_overview jsonb;
begin
  update public.client_portal_settings set tutorial_pdf_url = null
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  if v_overview ->> 'tutorial_pdf_url' is distinct from 'https://exemplo.com/tutorial-da-rede-senior.pdf' then
    raise exception 'tenant sem padrao apagou o tutorial da conta: %', v_overview ->> 'tutorial_pdf_url';
  end if;

  update public.client_portal_settings
  set tutorial_pdf_url = 'https://exemplo.com/tutorial-do-tenant.pdf'
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
end;
$$;

-- ─── Limpar o campo devolve a conta ao padrão ─────────────────────────────────
do $$
declare
  v_overview jsonb;
begin
  perform public.admin_update_client_portal_account_configuration(
    '20000000-0000-4000-8000-000000000002',
    'conta-20000000@exemplo.com',
    null, null, '   '
  );

  if (select tutorial_pdf_url from public.client_portal_accounts
      where id = '20000000-0000-4000-8000-000000000002') is not null then
    raise exception 'campo em branco virou string vazia em vez de nulo';
  end if;

  v_overview := public.client_portal_overview('20000000-0000-4000-8000-000000000003');
  if v_overview ->> 'tutorial_pdf_url' is distinct from 'https://exemplo.com/tutorial-do-tenant.pdf' then
    raise exception 'limpar o tutorial da conta nao devolveu o padrao: %', v_overview ->> 'tutorial_pdf_url';
  end if;
end;
$$;

-- ─── Link inseguro é recusado, no banco e na RPC ──────────────────────────────
do $$
declare
  v_erro text := 'nenhum';
begin
  begin
    perform public.admin_update_client_portal_account_configuration(
      '20000000-0000-4000-8000-000000000002',
      (select email from public.client_portal_accounts where id = '20000000-0000-4000-8000-000000000002'),
      null, null, 'http://exemplo.com/tutorial.pdf'
    );
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro not like '%HTTPS%' then
    raise exception 'a RPC aceitou tutorial em http: %', v_erro;
  end if;

  v_erro := 'nenhum';
  begin
    update public.client_portal_accounts set tutorial_pdf_url = 'http://exemplo.com/direto.pdf'
    where id = '20000000-0000-4000-8000-000000000002';
  exception when check_violation then
    v_erro := 'check';
  end;
  if v_erro <> 'check' then
    raise exception 'a constraint do banco deixou passar http';
  end if;
end;
$$;

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege(
    'anon',
    'public.admin_update_client_portal_account_configuration(uuid,text,text,text,text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon executa a RPC de staff que grava o tutorial';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.admin_update_client_portal_account_configuration(uuid,text,text,text,text)'::regprocedure,
    'execute'
  ) then
    raise exception 'a consultora perdeu o acesso a RPC que grava o tutorial';
  end if;
end;
$$;

-- ─── Tenant cruzado ───────────────────────────────────────────────────────────
do $$
declare
  v_erro text := 'nenhum';
begin
  begin
    perform public.admin_update_client_portal_account_configuration(
      '20000000-0000-4000-8000-000000000022', 'vizinho@exemplo.com', null, null,
      'https://exemplo.com/invasao.pdf'
    );
  exception when others then
    v_erro := sqlerrm;
  end;
  if v_erro is distinct from 'sem permissao' then
    raise exception 'staff de um tenant gravou tutorial na conta do vizinho: %', v_erro;
  end if;
end;
$$;

\echo 'portal_tutorial_por_conta.test.sql OK'
