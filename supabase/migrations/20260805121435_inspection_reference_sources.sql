-- REF-03(b): fontes consultadas pela consultora, além das legislações do roteiro.
-- Coluna aditiva, sem impacto em dado existente.
alter table public.inspections
  add column if not exists reference_sources jsonb;

comment on column public.inspections.reference_sources is
  'Lista de fontes consultadas pela consultora (url, title, note), anexadas ao relatório. Formato: [{"id","url","title","note"}].';
