-- Persist ILPI cleaning dimensioning fields already collected by the app.
-- Additive only: existing inspections and RLS policies are preserved.

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS usable_area_m2 INTEGER,
  ADD COLUMN IF NOT EXISTS observed_cleaning_staff INTEGER;
