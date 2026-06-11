-- ============================================================
-- 022_security_hardening_anon_surface.sql
-- Reduz a superfície exposta ao papel anon (visitante sem login).
-- RLS já está ligado em todas as tabelas e os dados pessoais (clientes,
-- inspeções, fotos, perfis) não têm política anon — este passo fecha
-- portas desnecessárias (defesa em profundidade) e protege IP/roteiros.
-- ============================================================

-- 1. Inserção direta anônima em appointment_requests removida.
--    A criação pública passa só pela RPC validada (anti-spam, fuso, conflito).
drop policy if exists "anon insert request" on public.appointment_requests;

-- 2. Funções administrativas/internas não devem ser chamáveis por anon.
--    (Elas já se autoprotegem com is_tenant_staff, mas removemos o grant.)
revoke execute on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[]) from anon;
revoke execute on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[], text) from anon;
revoke execute on function public.admin_set_portal_access_code(uuid, text) from anon;
revoke execute on function public.admin_regenerate_client_portal_token(uuid) from anon;
revoke execute on function public.is_tenant_admin(uuid) from anon;
revoke execute on function public.is_tenant_staff(uuid) from anon;
revoke execute on function public.my_tenant_ids() from anon;

-- 3. Funções de trigger/event-trigger fora da superfície da API.
revoke execute on function public.notify_new_appointment() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- 4. Funções públicas legadas que não passam pelas validações novas.
drop function if exists public.public_create_appointment_request(jsonb);
drop function if exists public.public_list_available_slots(uuid);

-- 5. Roteiros e legislações deixam de ser legíveis por anônimos
--    (continuam legíveis pela equipe logada via *_authenticated_read).
drop policy if exists "Permitir leitura para todos" on public.checklist_templates;
drop policy if exists "Permitir leitura para todos" on public.checklist_sections;
drop policy if exists "Permitir leitura para todos" on public.checklist_items;
drop policy if exists "Permitir leitura para todos" on public.legislations;

-- 6. Corrige search_path mutável.
alter function public.update_updated_at_column() set search_path = public;
