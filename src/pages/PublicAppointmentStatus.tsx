import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  FileText,
  FileType,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Monitor,
  Paperclip,
  Plus,
  RefreshCw,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import type { AppointmentAttachment, PublicAppointmentStatusResult } from '../types';
import { clientPortalService, type ClientPortalUnit } from '../services/clientPortalService';
import { formatReportDueDate } from '../utils/businessDays';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatProtocol } from '../utils/protocol';
import { APPOINTMENT_TYPE_RULES, normalizeAppointmentType } from '../utils/appointmentType';
import { buildIcs, downloadIcs } from '../utils/ics';
import { buildGoogleCalendarLink, buildOutlookCalendarLink } from '../utils/calendarLinks';
import { ContractTimeline } from '../components/portal/ContractTimeline';

const PERIOD_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
};

interface TimelineStep {
  label: string;
  description?: string;
}

const SANITARY_TIMELINE_STEPS: TimelineStep[] = [
  { label: 'Solicitação recebida' },
  { label: 'Confirmada / Agendada' },
  { label: 'Inspeção em andamento' },
  { label: 'Inspeção finalizada' },
  { label: 'Relatório em andamento' },
  { label: 'Relatório disponível' },
];

const SIMPLE_TIMELINE_STEPS: TimelineStep[] = [
  { label: 'Solicitada' },
  { label: 'Confirmada' },
  { label: 'Realizada' },
];

/** Índice da etapa ATUAL na linha do tempo sanitária (inspeção) para cada status. */
function sanitaryStepIndex(status: PublicAppointmentStatusResult['status']): number {
  switch (status) {
    case 'requested': return 0;
    case 'confirmed': return 1;
    case 'rescheduled': return 1; // aguardando nova confirmação de data
    case 'in_progress': return 2;
    case 'completed': return 4;
    case 'report_available': return 5;
    case 'cancelled': return -1;
    default: return 0;
  }
}

/** Índice da etapa ATUAL na linha do tempo simples (reuniões/orientações) para cada status. */
function simpleStepIndex(status: PublicAppointmentStatusResult['status']): number {
  switch (status) {
    case 'requested': return 0;
    case 'confirmed': return 1;
    case 'rescheduled': return 1;
    case 'in_progress': return 1;
    case 'completed': return 2;
    case 'report_available': return 2;
    case 'cancelled': return -1;
    default: return 0;
  }
}

/** Compromisso confirmado em menos de 48h — aviso simples, calculado na leitura. */
function formatUpcomingBanner(startsAtIso: string | null | undefined): string | null {
  if (!startsAtIso) return null;
  const diffMs = new Date(startsAtIso).getTime() - Date.now();
  if (diffMs <= 0 || diffMs > 48 * 60 * 60 * 1000) return null;
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (hours <= 1) return 'Seu compromisso é em menos de 1 hora.';
  if (hours < 24) return `Seu compromisso é em ${hours}h.`;
  return 'Seu compromisso é amanhã.';
}

function formatDateBR(value: string | null): string {
  if (!value) return '—';
  // datas vêm como YYYY-MM-DD — evitar deslocamento de fuso
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function attachmentIcon(asset: AppointmentAttachment) {
  const name = (asset.file_name || '').toLowerCase();
  const mime = (asset.mime_type || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
    return <FileType className="h-5 w-5 text-blue-600" />;
  }
  if (mime.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-emerald-600" />;
  return <Paperclip className="h-5 w-5 text-gray-500" />;
}

export function PublicAppointmentStatus() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<PublicAppointmentStatusResult | null>(null);
  const [assets, setAssets] = useState<AppointmentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [unit, setUnit] = useState<ClientPortalUnit | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!token) {
      setInvalidToken(true);
      setLoading(false);
      return;
    }
    const accountToken = clientPortalService.getStoredToken();
    if (!accountToken) {
      setInvalidToken(true);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    try {
      const result = await clientPortalService.appointmentDetails(accountToken, token);
      setStatus(result.status);
      setAssets(result.assets || []);
      setInvalidToken(false);
      void clientPortalService.audit(accountToken, 'appointment_viewed', {
        unit_name: result.status.unit_name,
        status: result.status.status,
      }, { appointmentToken: token });
      // Cronograma do contrato: busca a unidade do cliente no overview do portal.
      if (result.status.client_id) {
        clientPortalService.overview(accountToken)
          .then((overview) => {
            setUnit(overview.units.find((u) => u.client_id === result.status.client_id) || null);
          })
          .catch((err) => console.warn('[PublicAppointmentStatus] Falha ao carregar cronograma:', err));
      }
    } catch (err) {
      console.warn('[PublicAppointmentStatus] Token inválido ou erro de consulta:', err);
      setInvalidToken(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─── Loading inicial ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-600" />
          <p className="text-sm text-gray-500">Consultando sua solicitação...</p>
        </div>
      </div>
    );
  }

  // ─── Token inválido ──────────────────────────────────────────
  if (invalidToken || !status) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <main className="mx-auto max-w-[600px] px-4 py-12">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Acesso restrito</h2>
            <p className="mt-2 text-sm text-gray-600">
              Entre no Portal do Cliente com e-mail/usuario e senha para consultar relatorios, fotos e anexos.
            </p>
            <Link
              to="/cliente"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <Home className="h-4 w-4" />
              Entrar no portal
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const appointmentType = normalizeAppointmentType(status.appointment_type);
  const typeRules = APPOINTMENT_TYPE_RULES[appointmentType];
  const timelineSteps = typeRules.usesSanitaryTimeline ? SANITARY_TIMELINE_STEPS : SIMPLE_TIMELINE_STEPS;
  const stepIndex = typeRules.usesSanitaryTimeline ? sanitaryStepIndex(status.status) : simpleStepIndex(status.status);
  const isCancelled = status.status === 'cancelled';
  const isRescheduled = status.status === 'rescheduled';
  const reportPdf = assets.find((a) => a.kind === 'report_pdf' && a.signed_url);
  const photos = assets.filter((a) => a.kind === 'photo' && a.signed_url);
  const attachments = assets.filter((a) => a.kind === 'attachment');
  // PORT-01: suspensão de agendamento não bloqueia mais o que já foi entregue. O que bloqueia
  // arquivo é a trava por conta — e quando ela está ligada a Edge Function nem devolve o
  // anexo, então "bloqueado" aqui é só o que a consultora fechou de propósito.
  const gates = status.feature_gates || {};
  const reportsBlocked = gates.reports === false;
  const photosBlocked = gates.photos === false;
  const suspended = reportsBlocked || photosBlocked;
  const hasReport = assets.some((a) => a.kind === 'report_pdf');
  const photoCount = assets.filter((a) => a.kind === 'photo').length;
  const hasDeliverables = hasReport || photoCount > 0 || attachments.length > 0;
  const accountToken = clientPortalService.getStoredToken();
  const canAddToCalendar = ['confirmed', 'in_progress'].includes(status.status)
    && !!status.requested_starts_at && !!status.requested_ends_at;
  const upcomingBanner = ['confirmed', 'in_progress'].includes(status.status)
    ? formatUpcomingBanner(status.requested_starts_at)
    : null;
  const calendarInput = canAddToCalendar ? {
    subject: status.subject || typeRules.label,
    startsAt: status.requested_starts_at as string,
    endsAt: status.requested_ends_at as string,
    location: status.attendance_mode === 'online' ? 'Online' : (status.municipality || status.district),
    meetingUrl: status.meeting_url,
  } : null;
  const handleDownloadIcs = () => {
    if (!calendarInput) return;
    const ics = buildIcs({
      id: status.id,
      subject: calendarInput.subject,
      startsAt: calendarInput.startsAt,
      endsAt: calendarInput.endsAt,
      location: calendarInput.location,
      meetingUrl: calendarInput.meetingUrl,
      updatedAt: status.updated_at,
      status: 'confirmed',
    });
    downloadIcs(`compromisso-${formatProtocol(token || '')}`, ics);
  };
  const auditAsset = (
    eventType: 'report_download_clicked' | 'attachment_download_clicked' | 'photo_download_clicked',
    asset: AppointmentAttachment
  ) => {
    if (!accountToken || !token) return;
    void clientPortalService.audit(accountToken, eventType, {
      file_name: asset.file_name,
      kind: asset.kind,
      caption: asset.caption,
    }, { appointmentToken: token, attachmentId: asset.id });
  };

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-16 sm:px-6">
        <Link
          to="/cliente"
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <Home className="h-4 w-4" />
          Voltar ao painel do cliente
        </Link>

        {/* Protocolo */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-5 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Protocolo</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-gray-900">
            {formatProtocol(token || '')}
          </p>
        </div>

        {/* Banners de estado especial */}
        {isCancelled && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-700">Solicitação cancelada</p>
              <p className="mt-0.5 text-xs text-red-600">
                Esta solicitação foi cancelada. Se precisar, faça um novo agendamento.
              </p>
            </div>
          </div>
        )}
        {isRescheduled && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Inspeção remarcada</p>
              <p className="mt-0.5 text-xs text-amber-600">
                A data da sua inspeção está sendo reagendada. Nossa equipe entrará em contato para
                confirmar a nova data.
              </p>
              {status.notes && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-100/60 p-2.5">
                  <p className="text-xs font-semibold text-amber-800">Motivo informado pela equipe:</p>
                  <p className="mt-0.5 text-xs text-amber-700">{status.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {suspended && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-700">Arquivos temporariamente indisponíveis</p>
              <p className="mt-0.5 text-xs text-red-600">
                {reportsBlocked && photosBlocked
                  ? 'O relatório, as fotos e os anexos desta inspeção'
                  : reportsBlocked
                    ? 'O relatório e os anexos desta inspeção'
                    : 'As fotos desta inspeção'}{' '}
                não estão disponíveis no momento. Fale com a equipe da consultoria para liberar.
              </p>
              {status.payment_due_date && (
                <p className="mt-1 text-xs font-semibold text-red-700">
                  Vencimento: {formatDateBR(status.payment_due_date)}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  to="/cliente"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Home className="h-3.5 w-3.5" /> Ver pagamento no portal
                </Link>
                {status.payment_link && (
                  <a
                    href={status.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Pagar agora
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {upcomingBanner && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4">
            <CalendarClock className="h-5 w-5 shrink-0 text-primary-600" />
            <p className="text-sm font-semibold text-primary-800">{upcomingBanner}</p>
          </div>
        )}

        {/* Linha do tempo */}
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Andamento
          </h3>
          <ol className="space-y-0">
            {timelineSteps.map((step, i) => {
              const done = !isCancelled && i < stepIndex;
              const current = !isCancelled && i === stepIndex;
              const isLast = i === timelineSteps.length - 1;
              return (
                <li key={step.label} className="relative flex gap-3 pb-1">
                  {/* Conector vertical */}
                  {!isLast && (
                    <span
                      className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${
                        done ? 'bg-primary-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                      done
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : current
                          ? 'border-primary-600 bg-primary-600 text-white shadow-md shadow-primary-200'
                          : 'border-gray-200 bg-white text-gray-300'
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-[11px] font-bold">{i + 1}</span>
                    )}
                  </span>
                  <div className="pb-5 pt-1">
                    <p
                      className={`text-sm font-medium ${
                        current
                          ? 'font-bold text-primary-700'
                          : done
                            ? 'text-gray-700'
                            : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                      {current && (
                        <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-700">
                          Atual
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Informações da solicitação */}
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Dados da solicitação
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-400">Unidade</dt>
                <dd className="break-words font-medium text-gray-900">{status.unit_name}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-400">Atendimento</dt>
                <dd className="font-medium text-gray-900">{status.district}</dd>
                {status.attendance_mode === 'presencial' && status.municipality && (
                  <dd className="text-xs text-gray-500">{status.municipality}</dd>
                )}
                {status.attendance_mode === 'online' && (
                  <dd className="flex items-center gap-1 text-xs text-gray-500">
                    <Monitor className="h-3 w-3" /> Online
                  </dd>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-400">Data solicitada</dt>
                <dd className="font-medium text-gray-900">
                  {formatDateBR(status.requested_date)}
                  {status.requested_time ? ` às ${status.requested_time}` : ''}
                  {status.requested_period && PERIOD_LABELS[status.requested_period]
                    ? ` — ${PERIOD_LABELS[status.requested_period]}`
                    : status.requested_period
                      ? ` — ${status.requested_period}`
                      : ''}
                </dd>
              </div>
            </div>
          </dl>
        </section>

        {/* Link online — só depois de confirmado (já filtrado pelo backend) */}
        {status.meeting_url && (
          <section className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-700">
              <Video className="h-4 w-4" /> Link da reunião
            </h3>
            <a
              href={status.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <Video className="h-4 w-4" />
              Entrar na reunião
            </a>
          </section>
        )}

        {/* Adicionar ao calendário — só quando o compromisso está confirmado */}
        {calendarInput && (
          <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
              <CalendarPlus className="h-4 w-4" /> Adicionar ao calendário
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadIcs}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" /> Baixar .ics
              </button>
              <a
                href={buildGoogleCalendarLink(calendarInput)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Google Calendar
              </a>
              <a
                href={buildOutlookCalendarLink(calendarInput)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Outlook
              </a>
            </div>
          </section>
        )}

        {/* Prazo do relatório */}
        {!isCancelled && typeRules.showsReportDueDate && (
          <section className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary-700">
              Prazo do relatório
            </h3>
            <p className="text-sm font-medium text-gray-800">
              {formatReportDueDate(status.report_due_at, status.report_due_source)}
            </p>
          </section>
        )}

        {unit && <ContractTimeline unit={unit} />}

        {status.has_personalized_sanitary_folder && status.personalized_sanitary_folder_url && (
          <section className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Pasta sanitaria personalizada
            </h3>
            <a
              href={status.personalized_sanitary_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <FolderOpen className="h-4 w-4" />
              Abrir pasta no Drive
            </a>
          </section>
        )}

        {/* Relatório e anexos — só exibe quando há algo publicado ou quando o status indica disponibilidade */}
        {(status.status === 'report_available' || hasDeliverables) ? (
        <section className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-green-700">
              Relatório, fotos e anexos
            </h3>

            {reportPdf ? (
              <a
                href={reportPdf.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => auditAsset('report_download_clicked', reportPdf)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                Baixar relatório (PDF)
              </a>
            ) : suspended && hasReport ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Relatório disponível — indisponível no momento</p>
                  <p className="mt-0.5 text-xs text-red-600">
                    O relatório desta inspeção já está pronto, mas não está liberado no seu portal
                    agora. Fale com a equipe da consultoria.
                  </p>
                </div>
              </div>
            ) : status.status === 'report_available' ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                O relatório está sendo disponibilizado. Atualize a página em alguns instantes.
              </div>
            ) : null}

            {photos.length > 0 ? (
              <div className="mt-6">
                <h4 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <span>Fotos da inspeção</span>
                  <span className="text-gray-400">{photos.length} foto{photos.length === 1 ? '' : 's'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    if (accountToken && token) {
                      void clientPortalService.audit(accountToken, 'photo_gallery_opened', {
                        photo_count: photos.length,
                      }, { appointmentToken: token });
                    }
                    setShowGallery(true);
                    setLightboxIndex(0);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-5 py-3 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                >
                  <ImageIcon className="h-4 w-4" />
                  Ver galeria de fotos ({photos.length})
                </button>
              </div>
            ) : suspended && photoCount > 0 ? (
              <div className="mt-6">
                <h4 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <span>Fotos da inspeção</span>
                  <span className="text-gray-400">{photoCount} foto{photoCount === 1 ? '' : 's'}</span>
                </h4>
                <div className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600">
                  <Lock className="h-4 w-4" />
                  Galeria não liberada no momento
                </div>
              </div>
            ) : null}

            {attachments.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Anexos
                </h4>
                <ul className="space-y-2">
                  {attachments.map((asset) => (
                    <li key={asset.id}>
                      {asset.signed_url ? (
                        <a
                          href={asset.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => auditAsset('attachment_download_clicked', asset)}
                          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                        >
                          {attachmentIcon(asset)}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                            {asset.file_name || 'Anexo'}
                          </span>
                          <Download className="h-4 w-4 shrink-0 text-gray-400" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 opacity-70">
                          {suspended ? <Lock className="h-5 w-5 shrink-0 text-red-500" /> : attachmentIcon(asset)}
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                            {asset.file_name || 'Anexo'} (indisponível)
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}

        {/* Ações */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar status
          </button>

          <Link
            to="/agendar"
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            <Plus className="h-4 w-4" />
            Fazer nova solicitação
          </Link>
        </div>
      </main>

      {showGallery && lightboxIndex !== null && photos[lightboxIndex] && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onDownload={(asset) => auditAsset('photo_download_clicked', asset)}
          onClose={() => {
            setShowGallery(false);
            setLightboxIndex(null);
          }}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

// ─── Lightbox de fotos (tela cheia + carrossel) ───────────────

interface PhotoLightboxProps {
  photos: AppointmentAttachment[];
  index: number;
  onDownload: (asset: AppointmentAttachment) => void;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

function PhotoLightbox({ photos, index, onClose, onNavigate, onDownload }: PhotoLightboxProps) {
  const photo = photos[index];
  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + photos.length) % photos.length;
      onNavigate(next);
    },
    [index, photos.length, onNavigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [go, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <span className="text-sm font-medium">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          {photo.signed_url && (
            <a
              href={photo.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(photo);
              }}
              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              title="Baixar foto"
            >
              <Download className="h-5 w-5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-4">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4 sm:p-3"
            title="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <figure className="flex max-h-full max-w-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
          <img
            src={photo.signed_url}
            alt={photo.caption || 'Foto da inspeção'}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          {photo.caption && (
            <figcaption className="mt-3 max-w-2xl px-4 text-center text-sm text-white/80">
              {photo.caption}
            </figcaption>
          )}
        </figure>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4 sm:p-3"
            title="Próxima"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onNavigate(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${
                i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={p.signed_url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
