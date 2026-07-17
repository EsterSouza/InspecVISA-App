-- Notas fiscais do portal do cliente, organizadas por mês de competência.
-- Vinculadas à conta do portal (client_portal_accounts), não a uma unidade
-- específica nem a uma visita — segue o mesmo modelo do pagamento (por conta).
-- Reaproveita o bucket client-portal-files (policies de storage já cobrem
-- qualquer path cujo primeiro segmento seja o tenant_id).

create table if not exists public.client_portal_invoices (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  account_id        uuid not null references public.client_portal_accounts(id) on delete cascade,
  competence_month  date not null,
  storage_bucket    text not null default 'client-portal-files',
  storage_path      text not null,
  file_name         text not null,
  mime_type         text,
  created_at        timestamptz not null default now()
);

create index if not exists client_portal_invoices_account_idx
  on public.client_portal_invoices (account_id, competence_month desc);

alter table public.client_portal_invoices enable row level security;

drop policy if exists "authenticated manage invoices" on public.client_portal_invoices;
create policy "authenticated manage invoices"
  on public.client_portal_invoices for all to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Sem policy anon: o cliente enxerga/baixa notas fiscais apenas via a Edge
-- Function client-portal-invoices (service role, valida o portal_token).
