import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, ChevronRight, Loader2, RefreshCw, X, XCircle,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { PageShell } from '../ui/PageShell';
import { PageHeader } from '../ui/PageHeader';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import { ScheduleService } from '../../services/scheduleService';
import { isInspectionAppointment } from '../../utils/appointmentType';
import { calculateAreaScores } from '../../utils/scoring';
import { NO_DEADLINE } from '../../utils/clientActionPlan';
import { generateId } from '../../utils/imageUtils';
import { toast } from '../../store/useToastStore';
import type { MissingText } from './ExecutionScorePanel';
import type { ChecklistTemplate, Inspection, InspectionResponse, Schedule } from '../../types';

/**
 * Encerrar e entregar — a etapa que não existia (decisão 25).
 *
 * Hoje o botão "PDF Final" congela o relatório, grava a nota no portal, publica
 * o PDF e reconcilia o plano de ação: quatro efeitos atrás de um rótulo que fala
 * de um arquivo. Esta tela diz o que vai acontecer **antes** de acontecer.
 *
 * É tela, não modal: uma decisão irreversível merece a tela inteira e a rolagem
 * inteira. E não pede assinatura (decisão 31) — o relatório é fechado em casa.
 */

/**
 * Estado do vínculo de entrega (decisão 32). O que conta é a **solicitação
 * apontando para esta inspeção**, não o agendamento na agenda: vincular sem
 * sinal não escreve nada em `appointment_requests` e a agenda mostra verde
 * assim mesmo. Testar "existe agendamento?" daria falso verde no estado C.
 */
type DeliveryState =
  | { kind: 'carregando' }
  | { kind: 'pronta'; requestId: string }
  | { kind: 'sem-agendamento' }
  | { kind: 'vinculo-nao-chegou'; scheduleId: string }
  | { kind: 'offline' };

function Marca({ tone }: { tone: 'ok' | 'no' | 'atencao' }) {
  const base = 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full';
  if (tone === 'ok') return <span className={`${base} bg-success-soft text-success-soft-ink`} aria-hidden="true"><Check className="h-3 w-3" /></span>;
  if (tone === 'no') return <span className={`${base} bg-danger-soft text-danger-soft-ink`} aria-hidden="true"><X className="h-3 w-3" /></span>;
  return <span className={`${base} bg-amber-soft text-amber-soft-ink`} aria-hidden="true"><AlertTriangle className="h-3 w-3" /></span>;
}

interface InspectionFinishScreenProps {
  inspection: Inspection;
  template: ChecklistTemplate;
  responses: InspectionResponse[];
  missingText: MissingText[];
  isIlpi: boolean;
  isFinishing: boolean;
  accompanistName: string;
  accompanistRole: string;
  onAccompanistChange: (field: 'accompanistName' | 'accompanistRole', value: string) => void;
  onGoToItem: (itemId: string) => void;
  onBack: () => void;
  onFinish: () => void;
  onPdfOnly: () => void;
}

export function InspectionFinishScreen({
  inspection,
  template,
  responses,
  missingText,
  isIlpi,
  isFinishing,
  accompanistName,
  accompanistRole,
  onAccompanistChange,
  onGoToItem,
  onBack,
  onFinish,
  onPdfOnly,
}: InspectionFinishScreenProps) {
  const [delivery, setDelivery] = useState<DeliveryState>({ kind: 'carregando' });
  const [candidateSchedules, setCandidateSchedules] = useState<Schedule[]>([]);
  const [chosenScheduleId, setChosenScheduleId] = useState('');
  const [linking, setLinking] = useState(false);

  const areas = calculateAreaScores(responses, template.sections);
  const score = areas.global;
  const split = isIlpi && areas.isSplit;

  const notComplies = responses.filter(r => r.result === 'not_complies');
  const semPrazo = notComplies.filter(r => !r.deadline?.trim() || r.deadline.trim() === NO_DEADLINE);
  const evidenciasAprovadas = new Set(responses.flatMap(r => r.confirmedClientEvidenceIds || [])).size;

  const esperadas = (inspection.consultantNames && inspection.consultantNames.length > 0)
    ? inspection.consultantNames
    : ([inspection.consultantName].filter(Boolean) as string[]);
  const jaFinalizaram = inspection.finalizedBy || [];
  const faltamFinalizar = esperadas.filter(name => !jaFinalizaram.some(f => f.name === name));

  const checkDelivery = useCallback(async () => {
    if (!navigator.onLine) { setDelivery({ kind: 'offline' }); return; }
    setDelivery({ kind: 'carregando' });
    try {
      const request = await AppointmentAdminService.getRequestByInspectionId(inspection.id);
      if (request) { setDelivery({ kind: 'pronta', requestId: request.id }); return; }

      const schedules = await ScheduleService.getSchedules();
      const linked = schedules.find(s => s.inspectionId === inspection.id);
      if (linked) { setDelivery({ kind: 'vinculo-nao-chegou', scheduleId: linked.id }); return; }

      setCandidateSchedules(schedules.filter(s =>
        s.clientId === inspection.clientId
        && !s.inspectionId
        && isInspectionAppointment(s.appointmentType)
        && s.status !== 'cancelled'
      ));
      setDelivery({ kind: 'sem-agendamento' });
    } catch (err) {
      console.warn('[Encerramento] Não foi possível conferir o vínculo de entrega:', err);
      setDelivery({ kind: 'offline' });
    }
  }, [inspection.id, inspection.clientId]);

  useEffect(() => { void checkDelivery(); }, [checkDelivery]);

  const relink = async (scheduleId: string) => {
    setLinking(true);
    try {
      await ScheduleService.linkInspection(scheduleId, inspection.id);
      // `syncLinkedAppointmentRequest` roda com `void`: dá tempo de escrever antes de reconferir.
      await new Promise(resolve => setTimeout(resolve, 800));
      await checkDelivery();
    } catch (err) {
      toast.error('Não foi possível refazer o vínculo.', String(err));
    } finally {
      setLinking(false);
    }
  };

  const createRetroactiveSchedule = async () => {
    setLinking(true);
    try {
      const now = new Date();
      const schedule: Schedule = {
        id: generateId(),
        clientId: inspection.clientId,
        scheduledAt: new Date(inspection.inspectionDate),
        status: 'in_progress',
        appointmentType: 'inspection',
        subject: 'Visita técnica (registrada no encerramento)',
        consultantNames: esperadas,
        inspectionId: inspection.id,
        createdAt: now,
        updatedAt: now,
        tenantId: inspection.tenantId,
        syncStatus: 'pending',
      } as Schedule;
      await ScheduleService.saveSchedule(schedule);
      await ScheduleService.linkInspection(schedule.id, inspection.id);
      await new Promise(resolve => setTimeout(resolve, 800));
      await checkDelivery();
    } catch (err) {
      toast.error('Não foi possível criar o agendamento retroativo.', String(err));
    } finally {
      setLinking(false);
    }
  };

  const podeEntregar = delivery.kind === 'pronta' && !isFinishing;
  const pontosDeAtencao = (missingText.length > 0 ? 1 : 0)
    + (semPrazo.length > 0 ? 1 : 0)
    + (score.totalItems > score.evaluatedItems ? 1 : 0);

  return (
    <PageShell>
      <nav aria-label="Trilha" className="mb-2 flex items-center gap-1.5 text-xs text-navy-3">
        <button type="button" className="hover:text-navy-2 hover:underline" onClick={onBack}>
          {inspection.clientName}
        </button>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span>Encerrar e entregar</span>
      </nav>

      <PageHeader
        title="Encerrar e entregar"
        description="Confira o que ficou pendente e o que vai acontecer ao confirmar."
        actions={<Button variant="ghost" onClick={onBack}>Voltar ao roteiro</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* ── Antes de encerrar ─────────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-navy">Antes de encerrar</h2>
              {pontosDeAtencao > 0 && (
                <Badge variant="warning">
                  {pontosDeAtencao} {pontosDeAtencao === 1 ? 'ponto de atenção' : 'pontos de atenção'}
                </Badge>
              )}
            </div>
            <ul className="space-y-4 p-5 text-sm text-navy-2">
              <li className="flex gap-3">
                <Marca tone={score.evaluatedItems === score.totalItems ? 'ok' : 'atencao'} />
                <span>
                  <strong className="text-navy">
                    {score.evaluatedItems} de {score.totalItems} itens respondidos.
                  </strong>
                  {score.evaluatedItems < score.totalItems && (
                    <> Os {score.totalItems - score.evaluatedItems} sem resposta não entram na nota.</>
                  )}
                </span>
              </li>

              <li className="flex gap-3">
                <Marca tone={missingText.length > 0 ? 'no' : 'ok'} />
                <span className="min-w-0 flex-1">
                  {missingText.length === 0 ? (
                    <strong className="text-navy">Todas as não conformidades têm situação e ação escritas.</strong>
                  ) : (
                    <>
                      <strong className="text-navy">
                        {missingText.length} {missingText.length === 1
                          ? 'não conformidade sem situação ou ação escrita.'
                          : 'não conformidades sem situação ou ação escrita.'}
                      </strong>{' '}
                      Elas entram no plano de ação do cliente em branco — ele recebe a pendência sem
                      saber o que foi encontrado nem o que fazer.
                      <span className="mt-2 block overflow-hidden rounded-md border border-danger-soft-border">
                        {missingText.map((pend) => (
                          <button
                            key={pend.itemId}
                            type="button"
                            onClick={() => onGoToItem(pend.itemId)}
                            className="flex w-full items-start gap-3 border-b border-gray-100 bg-white px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50"
                            style={{ minHeight: 44 }}
                          >
                            <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 text-xs font-semibold tabular-nums text-navy-2">
                              {pend.order}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-navy">{pend.description}</span>
                              <span className="block text-xs text-navy-3">
                                {pend.missing === 'both' ? 'faltam situação e ação'
                                  : pend.missing === 'situation' ? 'falta a situação' : 'falta a ação'}
                              </span>
                            </span>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-navy-3" aria-hidden="true" />
                          </button>
                        ))}
                      </span>
                    </>
                  )}
                </span>
              </li>

              {semPrazo.length > 0 && (
                <li className="flex gap-3">
                  <Marca tone="atencao" />
                  <span>
                    <strong className="text-navy">
                      {semPrazo.length} {semPrazo.length === 1 ? 'pendência ficou' : 'pendências ficaram'} sem prazo definido.
                    </strong>{' '}
                    Elas aparecem no portal, mas nunca contam como vencidas — nem para o cliente,
                    nem na sua fila do Início. Confira se é isso mesmo.
                  </span>
                </li>
              )}

              {faltamFinalizar.length > 0 && jaFinalizaram.length > 0 && (
                <li className="flex gap-3">
                  <Marca tone="atencao" />
                  <span>
                    <strong className="text-navy">{jaFinalizaram.map(f => f.name).join(' e ')}</strong>{' '}
                    já {jaFinalizaram.length === 1 ? 'finalizou' : 'finalizaram'} a sua parte.
                    Ainda falta {faltamFinalizar.join(' e ')} — a inspeção só fecha quando todas finalizarem.
                  </span>
                </li>
              )}
            </ul>
          </Card>

          {/* ── O que vai acontecer ───────────────────────────────────── */}
          <Card>
            <div className="border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-navy">O que vai acontecer ao confirmar</h2>
            </div>
            <ul className="space-y-4 p-5 text-sm text-navy-2">
              <li className="flex gap-3">
                <Marca tone="ok" />
                <span>
                  <strong className="text-navy">O roteiro é congelado.</strong> Uma fotografia dos{' '}
                  {score.totalItems} itens fica guardada com o relatório. Editar o roteiro depois não
                  muda mais este documento.
                </span>
              </li>
              <li className="flex gap-3">
                <Marca tone="ok" />
                <span>
                  <strong className="text-navy">O cliente passa a ver o relatório no portal</strong>, com a
                  nota <strong className="tabular-nums">{Math.round(score.scorePercentage)}%</strong>
                  {split && (
                    <> — global, sanitária <span className="tabular-nums">{Math.round(areas.sanitary.score.scorePercentage)}%</span>
                      {' '}e nutrição <span className="tabular-nums">{Math.round(areas.nutrition.score.scorePercentage)}%</span></>
                  )}.
                </span>
              </li>
              <li className="flex gap-3">
                <Marca tone="ok" />
                <span>
                  <strong className="text-navy">
                    {notComplies.length} {notComplies.length === 1 ? 'pendência entra' : 'pendências entram'} no plano de ação
                  </strong>{' '}
                  do cliente, com prazo e responsável. As que já estavam abertas de visitas anteriores
                  são atualizadas, não duplicadas. Pendência que o cliente já resolveu não é reaberta.
                </span>
              </li>
              {evidenciasAprovadas > 0 && (
                <li className="flex gap-3">
                  <Marca tone="atencao" />
                  <span>
                    <strong className="text-navy">
                      {evidenciasAprovadas} {evidenciasAprovadas === 1
                        ? 'evidência enviada pelo cliente será aprovada'
                        : 'evidências enviadas pelo cliente serão aprovadas'}
                    </strong>{' '}
                    junto — {evidenciasAprovadas === 1 ? 'a que você aceitou' : 'as que você aceitou'} ao
                    marcar CUMPRE.
                  </span>
                </li>
              )}
              <li className="flex gap-3">
                <Marca tone="ok" />
                <span>
                  <strong className="text-navy">O PDF fica disponível</strong> na tela do relatório, para
                  você baixar e para o cliente abrir.
                </span>
              </li>
            </ul>
            <div className="border-t border-gray-200 px-5 py-3">
              <p className="text-sm text-navy-3">
                O que <strong>não</strong> acontece: nada é apagado, e você pode reabrir a inspeção depois.
                Reabrir não retira o que o cliente já viu.
              </p>
            </div>
          </Card>

          {/* ── Quem acompanhou ───────────────────────────────────────── */}
          <Card>
            <div className="border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-navy">Quem acompanhou a visita</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="acompanhante-nome" className="mb-1.5">Nome</Label>
                  <Input
                    id="acompanhante-nome"
                    className="h-11"
                    value={accompanistName}
                    onChange={(e) => onAccompanistChange('accompanistName', e.target.value)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Label htmlFor="acompanhante-funcao" className="mb-1.5">Função</Label>
                  <Input
                    id="acompanhante-funcao"
                    className="h-11"
                    value={accompanistRole}
                    onChange={(e) => onAccompanistChange('accompanistRole', e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-md border border-secondary-200 bg-secondary-100 p-3">
                <p className="text-sm text-secondary-700">
                  <strong>Sem assinatura no aparelho.</strong> O relatório é escrito depois da visita, em
                  casa — pedir a assinatura do acompanhante na hora de encerrar tornava impossível
                  terminar fora do local. O PDF continua trazendo o nome e a função acima de uma linha em
                  branco, para assinatura no papel se alguém pedir. A sua assinatura, de consultora,
                  continua sendo capturada na hora de gerar o PDF.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Entrega ao portal ─────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <div className="border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-navy">Entrega ao portal</h2>
            </div>
            <div className="space-y-3 p-5">
              {delivery.kind === 'carregando' && (
                <p className="flex items-center gap-2 text-sm text-navy-3">
                  <Loader2 className="h-4 w-4 animate-spin" /> Conferindo o vínculo de entrega…
                </p>
              )}

              {delivery.kind === 'offline' && (
                <div className="flex items-start gap-2 rounded-md border border-amber-soft-border bg-amber-soft p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-strong" aria-hidden="true" />
                  <p className="text-sm text-amber-soft-ink">
                    <strong>Sem conexão para conferir o vínculo.</strong> Encerrar exige internet — o
                    rascunho continua salvo no aparelho.
                  </p>
                </div>
              )}

              {delivery.kind === 'pronta' && (
                <div className="flex items-start gap-2 rounded-md border border-success-soft-border bg-success-soft p-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-soft-ink" aria-hidden="true" />
                  <p className="text-sm text-success-soft-ink">
                    <strong>Pronta para entregar.</strong> Há uma solicitação apontando para esta
                    inspeção — é esse apontamento, e não o agendamento na agenda, que faz o relatório
                    chegar ao portal.
                  </p>
                </div>
              )}

              {delivery.kind === 'vinculo-nao-chegou' && (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-amber-soft-border bg-amber-soft p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-strong" aria-hidden="true" />
                    <p className="text-sm text-amber-soft-ink">
                      <strong>O vínculo não chegou ao portal.</strong> Esta inspeção está ligada a um
                      agendamento, mas a solicitação correspondente ainda não aponta para ela. Encerrar
                      agora entregaria o PDF e <strong>nada mais</strong>.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" fullWidth disabled={linking} onClick={() => void relink(delivery.scheduleId)}>
                    {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refazer o vínculo
                  </Button>
                </>
              )}

              {delivery.kind === 'sem-agendamento' && (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-danger-soft-border bg-danger-soft p-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-soft-ink" aria-hidden="true" />
                    <p className="text-sm text-danger-soft-ink">
                      <strong>Não dá para encerrar.</strong> Sem agendamento, o relatório, a nota e as
                      pendências não têm como chegar ao cliente.
                    </p>
                  </div>
                  {candidateSchedules.length > 0 && (
                    <div>
                      <Label htmlFor="agendamento-candidato" className="mb-1.5">
                        Agendamentos desta unidade sem inspeção
                      </Label>
                      <Select
                        id="agendamento-candidato"
                        className="h-11"
                        value={chosenScheduleId}
                        onChange={(e) => setChosenScheduleId(e.target.value)}
                      >
                        <option value="">Escolha um…</option>
                        {candidateSchedules.map((s) => (
                          <option key={s.id} value={s.id}>
                            {new Date(s.scheduledAt).toLocaleString('pt-BR')} — {s.subject || 'visita técnica'}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        className="mt-2"
                        disabled={!chosenScheduleId || linking}
                        onClick={() => void relink(chosenScheduleId)}
                      >
                        Vincular a este agendamento
                      </Button>
                    </div>
                  )}
                  <Button variant="outline" size="sm" fullWidth disabled={linking} onClick={() => void createRetroactiveSchedule()}>
                    {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar um agendamento para esta visita
                  </Button>
                  <p className="text-xs text-navy-3">
                    Se a visita nunca teve agendamento, a saída é criar um retroativo aqui mesmo —
                    bloquear sem oferecer caminho seria prender o relatório.
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-200 p-5">
              <Button size="lg" fullWidth disabled={!podeEntregar} onClick={onFinish}>
                {isFinishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Encerrar e entregar
              </Button>
              <Button variant="outline" fullWidth onClick={onPdfOnly}>
                Só gerar o PDF, sem entregar
              </Button>
              <p className="text-xs text-navy-3">
                A segunda opção gera o arquivo para conferência e <strong>não</strong> publica nada —
                ela nunca fica bloqueada.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
