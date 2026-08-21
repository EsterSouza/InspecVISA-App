-- O advisor apontou reopen_inspection() chamavel por `anon`: privilegio padrao de
-- funcao nova neste projeto (mesma classe do achado em tabela nova, ver
-- supabase-default-privileges-em-tabela-nova), nao coisa que o `revoke all ... from
-- public` da migration anterior tenha alcancado. So `authenticated` deve chamar.
revoke all on function public.reopen_inspection(uuid) from anon;
