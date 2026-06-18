-- ============================================================
-- 027_inspection_attribution_and_cofinalize.sql
-- Rastreabilidade (quem/quando) + co-finalização ILPI:
--  * last_edited_by: nome de quem fez a última modificação (Ester/Ana)
--  * finalized_by: lista [{name, at}] de quem já finalizou (ILPI co-inspeção
--    só fecha de fato quando TODAS as consultoras esperadas finalizarem).
-- Colunas aditivas e nuláveis — sem impacto nos fluxos existentes.
-- ============================================================

alter table public.inspections
  add column if not exists last_edited_by text,
  add column if not exists finalized_by jsonb not null default '[]'::jsonb;

alter table public.responses
  add column if not exists last_edited_by text;
