-- Expose online appointment metadata in the authenticated client portal overview.
-- The meeting URL remains absent for in-person appointments and is only displayed by the UI
-- when both attendance_mode = online and meeting_url is populated.

do $migration$
declare
  v_definition text;
  v_anchor text := '''consultant_names'', ar.consultant_names,';
  v_replacement text := '''consultant_names'', ar.consultant_names,
          ''attendance_mode'', ar.attendance_mode,
          ''meeting_url'', case when ar.attendance_mode = ''online'' then ar.meeting_url end,';
begin
  select pg_get_functiondef('public.client_portal_overview(uuid)'::regprocedure)
  into v_definition;

  if position('''attendance_mode'', ar.attendance_mode' in v_definition) > 0 then
    return;
  end if;
  if position(v_anchor in v_definition) = 0 then
    raise exception 'client_portal_overview anchor not found';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end
$migration$;
