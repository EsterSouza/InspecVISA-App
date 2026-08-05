-- Link(s)/fonte(s) anexados pela consultora a um item específico, durante o
-- preenchimento do roteiro (diferente de reference_sources, que é do relatório
-- inteiro). Coluna aditiva, sem impacto em dado existente.
alter table public.responses
  add column if not exists links jsonb;

comment on column public.responses.links is
  'Lista de URLs (texto simples) anexadas pela consultora a este item durante a inspeção. Formato: ["https://...","https://..."]';
