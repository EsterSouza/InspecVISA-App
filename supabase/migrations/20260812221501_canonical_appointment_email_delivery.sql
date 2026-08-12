-- EMAIL-01: clients.email e a fonte canonica para compromissos vinculados.
-- A migration e aditiva para manter compatibilidade durante o rollout das Edge Functions.

alter table public.appointment_notification_log
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists recipient_email text,
  add column if not exists recipient_source text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists last_error_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointment_notification_log'::regclass
      and conname = 'appointment_notification_log_delivery_status_check'
  ) then
    alter table public.appointment_notification_log
      add constraint appointment_notification_log_delivery_status_check
      check (delivery_status in ('pending', 'sending', 'sent', 'missing_recipient', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointment_notification_log'::regclass
      and conname = 'appointment_notification_log_recipient_source_check'
  ) then
    alter table public.appointment_notification_log
      add constraint appointment_notification_log_recipient_source_check
      check (recipient_source is null or recipient_source in ('client', 'request'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointment_notification_log'::regclass
      and conname = 'appointment_notification_log_attempt_count_check'
  ) then
    alter table public.appointment_notification_log
      add constraint appointment_notification_log_attempt_count_check
      check (attempt_count >= 0);
  end if;
end;
$$;

update public.appointment_notification_log
set delivery_status = case when email_sent then 'sent' else 'pending' end,
    sent_at = case when email_sent then coalesce(sent_at, created_at) else sent_at end;

comment on table public.appointment_notification_log is
  'Entrega idempotente de notificacoes de compromisso. Falhas e destinatario ausente sao '
  'retryable; sent bloqueia duplicacao. Escrita somente pela Edge Function via service role.';

comment on column public.appointment_notification_log.recipient_email is
  'Snapshot do destinatario resolvido no servidor no momento da tentativa.';
comment on column public.appointment_notification_log.recipient_source is
  'client para clients.email; request somente quando a solicitacao ainda nao tem client_id.';
comment on column public.appointment_notification_log.last_error_code is
  'Codigo sanitizado de falha; nunca armazena resposta SMTP, credencial ou segredo.';

comment on column public.appointment_requests.email is
  'Contato provisório da solicitacao publica ou snapshot. Com client_id, a fonte canonica para notificacoes e public.clients.email.';

-- Preserva a definicao viva da RPC (inclusive feature gates adicionados por migrations
-- posteriores) e troca somente a leitura/persistencia do e-mail do portal autenticado.
do $$
declare
  v_def text;
  v_old_declaration text := '  v_client_state text;';
  v_new_declaration text := '  v_client_state text;' || chr(10) || '  v_client_email text;';
  v_old_select text := 'select c.name, c.state into v_unit_name, v_client_state from public.clients c';
  v_new_select text := 'select c.name, c.state, c.email into v_unit_name, v_client_state, v_client_email from public.clients c';
  v_old_email text := 'nullif(btrim(p_payload->>''email''), '''')';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'client_portal_create_appointment'
    and pg_get_function_identity_arguments(p.oid) = 'p_payload jsonb';

  if v_def is null then
    raise notice 'client_portal_create_appointment ausente no fixture; nada a ajustar';
    return;
  end if;

  if position('v_client_email text;' in v_def) = 0 then
    if position(v_old_declaration in v_def) = 0 then
      raise exception 'client_portal_create_appointment mudou: declaracao de client_state nao encontrada';
    end if;
    v_def := replace(v_def, v_old_declaration, v_new_declaration);
  end if;

  if position(v_new_select in v_def) = 0 then
    if position(v_old_select in v_def) = 0 then
      raise exception 'client_portal_create_appointment mudou: consulta do cliente nao encontrada';
    end if;
    v_def := replace(v_def, v_old_select, v_new_select);
  end if;

  if position(v_old_email in v_def) > 0 then
    v_def := replace(v_def, v_old_email, 'v_client_email');
  elsif position('v_client_email, v_starts_local::date' in v_def) = 0 then
    raise exception 'client_portal_create_appointment mudou: persistencia do e-mail nao encontrada';
  end if;

  execute v_def;
end;
$$;

do $$
begin
  if to_regprocedure('public.client_portal_create_appointment(jsonb)') is not null then
    execute 'revoke all on function public.client_portal_create_appointment(jsonb) from public';
    execute 'grant execute on function public.client_portal_create_appointment(jsonb) to anon, authenticated';
  end if;
end;
$$;
