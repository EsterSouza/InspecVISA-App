-- A trava anterior (20260821222348) protegeu status/completed_at, mas o mesmo autosave
-- desatualizado continuou resetando finalized_by (quem ja finalizou) para so 1 nome --
-- confirmado ao vivo no caso Freguesia as 22:26, minutos depois da primeira correcao.
-- Uma vez completed, finalized_by fica congelado tambem (so muda via reopen_inspection).
create or replace function private.guard_completed_inspection_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'completed'
     and coalesce(current_setting('inspecvisa.allow_reopen', true), '') <> 'true'
  then
    if new.status is distinct from 'completed' then
      new.status := old.status;
      new.completed_at := old.completed_at;
    end if;
    new.finalized_by := old.finalized_by;
  end if;
  return new;
end;
$function$;
