import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  ImagePlus,
  Loader2,
  MapPin,
  Paperclip,
  Phone,
  Play,
  RefreshCw,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react';
import type { AppointmentRequest } from '../../types';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { STATUS_BADGES, STATUS_LABELS, formatCreatedAt, formatDateBR } from './appointmentRequestsShared';
import { PublishedFilesPanel } from './PublishedFilesPanel';
import { ActionPlanModal } from './modals/ActionPlanModal';
import { toast } from '../../store/useToastStore';

interface ActiveRequestCardProps {
  request: AppointmentRequest;
  showIlpiAreaScores: boolean;
  busy: boolean;
  notificationStatus?: { status: string; sentAt: string | null };
  onPublishReport: (file: File | null) => void;
  onAddAttachment: (file: File | null) => void;
  onAddPhotos: () => void;
  onSetDueDate: () => void;
  onCancel: () => void;
  onMarkInProgress: () => void;
  onMarkCompleted?: () => void;
  onMarkNotCompleted?: () => void;
  onShareWhatsapp?: () => void;
  onReschedule?: () => void;
  onRetryNotification?: () => void;
  onSetCompliance: (score: number | null) => void;
  onSetAreaScores?: (sanitary: number | null, nutrition: number | null) => void;
  onToggleReportHidden: () => void;
  onDelete: () => void;
}

export function ActiveRequestCard({
  request,
  showIlpiAreaScores,
  busy,
  notificationStatus,
  onPublishReport,
  onAddAttachment,
  onAddPhotos,
  onSetDueDate,
  onCancel,
  onMarkInProgress,
  onMarkCompleted,
  onMarkNotCompleted,
  onShareWhatsapp,
  onReschedule,
  onRetryNotification,
  onSetCompliance,
  onSetAreaScores,
  onToggleReportHidden,
  onDelete,
}: ActiveRequestCardProps) {
  const reportInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [scoreInput, setScoreInput] = useState<string>(
    request.compliance_score != null ? String(request.compliance_score) : ''
  );
  const [sanitaryInput, setSanitaryInput] = useState<string>(
    request.sanitary_score != null ? String(request.sanitary_score) : ''
  );
  const [nutritionInput, setNutritionInput] = useState<string>(
    request.nutrition_score != null ? String(request.nutrition_score) : ''
  );
  const [meetingUrl, setMeetingUrl] = useState(request.meeting_url || '');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingSaved, setMeetingSaved] = useState(false);
  const [showActionPlan, setShowActionPlan] = useState(false);
  useEffect(() => setMeetingUrl(request.meeting_url || ''), [request.meeting_url]);
  const isClosed = request.status === 'report_available' || request.status === 'cancelled';

  const saveMeetingUrl = async () => {
    setMeetingBusy(true);
    setMeetingSaved(false);
    try {
      await AppointmentAdminService.setMeetingUrl(request, meetingUrl);
      setMeetingUrl(meetingUrl.trim());
      setMeetingSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o link da videoconferência.');
    } finally {
      setMeetingBusy(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-navy">{request.unit_name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGES[request.status]}`}
                >
                  {STATUS_LABELS[request.status]}
                </span>
                {request.report_hidden && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    <EyeOff className="h-3 w-3" /> Relatório oculto
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-3">
                <span className="flex items-center">
                  <MapPin className="mr-1 h-3.5 w-3.5" /> {request.district}
                </span>
                <span className="flex items-center">
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  {formatDateBR(request.requested_date)}
                  {request.requested_time ? ` às ${request.requested_time.slice(0, 5)}` : ''}
                </span>
                {request.phone && (
                  <span className="flex items-center">
                    <Phone className="mr-1 h-3.5 w-3.5" /> {request.phone}
                  </span>
                )}
                {request.report_due_at && (
                  <span className="flex items-center text-xs text-primary-700">
                    <Clock className="mr-1 h-3 w-3" />
                    Prazo: {formatDateBR(request.report_due_at)}
                    {request.report_due_source === 'manual' ? ' (manual)' : ''}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-navy-3">
                  <Gauge className="h-3.5 w-3.5 text-emerald-600" />
                  <label htmlFor={`compliance-score-${request.id}`}>Conformidade:</label>
                  <input
                    id={`compliance-score-${request.id}`}
                    type="number"
                    min={0}
                    max={100}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder="—"
                    className="w-14 rounded border border-control px-1.5 py-0.5 text-xs"
                  />
                  %
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const v = scoreInput.trim();
                      if (v === '') return onSetCompliance(null);
                      const n = Math.max(0, Math.min(100, Math.round(Number(v))));
                      if (Number.isFinite(n)) onSetCompliance(n);
                    }}
                    aria-label="Salvar conformidade"
                    className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    Salvar
                  </button>
                </span>
                {showIlpiAreaScores && onSetAreaScores && (
                  <span className="flex items-center gap-1 text-xs text-navy-3">
                    <Gauge className="h-3.5 w-3.5 text-indigo-600" />
                    <span id={`area-scores-label-${request.id}`}>Por área (ILPI):</span>
                    <label htmlFor={`sanitary-score-${request.id}`} className="text-[11px] font-semibold text-navy-3">
                      San
                    </label>
                    <input
                      id={`sanitary-score-${request.id}`}
                      type="number"
                      min={0}
                      max={100}
                      value={sanitaryInput}
                      onChange={(e) => setSanitaryInput(e.target.value)}
                      placeholder="—"
                      className="w-12 rounded border border-control px-1.5 py-0.5 text-xs"
                    />
                    <label htmlFor={`nutrition-score-${request.id}`} className="text-[11px] font-semibold text-navy-3">
                      Nut
                    </label>
                    <input
                      id={`nutrition-score-${request.id}`}
                      type="number"
                      min={0}
                      max={100}
                      value={nutritionInput}
                      onChange={(e) => setNutritionInput(e.target.value)}
                      placeholder="—"
                      className="w-12 rounded border border-control px-1.5 py-0.5 text-xs"
                    />
                    %
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const parse = (v: string): number | null => {
                          const t = v.trim();
                          if (t === '') return null;
                          const n = Math.max(0, Math.min(100, Math.round(Number(t))));
                          return Number.isFinite(n) ? n : null;
                        };
                        onSetAreaScores(parse(sanitaryInput), parse(nutritionInput));
                      }}
                      aria-label="Salvar pontuação por área"
                      className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      Salvar
                    </button>
                  </span>
                )}
              </div>
            </div>
            {busy && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-600" aria-hidden="true" />}
          </div>

          {request.attendance_mode === 'online' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <label htmlFor={`meeting-url-${request.id}`} className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Video className="h-4 w-4 text-blue-700" /> Link da videoconferência
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id={`meeting-url-${request.id}`}
                  type="url"
                  inputMode="url"
                  value={meetingUrl}
                  onChange={(event) => {
                    setMeetingUrl(event.target.value);
                    setMeetingSaved(false);
                  }}
                  placeholder="https://meet.google.com/..."
                  className="h-11 min-w-0 flex-1 rounded-lg border border-control bg-surface px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={meetingBusy} onClick={() => void saveMeetingUrl()}>
                  {meetingBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Video className="mr-1.5 h-4 w-4" />}
                  Salvar link
                </Button>
                {meetingUrl.trim().startsWith('https://') && (
                  <a href={meetingUrl.trim()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                    Abrir
                  </a>
                )}
              </div>
              {meetingSaved && <p role="status" className="mt-1 text-xs font-medium text-emerald-700">Link salvo e disponível no portal do cliente.</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-default pt-3">
            <input
              ref={reportInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Selecionar arquivo do relatório em PDF"
              onChange={(e) => {
                onPublishReport(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              aria-label="Selecionar arquivo de anexo"
              onChange={(e) => {
                onAddAttachment(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />

            {(request.status === 'confirmed' || request.status === 'rescheduled') && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onMarkInProgress}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Play className="mr-1.5 h-4 w-4" /> Iniciar inspeção
              </Button>
            )}
            {onReschedule && (request.status === 'confirmed' || request.status === 'rescheduled') && (
              <Button variant="outline" size="sm" disabled={busy} onClick={onReschedule}>
                <CalendarDays className="mr-1.5 h-4 w-4" /> Remarcar
              </Button>
            )}
            {onRetryNotification && (request.status === 'confirmed' || request.status === 'rescheduled') && (
              notificationStatus?.status === 'sent' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={onRetryNotification}
                  title={notificationStatus.sentAt ? `Enviado em ${formatCreatedAt(notificationStatus.sentAt)}. Clicar não reenvia — só confirma que já foi entregue.` : undefined}
                  className="min-h-11 border-green-200 text-green-700 hover:bg-green-50"
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" /> E-mail já enviado
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={onRetryNotification}
                  className="min-h-11 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar enviar confirmação
                </Button>
              )
            )}
            {request.status === 'in_progress' && onMarkCompleted && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onMarkCompleted}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCircle className="mr-1.5 h-4 w-4" /> Inspeção concluída
              </Button>
            )}
            {request.status === 'in_progress' && onMarkNotCompleted && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onMarkNotCompleted}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Não realizada
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => reportInputRef.current?.click()}
              className="text-green-700 border-green-200 hover:bg-green-50"
            >
              <FileUp className="mr-1.5 h-4 w-4" /> Publicar relatório
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={onAddPhotos}>
              <ImagePlus className="mr-1.5 h-4 w-4" /> Adicionar fotos
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Paperclip className="mr-1.5 h-4 w-4" /> Adicionar anexo
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={onSetDueDate}>
              <Clock className="mr-1.5 h-4 w-4" /> Prazo manual
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setShowActionPlan(true)}>
              <ClipboardList className="mr-1.5 h-4 w-4" /> Plano de ação
            </Button>
            {request.status === 'report_available' && onShareWhatsapp && (
              <Button variant="outline" size="sm" disabled={busy} onClick={onShareWhatsapp}>
                <Phone className="mr-1.5 h-4 w-4" /> WhatsApp
              </Button>
            )}
            {(request.status === 'report_available' || request.report_pdf_path) && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onToggleReportHidden}
                className={request.report_hidden
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border-default text-navy-2 hover:bg-surface-hover'}
              >
                {request.report_hidden
                  ? <><Eye className="mr-1.5 h-4 w-4" /> Mostrar ao cliente</>
                  : <><EyeOff className="mr-1.5 h-4 w-4" /> Ocultar do cliente</>}
              </Button>
            )}
            {!isClosed && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={onCancel}
                className="ml-auto text-red-500 hover:bg-red-50"
                aria-label="Cancelar solicitação"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onDelete}
              className={`${isClosed ? 'ml-auto' : ''} text-red-600 hover:bg-red-50`}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir
            </Button>
          </div>

          <PublishedFilesPanel requestId={request.id} busy={busy} />
        </div>
      </CardContent>

      {showActionPlan && (
        <ActionPlanModal
          requestId={request.id}
          title={request.unit_name}
          onClose={() => setShowActionPlan(false)}
        />
      )}
    </Card>
  );
}
