-- Estatísticas de não-conformidade por visita, gravadas ao publicar o relatório
-- final (ver InspectionSummary.tsx), para alimentar o resumo executivo de rede
-- no portal do cliente (franchiseReport.ts): críticos, importantes, imediatos,
-- reincidentes e a lista compacta de achados usada para detectar padrões
-- recorrentes entre unidades da mesma conta.
alter table public.appointment_requests
  add column if not exists critical_nc_count smallint,
  add column if not exists important_nc_count smallint,
  add column if not exists total_nc_count smallint,
  add column if not exists recurring_nc_count smallint,
  add column if not exists immediate_nc_count smallint,
  add column if not exists nc_items jsonb not null default '[]'::jsonb;

comment on column public.appointment_requests.critical_nc_count is 'Qtd de itens NC criticos (isCritical) na ultima geracao do relatorio, para o resumo executivo do portal do cliente.';
comment on column public.appointment_requests.important_nc_count is 'Qtd de itens NC importantes (nao critico, peso >= 5).';
comment on column public.appointment_requests.total_nc_count is 'Qtd total de itens nao conformes.';
comment on column public.appointment_requests.recurring_nc_count is 'Qtd de NCs desta visita que ja eram NC em visita anterior do mesmo cliente (reincidencia).';
comment on column public.appointment_requests.immediate_nc_count is 'Qtd de NCs com prazo "Imediato".';
comment on column public.appointment_requests.nc_items is 'Lista compacta dos itens NC desta visita: [{id, d: descricao, c: critico}], usada para detectar padroes recorrentes entre unidades da mesma rede no resumo da franquia.';
