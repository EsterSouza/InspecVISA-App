-- ============================================================
-- 008_inspection_co_consultants.sql
-- Co-responsabilidade: uma inspeção pode ter mais de uma consultora
-- (ex.: ILPI é feita por enfermeira + nutricionista juntas).
-- Mantém consultant_name (líder/compatibilidade) e adiciona o conjunto.
-- ============================================================

alter table public.inspections add column if not exists consultant_names text[];

-- Backfill por categoria do cliente (regra acordada):
--   ILPI      -> conjunto: Ester (enfermagem) + Ana (nutrição)
--   Alimentos -> Ana
--   Estética  -> Ester
-- Não destrói nada: só preenche quando ainda está nulo.
update public.inspections i
set consultant_names = case
      when c.category = 'ilpi'      then array['Ester Caiafa','Ana Roberta Ribeiro']
      when c.category = 'alimentos' then array['Ana Roberta Ribeiro']
      when c.category = 'estetica'  then array['Ester Caiafa']
      else array[nullif(trim(i.consultant_name), '')]
    end,
    updated_at = now()
from public.clients c
where c.id = i.client_id
  and i.deleted_at is null
  and i.consultant_names is null;
