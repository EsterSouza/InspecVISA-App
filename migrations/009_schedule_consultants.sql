-- ============================================================
-- 009_schedule_consultants.sql
-- Consultora(s) responsável(is) já no agendamento. A inspeção criada
-- a partir do agendamento herda essa atribuição (rastreabilidade).
-- ============================================================

alter table public.schedules add column if not exists consultant_names text[];
