-- SEC-01 (2 de 2) — tirar do papel `anon` o acesso às tabelas antigas.
--
-- 23 tabelas de `public` nasceram com SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
-- para `anon`, herdados do default privilege do Supabase. As tabelas criadas do P360-010 em
-- diante já nascem endurecidas, uma a uma.
--
-- Medido em 08/08/2026 com `set role anon`: leitura devolve 0 linhas, insert é negado com 42501.
-- Quem segura é o RLS, sozinho. O grant não acrescenta acesso — acrescenta o risco de uma policy
-- futura mal escrita virar vazamento em vez de erro.
--
-- ─── O mapeamento que autorizou o revoke ─────────────────────────────────────
--
-- Todo caminho alcançável sem sessão foi conferido, não presumido:
--   • páginas públicas são quatro — `/agendar` (PublicSchedule), `/portal/:token` e
--     `/cliente/visita/:token` (PublicAppointmentStatus) e `/cliente` (ClientPortal);
--   • os dois serviços que elas usam (`publicAppointmentService`, `clientPortalService`) só
--     fazem `supabase.rpc(...)` — zero `.from('<tabela>')`, e o mesmo vale para os componentes
--     de `components/client`, `components/portal` e `components/public`;
--   • as 21 RPCs com execute para `anon` são todas `security definer` de dono `postgres`, então
--     não dependem do grant da tabela;
--   • os arquivos que fazem `.from(...)` estão todos em serviços da área interna, e o único que
--     roda cedo (`authService.getCurrentTenant`) desiste antes da consulta quando não há sessão;
--   • os anexos do portal chegam ao cliente por URL assinada emitida pela edge function
--     `client-appointment-assets` com `service_role` — nenhuma edge function usa a chave `anon`.
--
-- ─── Duas policies de `anon` que morrem junto ────────────────────────────────
--
-- 1. `appointment_slots` tem policy de SELECT para `anon` (`is_public and status = 'available'`).
--    A tabela está com 0 linhas, o modelo atual é `appointment_blocks` +
--    `private.appointment_has_conflict`, e nenhuma página pública a consulta. Sem o grant a
--    policy não tem como ser exercida.
--
-- 2. `storage.objects` tem `client_portal_published_assets_select_anon`, que libera para `anon`
--    o objeto referenciado por uma linha de `appointment_attachments`. **Esta é a razão de a
--    policy ser derrubada aqui e não ficar para depois**: a expressão de uma policy roda com as
--    permissões de quem consulta — conferido em Postgres 16, `permission denied for table` —
--    então, sem o grant em `appointment_attachments`, ela deixa de devolver "nada" e passa a
--    devolver ERRO para qualquer leitura de `storage.objects` como `anon`. Deixá-la de pé seria
--    trocar uma porta que ninguém usa por uma armadilha. O caminho real do cliente continua
--    sendo a URL assinada da edge function, que não passa por RLS.
--
-- O que NÃO foi mexido, de propósito: o default privilege do schema `public` continua concedendo
-- para `anon` em tabela nova (está definido para `postgres` E para `supabase_admin`, e mexer nele
-- muda o comportamento de tudo que o Supabase criar daqui pra frente). A disciplina segue sendo a
-- de sempre: toda migration que cria tabela revoga explicitamente.
--
-- Autorizado pela Ester em 08/08/2026.

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'appointment_attachments',
    'appointment_blocked_dates',
    'appointment_requests',
    'appointment_slots',
    'checklist_items',
    'checklist_sections',
    'checklist_templates',
    'client_portal_account_clients',
    'client_portal_accounts',
    'client_portal_invoices',
    'clients',
    'inspection_report_versions',
    'inspections',
    'legislations',
    'photos',
    'profiles',
    'responses',
    'schedules',
    'sync_batches',
    'sync_jobs',
    'tenant_checklist_access',
    'tenant_users',
    'tenants'
  ]
  loop
    execute format('revoke all on table public.%I from anon', v_tabela);
  end loop;
end;
$$;

drop policy if exists "anon select public slots" on public.appointment_slots;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'client_portal_published_assets_select_anon'
  ) then
    execute 'drop policy "client_portal_published_assets_select_anon" on storage.objects';
  end if;
end;
$$;

-- `sync_inspection_bundle` é `security invoker` e tinha execute para `anon`. Sem os grants acima
-- ela só teria como falhar; `authenticated` mantém o execute, que é quem de fato sincroniza.
--
-- O `revoke ... from public` é obrigatório, e não zelo: o ACL em produção é
-- `{=X/postgres,postgres=X,anon=X,authenticated=X,service_role=X}` — o `=X` é o PUBLIC, e
-- enquanto ele estiver lá tirar de `anon` não muda nada, porque `anon` continua alcançando pelo
-- PUBLIC. Por isso os grants de `authenticated` e `service_role` são reafirmados logo em seguida:
-- os dois JÁ têm entrada própria no ACL, mas deixar isso implícito seria confiar no acaso.
do $$
declare
  v_func regprocedure;
begin
  for v_func in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_inspection_bundle'
  loop
    execute format('revoke execute on function %s from public', v_func);
    execute format('revoke execute on function %s from anon', v_func);
    execute format('grant execute on function %s to authenticated', v_func);
    execute format('grant execute on function %s to service_role', v_func);
  end loop;
end;
$$;
