ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS observed_staff INTEGER,
  ADD COLUMN IF NOT EXISTS observed_nursing_techs INTEGER;
