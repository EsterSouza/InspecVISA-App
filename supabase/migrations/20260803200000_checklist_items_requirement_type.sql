-- Adds requirement classification and legislation URL to checklist items.
-- Additive only: default keeps every existing item as 'legal' (no behavior change).

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS requirement_type text NOT NULL DEFAULT 'legal',
  ADD COLUMN IF NOT EXISTS legislation_url text;

ALTER TABLE public.checklist_items
  DROP CONSTRAINT IF EXISTS checklist_items_requirement_type_check;

ALTER TABLE public.checklist_items
  ADD CONSTRAINT checklist_items_requirement_type_check
  CHECK (requirement_type IN ('legal', 'good_practice'));
