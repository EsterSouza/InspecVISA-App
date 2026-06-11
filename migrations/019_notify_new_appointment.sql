-- ============================================================
-- 019_notify_new_appointment.sql
-- Notificacao por e-mail a cada nova solicitacao publica.
-- Trigger AFTER INSERT em appointment_requests chama a Edge Function
-- notify-new-appointment via pg_net, autenticando com um segredo
-- compartilhado guardado no Vault (nome: notify_appointment_secret).
--
-- O segredo NAO fica versionado: e gerado e gravado no Vault fora do git
-- (vault.create_secret). A Edge Function valida o mesmo valor no header
-- x-notify-secret (segredo NOTIFY_SECRET das Edge Functions).
--
-- Segredos das Edge Functions a configurar no painel do Supabase:
--   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_TO, NOTIFY_SECRET
-- ============================================================

create extension if not exists pg_net;

create or replace function public.notify_new_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'notify_appointment_secret';

  perform net.http_post(
    url := 'https://pfjacmawaigndqclgvpn.supabase.co/functions/v1/notify-new-appointment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  return NEW;
exception when others then
  -- Nunca bloquear a criacao da solicitacao por falha de notificacao
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_appointment on public.appointment_requests;
create trigger trg_notify_new_appointment
after insert on public.appointment_requests
for each row execute function public.notify_new_appointment();
