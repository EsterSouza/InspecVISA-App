-- PROD-01 — correção aplicada logo depois de `20260805010139`.
--
-- O Supabase concede `all` por padrão em tabela nova do schema `public` para `anon` e
-- `authenticated`, e o `grant select` da migration anterior não reduzia isso: em produção o papel
-- `authenticated` ficou com insert, update e delete na trilha de auditoria. A RLS já barrava (só
-- existe policy de `select`), mas o privilégio de tabela precisa ser revogado explicitamente para a
-- trilha ser append-only também nesse nível. O teste em Postgres limpo não pegou porque lá não
-- existem os default privileges do Supabase.
--
-- O arquivo `20260805010139` já traz este bloco no conteúdo final; ele fica repetido aqui para o
-- repositório espelhar as duas versões que constam no ledger remoto. É idempotente.

revoke all on table public.client_portal_audit_events from public;
revoke all on table public.client_portal_audit_events from anon;
revoke all on table public.client_portal_audit_events from authenticated;
grant select on table public.client_portal_audit_events to authenticated;
