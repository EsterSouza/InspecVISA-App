import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Label } from '../ui/Label';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import { ScheduleService } from '../../services/scheduleService';
import { isInspectionAppointment } from '../../utils/appointmentType';
import { toast } from '../../store/useToastStore';
import type { AppointmentRequest, Inspection, Schedule } from '../../types';

/**
 * Recibo de entrega — decisão 26 do FE-23.
 *
 * O que chegou ao portal e o que não chegou, item a item, **permanentemente**.
 * O `Toast` de atenção que existia some da tela em segundos e leva a informação
 * junto; esta é a informação que a consultora vai precisar amanhã.
 */
function Linha({ entregue, titulo, detalhe, acao }: {
  entregue: boolean;
  titulo: string;
  detalhe: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-default px-5 py-3 last:border-b-0">
      <Badge variant={entregue ? 'success' : 'warning'} className="mt-0.5 shrink-0 gap-1">
        {entregue
          ? <><Check className="h-3 w-3" aria-hidden="true" /> entregue</>
          : <><AlertTriangle className="h-3 w-3" aria-hidden="true" /> não entregue</>}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-navy">{titulo}</p>
        <p className="text-sm text-navy-3">{detalhe}</p>
      </div>
      {acao}
    </div>
  );
}

export function DeliveryReceipt({ inspection }: { inspection: Inspection }) {
  const [request, setRequest] = useState<AppointmentRequest | null>(null);
  const [actionItemCount, setActionItemCount] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Schedule[]>([]);
  const [chosenScheduleId, setChosenScheduleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    if (!navigator.onLine) { setOffline(true); setLoading(false); return; }
    setOffline(false);
    setLoading(true);
    try {
      const found = await AppointmentAdminService.getRequestByInspectionId(inspection.id);
      setRequest(found);
      if (found) {
        const items = await AppointmentAdminService.listActionItems(found.id).catch(() => []);
        setActionItemCount(items.length);
      } else {
        const schedules = await ScheduleService.getSchedules();
        setCandidates(schedules.filter(s =>
          s.clientId === inspection.clientId
          && isInspectionAppointment(s.appointmentType)
          && s.status !== 'cancelled'
          && (!s.inspectionId || s.inspectionId === inspection.id)
        ));
      }
    } catch (err) {
      console.warn('[Recibo] Não foi possível conferir a entrega:', err);
    } finally {
      setLoading(false);
    }
  }, [inspection.id, inspection.clientId]);

  useEffect(() => { void load(); }, [load]);

  const link = async () => {
    if (!chosenScheduleId) return;
    setLinking(true);
    try {
      await ScheduleService.linkInspection(chosenScheduleId, inspection.id);
      await new Promise(resolve => setTimeout(resolve, 800));
      await load();
      toast.success('Vínculo refeito.', 'Gere o PDF final de novo para publicar o relatório no portal.');
    } catch (err) {
      toast.error('Não foi possível vincular.', String(err));
    } finally {
      setLinking(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-default px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy">Entrega ao portal</h2>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Reconferir</span>
        </Button>
      </div>

      {offline ? (
        <p className="px-5 py-4 text-sm text-navy-3">
          Sem conexão — não dá para conferir o que chegou ao portal agora.
        </p>
      ) : loading ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-navy-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Conferindo o que chegou ao portal…
        </p>
      ) : !request ? (
        <div className="space-y-3 p-5">
          <div className="flex items-start gap-2 rounded-md border border-amber-soft-border bg-amber-soft p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-strong" aria-hidden="true" />
            <p className="text-sm text-amber-soft-ink">
              <strong>Nada chegou ao portal.</strong> Não há solicitação apontando para esta inspeção,
              então o relatório, a nota e o plano de ação não foram publicados. O PDF que você baixou
              está correto: faltou a entrega.
            </p>
          </div>
          {candidates.length > 0 ? (
            <div>
              <Label htmlFor="recibo-agendamento" className="mb-1.5">Vincular a um agendamento</Label>
              <Select
                id="recibo-agendamento"
                className="h-11"
                value={chosenScheduleId}
                onChange={(e) => setChosenScheduleId(e.target.value)}
              >
                <option value="">Escolha um…</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.scheduledAt).toLocaleString('pt-BR')} — {s.subject || 'visita técnica'}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="sm" fullWidth className="mt-2" disabled={!chosenScheduleId || linking} onClick={() => void link()}>
                {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vincular e reconferir
              </Button>
            </div>
          ) : (
            <p className="text-sm text-navy-3">
              Não há agendamento desta unidade disponível para vincular. Crie um em Agendamentos e
              volte aqui.
            </p>
          )}
        </div>
      ) : (
        <div>
          <Linha
            entregue={!!request.report_pdf_path && !request.report_hidden}
            titulo="Relatório no portal"
            detalhe={request.report_delivered_at
              ? `Entregue em ${new Date(request.report_delivered_at).toLocaleString('pt-BR')}`
              : 'Ainda não publicado — gere o PDF final para publicar.'}
          />
          <Linha
            entregue={request.compliance_score !== null && request.compliance_score !== undefined}
            titulo="Nota de conformidade"
            detalhe={request.compliance_score !== null && request.compliance_score !== undefined
              ? `global ${request.compliance_score}%`
                + (request.sanitary_score != null ? ` · sanitária ${request.sanitary_score}%` : '')
                + (request.nutrition_score != null ? ` · nutrição ${request.nutrition_score}%` : '')
              : 'A nota que o cliente vê ainda não foi gravada.'}
          />
          <Linha
            entregue={(actionItemCount ?? 0) > 0}
            titulo="Plano de ação"
            detalhe={actionItemCount === null
              ? 'Não foi possível conferir agora.'
              : actionItemCount > 0
                ? `${actionItemCount} ${actionItemCount === 1 ? 'pendência publicada' : 'pendências publicadas'}`
                : 'Nenhuma pendência publicada para o cliente.'}
          />
        </div>
      )}

    </Card>
  );
}
