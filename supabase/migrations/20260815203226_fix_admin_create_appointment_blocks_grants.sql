-- O drop+create em consultant_scoped_availability (necessario para acrescentar
-- p_consultant_name) resetou os grants dessa funcao para o padrao do Postgres
-- (EXECUTE para PUBLIC, que o anon herda). Toda outra funcao admin_* deste schema
-- e restrita a authenticated/postgres/service_role -- alinha esta ao mesmo padrao.
revoke all on function public.admin_create_appointment_blocks(
  uuid, timestamptz, integer, text, text, integer, text
) from public, anon;

grant execute on function public.admin_create_appointment_blocks(
  uuid, timestamptz, integer, text, text, integer, text
) to authenticated;
