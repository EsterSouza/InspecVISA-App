-- ============================================================
-- 020_harden_legacy_rls_policies.sql
-- Remove politicas RLS permissivas legadas que sobreviveram a 017:
--  - "Permitir escrita para autenticados" (auth.role()='authenticated')
--    em roteiros/legislacoes anulava a restricao por tenant (OR de policies).
--  - profiles tinha leitura aberta (USING true) expondo nome/COREN/telefone
--    de todos os consultores a qualquer autenticado (LGPD).
-- ============================================================

drop policy if exists "Permitir escrita para autenticados" on public.checklist_templates;
drop policy if exists "Permitir escrita para autenticados" on public.checklist_sections;
drop policy if exists "Permitir escrita para autenticados" on public.checklist_items;
drop policy if exists "Permitir escrita para autenticados" on public.legislations;

drop policy if exists "profiles_authenticated_read" on public.profiles;

create policy "profiles_read_own_or_same_tenant"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.tenant_users a
      join public.tenant_users b on a.tenant_id = b.tenant_id
      where a.user_id = auth.uid()
        and b.user_id = profiles.id
    )
  );
