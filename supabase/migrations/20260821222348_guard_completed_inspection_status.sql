-- Uma inspeção concluída estava sendo "des-concluída" sozinha: o app salva em segundo
-- plano o tempo todo (autosave de poucos segundos + rodada de sincronização a cada 60s).
-- Se outro dispositivo/aba ainda tem a MESMA inspeção aberta com o estado de ANTES do
-- encerramento, o autosave dele sobrescreve o servidor de volta para 'in_progress' —
-- silenciosamente, porque tecnicamente ele só está "salvando o que tinha na tela".
--
-- Caso real (Freguesia, 21/08/2026): as duas consultoras finalizaram, o relatório foi
-- gerado (inspection_report_versions v1, 22:05:26), e minutos depois o status voltou
-- para 'in_progress' sozinho — bloqueando a próxima tentativa de encerrar.
--
-- A trava: nenhuma escrita em `inspections` pode tirar o status de 'completed', a não
-- ser que passe pela função `reopen_inspection`, que é o único caminho legítimo e marca
-- a intenção explicitamente via GUC de transação (não dá para distinguir "reabertura de
-- propósito" de "autosave desatualizado" só olhando os dados: os dois mandam status
-- 'in_progress' e completed_at nulo).

create or replace function private.guard_completed_inspection_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'completed'
     and new.status is distinct from 'completed'
     and coalesce(current_setting('inspecvisa.allow_reopen', true), '') <> 'true'
  then
    new.status := old.status;
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_completed_inspection_status on public.inspections;
create trigger trg_guard_completed_inspection_status
  before update on public.inspections
  for each row
  execute function private.guard_completed_inspection_status();

-- Único caminho que pode legitimamente tirar uma inspeção de 'completed'. Substitui o
-- update direto que InspectionExecution.handleReopenInspection fazia via
-- InspectionService.updateInspection — aquele update agora esbarraria na trava acima.
create or replace function public.reopen_inspection(p_inspection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.inspections
  where id = p_inspection_id;

  if v_tenant_id is null then
    raise exception 'Inspecao nao encontrada.';
  end if;

  if not exists (
    select 1
    from public.tenant_users
    where tenant_id = v_tenant_id
      and user_id = (select auth.uid())
      and role in ('admin', 'consultant')
  ) then
    raise exception 'Sem permissao para reabrir esta inspecao.';
  end if;

  perform set_config('inspecvisa.allow_reopen', 'true', true);

  update public.inspections
  set status = 'in_progress',
      completed_at = null,
      updated_at = now()
  where id = p_inspection_id;
end;
$function$;

revoke all on function public.reopen_inspection(uuid) from public;
grant execute on function public.reopen_inspection(uuid) to authenticated;
