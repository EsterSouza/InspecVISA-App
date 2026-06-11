-- Token de visita sozinho nao deve abrir relatorio/fotos/anexos.
-- O frontend passa a usar a Edge Function client-appointment-assets,
-- que valida o token da conta do cliente antes de assinar URLs.
revoke execute on function public.public_get_appointment_status(uuid) from public;
revoke execute on function public.public_get_appointment_status(uuid) from anon;
revoke execute on function public.public_get_appointment_status(uuid) from authenticated;

revoke execute on function public.public_get_appointment_assets(uuid) from public;
revoke execute on function public.public_get_appointment_assets(uuid) from anon;
revoke execute on function public.public_get_appointment_assets(uuid) from authenticated;
