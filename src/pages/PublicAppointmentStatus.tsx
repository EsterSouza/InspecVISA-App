import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
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
import {
  clientPortalService,
  type ClientPortalActionItem,
  type ClientPortalUnit,
} from '../services/clientPortalService';
import {
  PortalActionPlan,
  type DeclareStatusHandler,
  type SubmitEvidenceHandler,
} from '../components/client/PortalActionPlan';
import { formatReportDueDate } from '../utils/businessDays';
import { PublicShell } from '../components/public/PublicShell';
import { Badge, type BadgeProps } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { buttonVariants } from '../components/ui/buttonVariants';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/utils';
import { formatProtocol } from '../utils/protocol';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_TYPE_RULES, normalizeAppointmentType } from '../utils/appointmentType';
import { buildIcs, downloadIcs } from '../utils/ics';
import { buildGoogleCalendarLink, buildOutlookCalendarLink } from '../utils/calendarLinks';
import { ContractTimeline } from '../components/portal/ContractTimeline';

/** Três canais, não só cor: o selo carrega a palavra e a linha do tempo carrega a posição. */
const STATUS_TONES: Record<string, BadgeProps['variant']> = {
  requested: 'warning',
  confirmed: 'default',
  in_progress: 'default',
  rescheduled: 'warning',
  completed: 'success',
  report_available: 'success',
  cancelled: 'neutral',
};

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

/**
 * O tipo do arquivo é dito pela forma do ícone e pelo nome, não pela cor: vermelho
 * e verde têm significado fixo no sistema (erro e sucesso) e um PDF não é um erro.
 */
function attachmentIcon(asset: AppointmentAttachment) {
  const name = (asset.file_name || '').toLowerCase();
  const mime = (asset.mime_type || '').toLowerCase();
  const className = 'h-5 w-5 shrink-0 text-navy-2';
  if (mime.includes('pdf') || name.endsWith('.pdf')) return <FileText className={className} aria-hidden="true" />;
  if (mime.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
    return <FileType className={className} aria-hidden="true" />;
  }
  if (mime.startsWith('image/')) return <ImageIcon className={className} aria-hidden="true" />;
  return <Paperclip className={className} aria-hidden="true" />;
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
  const [actionItems, setActionItems] = useState<ClientPortalActionItem[]>([]);
  const [actionItemsError, setActionItemsError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!token) {
      setInvalidToken(true);
      setLoading(false);
      return;
    }
    // PORT-02: o link do relatório abre sozinho. Antes, sem o token da conta no navegador, a
    // página respondia "acesso restrito" — o que inviabilizava dar acesso ao gestor de uma casa
    // da rede sem entregar o login do dono do contrato, que abre todas. Quem está logado
    // continua entrando pelo mesmo caminho, com as travas da conta valendo.
    const accountToken = clientPortalService.getStoredToken();
    if (isRefresh) setRefreshing(true);
    try {
      const result = await clientPortalService.appointmentDetails(accountToken, token);
      setStatus(result.status);
      setAssets(result.assets || []);
      setInvalidToken(false);

      // O plano de ação vem pela RPC do link, que não pede conta. Falha aqui não derruba o
      // relatório: o gestor ainda precisa conseguir baixar o PDF.
      clientPortalService
        .reportActionItems(token)
        .then((plan) => {
          setActionItems(plan.items);
          setActionItemsError(false);
        })
        .catch((err) => {
          console.warn('[PublicAppointmentStatus] Falha ao carregar o plano de acao:', err);
          setActionItemsError(true);
        });

      if (accountToken) {
        void clientPortalService.audit(accountToken, 'appointment_viewed', {
          unit_name: result.status.unit_name,
          status: result.status.status,
        }, { appointmentToken: token });
        // Cronograma do contrato: só existe para quem entrou pela conta.
        if (result.status.client_id) {
          clientPortalService.overview(accountToken)
            .then((overview) => {
              setUnit(overview.units.find((u) => u.client_id === result.status.client_id) || null);
            })
            .catch((err) => console.warn('[PublicAppointmentStatus] Falha ao carregar cronograma:', err));
        }
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

  // O envio sempre vai pelo token da VISITA, mesmo quando a pessoa está logada: quem abre esta
  // tela está olhando o relatório de uma casa específica, e é a ela que a evidência pertence.
  const handleSubmitEvidence: SubmitEvidenceHandler = useCallback(
    async ({ item, file, uploadKey, note, byName, byRole }) => {
      if (!token) throw new Error('Link inválido.');
      await clientPortalService.submitReportEvidence(token, {
        actionItemId: item.id,
        uploadKey,
        file,
        note,
        byName,
        byRole,
      });
      const plan = await clientPortalService.reportActionItems(token);
      setActionItems(plan.items);
    },
    [token]
  );

  // PORT-03: "já corrigi", "estou providenciando" ou "ainda não fiz" — este último com motivo.
  const handleDeclareStatus: DeclareStatusHandler = useCallback(
    async ({ item, status, note, byName, byRole }) => {
      if (!token) throw new Error('Link inválido.');
      await clientPortalService.setItemStatus(
        { visitToken: token },
        { actionItemId: item.id, status, note, byName, byRole }
      );
      const plan = await clientPortalService.reportActionItems(token);
      setActionItems(plan.items);
    },
    [token]
  );

  // ─── Loading inicial ─────────────────────────────────────────
  if (loading) {
    return (
      <PublicShell role="status" aria-live="polite">
        <Skeleton className="mb-6 h-24 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <span className="sr-only">Consultando sua solicitação...</span>
      </PublicShell>
    );
  }

  // ─── Link que não abre nada ──────────────────────────────────
  if (invalidToken || !status) {
    return (
      <PublicShell>
        <Card className="border-amber-soft-border bg-amber-soft/70 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-strong" aria-hidden="true" />
          <h1 className="font-title text-xl font-semibold text-navy">Não encontramos esta solicitação</h1>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm text-navy-2">
            O link pode ter vindo incompleto ou já não valer mais. Confira o endereço que você
            recebeu ou entre no Portal do Cliente com seu e-mail e senha para ver relatórios, fotos
            e anexos de todas as suas unidades.
          </p>
          <Link to="/cliente" className={cn(buttonVariants(), 'mt-6 gap-2')}>
            <Home className="h-4 w-4" aria-hidden="true" />
            Entrar no portal
          </Link>
        </Card>
      </PublicShell>
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
  const statusLabel = APPOINTMENT_STATUS_LABELS[status.status] || status.status;
  const statusTone = STATUS_TONES[status.status] || 'neutral';

  return (
    <PublicShell>
      {accountToken && (
        <Link
          to="/cliente"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-accent-ink underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao Portal do Cliente
        </Link>
      )}

      <div className="mb-6">
        <p className="text-sm font-semibold text-accent-ink">Acompanhamento</p>
        <h1 className="mt-1 font-title text-2xl font-semibold text-navy">{typeRules.label}</h1>
        <p className="mt-1 break-words text-sm text-navy-2">{status.unit_name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant={statusTone}>{statusLabel}</Badge>
          <span className="text-sm text-navy-2">
            Protocolo{' '}
            <strong className="font-semibold tracking-widest tabular-nums text-navy">
              {formatProtocol(token || '')}
            </strong>
          </span>
        </div>
      </div>

      {upcomingBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4">
          <CalendarClock className="h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-navy">{upcomingBanner}</p>
        </div>
      )}

      {isCancelled && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-soft-border bg-danger-soft p-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-soft-ink" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-danger-soft-ink">Solicitação cancelada</p>
            <p className="mt-0.5 text-sm text-danger-soft-ink">
              Esta solicitação foi cancelada. Se ainda precisar do atendimento, faça um novo pedido
              de horário.
            </p>
          </div>
        </div>
      )}

      {isRescheduled && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-soft-border bg-amber-soft p-4">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-soft-ink" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-soft-ink">Data sendo remarcada</p>
            <p className="mt-0.5 text-sm text-amber-soft-ink">
              A equipe entra em contato para combinar a nova data com você.
            </p>
            {status.notes && (
              <div className="mt-2 rounded-md border border-amber-soft-border bg-surface p-2.5">
                <p className="text-sm font-semibold text-amber-soft-ink">Motivo informado pela equipe</p>
                <p className="mt-0.5 break-words text-sm text-navy-2">{status.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {suspended && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-soft-border bg-danger-soft p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-danger-soft-ink" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-danger-soft-ink">Arquivos indisponíveis no momento</p>
            <p className="mt-0.5 text-sm text-danger-soft-ink">
              {reportsBlocked && photosBlocked
                ? 'O relatório, as fotos e os anexos desta visita'
                : reportsBlocked
                  ? 'O relatório e os anexos desta visita'
                  : 'As fotos desta visita'}{' '}
              não estão liberados agora. Fale com a equipe da consultoria para liberar.
            </p>
            {status.payment_due_date && (
              <p className="mt-1 text-sm font-semibold text-danger-soft-ink">
                Vencimento: {formatDateBR(status.payment_due_date)}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/cliente" className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5 bg-surface')}>
                <Home className="h-4 w-4" aria-hidden="true" /> Ver pagamento no portal
              </Link>
              {status.payment_link && (
                <a
                  href={status.payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants(), 'gap-1.5')}
                >
                  Pagar agora
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Encontro marcado: enquanto ele não acontece, entrar na sala e guardar a data são as
          únicas coisas que a pessoa veio fazer aqui. */}
      {(status.meeting_url || calendarInput) && (
        <Card className="mb-6 p-4 sm:p-5">
          {status.meeting_url && (
            <>
              <h2 className="flex items-center gap-2 font-title text-base font-semibold text-navy">
                <Video className="h-4 w-4 text-primary-700" aria-hidden="true" /> Sala da reunião
              </h2>
              <a
                href={status.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ fullWidth: true }), 'mt-3 gap-2 py-3')}
              >
                <Video className="h-4 w-4" aria-hidden="true" />
                Entrar na reunião
              </a>
            </>
          )}
          {calendarInput && (
            <div className={status.meeting_url ? 'mt-5 border-t border-default pt-5' : undefined}>
              <h2 className="flex items-center gap-2 font-title text-base font-semibold text-navy">
                <CalendarPlus className="h-4 w-4 text-primary-700" aria-hidden="true" /> Guardar no seu calendário
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleDownloadIcs} className="gap-2 bg-surface">
                  <Download className="h-4 w-4" aria-hidden="true" /> Baixar .ics
                </Button>
                <a
                  href={buildGoogleCalendarLink(calendarInput)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }), 'bg-surface')}
                >
                  Google Agenda
                </a>
                <a
                  href={buildOutlookCalendarLink(calendarInput)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }), 'bg-surface')}
                >
                  Outlook
                </a>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* PORT-02/03: o plano de ação vem antes do andamento e dos dados. Quando o relatório é
          aberto pelo link, é para isto que o gestor da casa entra — responder o que já corrigiu,
          anexar a prova ou avisar o que ainda não deu para fazer. */}
      <PortalActionPlan
        items={actionItems}
        error={actionItemsError}
        onSubmitEvidence={handleSubmitEvidence}
        onDeclareStatus={handleDeclareStatus}
        alwaysShow
        defaultAuthorName={status.unit_name}
      />

      {/* Relatório e anexos — só quando há algo publicado ou o status indica disponibilidade */}
      {(status.status === 'report_available' || hasDeliverables) && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="font-title text-base font-semibold text-navy">Relatório, fotos e anexos</h2>

          {reportPdf ? (
            <a
              href={reportPdf.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => auditAsset('report_download_clicked', reportPdf)}
              className={cn(buttonVariants({ fullWidth: true }), 'mt-4 gap-2 py-3')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar relatório (PDF)
            </a>
          ) : suspended && hasReport ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-danger-soft-border bg-danger-soft p-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-danger-soft-ink" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-danger-soft-ink">Relatório pronto, ainda não liberado</p>
                <p className="mt-0.5 text-sm text-danger-soft-ink">
                  O relatório desta visita já existe, mas não está liberado no seu portal agora.
                  Fale com a equipe da consultoria.
                </p>
              </div>
            </div>
          ) : status.status === 'report_available' ? (
            <p className="mt-4 rounded-md border border-dashed border-control bg-surface-sunken p-4 text-sm text-navy-2">
              O relatório está sendo publicado. Atualize a página em alguns instantes.
            </p>
          ) : null}

          {photos.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold text-navy-2">
                <span>Fotos da visita</span>
                <span className="tabular-nums">{photos.length} foto{photos.length === 1 ? '' : 's'}</span>
              </h3>
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => {
                  if (accountToken && token) {
                    void clientPortalService.audit(accountToken, 'photo_gallery_opened', {
                      photo_count: photos.length,
                    }, { appointmentToken: token });
                  }
                  setShowGallery(true);
                  setLightboxIndex(0);
                }}
                className="gap-2 bg-surface py-3"
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                Ver as {photos.length} fotos
              </Button>
            </div>
          ) : suspended && photoCount > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold text-navy-2">
                <span>Fotos da visita</span>
                <span className="tabular-nums">{photoCount} foto{photoCount === 1 ? '' : 's'}</span>
              </h3>
              <p className="flex items-center justify-center gap-2 rounded-md border border-danger-soft-border bg-danger-soft px-5 py-3 text-sm font-semibold text-danger-soft-ink">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Galeria não liberada no momento
              </p>
            </div>
          ) : null}

          {attachments.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-navy-2">Anexos</h3>
              <ul className="space-y-2">
                {attachments.map((asset) => (
                  <li key={asset.id}>
                    {asset.signed_url ? (
                      <a
                        href={asset.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => auditAsset('attachment_download_clicked', asset)}
                        className="flex items-center gap-3 rounded-md border border-default bg-surface-sunken p-3 transition-colors hover:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        {attachmentIcon(asset)}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy">
                          {asset.file_name || 'Anexo'}
                        </span>
                        <Download className="h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 rounded-md border border-default bg-surface-sunken p-3">
                        {suspended ? <Lock className="h-5 w-5 shrink-0 text-navy-2" aria-hidden="true" /> : attachmentIcon(asset)}
                        <span className="min-w-0 flex-1 truncate text-sm text-navy-2">
                          {asset.file_name || 'Anexo'} (indisponível)
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {status.has_personalized_sanitary_folder && status.personalized_sanitary_folder_url && (
        <Card className="mb-6 border-success-soft-border bg-success-soft/60 p-4 sm:p-5">
          <h2 className="font-title text-base font-semibold text-navy">Pasta sanitária personalizada</h2>
          <p className="mt-1 text-sm text-navy-2">
            Seus documentos organizados, sempre atualizados, na nuvem.
          </p>
          <a
            href={status.personalized_sanitary_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ fullWidth: true }), 'mt-4 gap-2 py-3')}
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Abrir a pasta no Drive
          </a>
        </Card>
      )}

      {/* Linha do tempo */}
      <Card className="mb-6 p-4 sm:p-5">
        <h2 className="mb-4 font-title text-base font-semibold text-navy">Em que pé está</h2>
        <ol className="space-y-0">
          {timelineSteps.map((step, i) => {
            const done = !isCancelled && i < stepIndex;
            const current = !isCancelled && i === stepIndex;
            const isLast = i === timelineSteps.length - 1;
            return (
              <li key={step.label} className="relative flex gap-3 pb-1">
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${done ? 'bg-primary-700' : 'bg-surface-sunken'}`}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    done
                      ? 'border-primary-700 bg-primary-700 text-on-accent'
                      : current
                        ? 'border-primary-700 bg-primary-50 text-primary-800'
                        : 'border-control bg-surface text-navy-2'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <span className="text-[11px] font-bold tabular-nums">{i + 1}</span>}
                </span>
                <div className="pb-5 pt-1">
                  <p className={`text-sm ${current ? 'font-bold text-navy' : done ? 'font-medium text-navy-2' : 'text-navy-2'}`}>
                    {step.label}
                    {current && (
                      <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold uppercase text-primary-800">
                        Agora
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Informações da solicitação */}
      <Card className="mb-6 p-4 sm:p-5">
        <h2 className="mb-4 font-title text-base font-semibold text-navy">O que foi combinado</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-sm text-navy-2">Atendimento</dt>
              <dd className="break-words font-medium text-navy">{status.district}</dd>
              {status.attendance_mode === 'presencial' && status.municipality && (
                <dd className="text-sm text-navy-2">{status.municipality}</dd>
              )}
              {status.attendance_mode === 'online' && (
                <dd className="flex items-center gap-1 text-sm text-navy-2">
                  <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> Online
                </dd>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-sm text-navy-2">Data solicitada</dt>
              <dd className="font-medium tabular-nums text-navy">
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
      </Card>

      {!isCancelled && typeRules.showsReportDueDate && (
        <Card className="mb-6 border-primary-100 bg-primary-50/60 p-4 sm:p-5">
          <h2 className="font-title text-base font-semibold text-navy">Prazo do relatório</h2>
          <p className="mt-1 text-sm font-medium text-navy">
            {formatReportDueDate(status.report_due_at, status.report_due_source)}
          </p>
        </Card>
      )}

      {unit && <ContractTimeline unit={unit} />}

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={() => void load(true)}
          disabled={refreshing}
          className="gap-2 bg-surface py-3"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          Atualizar esta página
        </Button>

        <Link
          to="/agendar"
          className={cn(buttonVariants({ variant: 'ghost', fullWidth: true }), 'gap-2 py-3 text-accent-ink')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Pedir um novo horário
        </Link>
      </div>

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
    </PublicShell>
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

/**
 * `<dialog>` nativo: trap de foco, `Esc` e devolução do foco ao botão de origem
 * vêm de graça — antes era um `<div>` fixo, e o foco continuava correndo a
 * página atrás da galeria. Sobram as setas e a trava de rolagem, escritas aqui.
 */
function PhotoLightbox({ photos, index, onClose, onNavigate, onDownload }: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photo = photos[index];
  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + photos.length) % photos.length;
      onNavigate(next);
    },
    [index, photos.length, onNavigate]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Fotos da visita, ${index + 1} de ${photos.length}`}
      onClose={onClose}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      className="m-0 h-full max-h-none w-full max-w-none bg-deep/95 p-0 text-white backdrop:bg-deep/80"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium tabular-nums">
            {index + 1} / {photos.length}
          </span>
          <div className="flex items-center gap-2">
            {photo.signed_url && (
              <a
                href={photo.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onDownload(photo)}
                aria-label="Baixar esta foto"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar a galeria"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-4">
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute left-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}

          <figure className="flex max-h-full max-w-full flex-col items-center">
            <img
              src={photo.signed_url}
              alt={photo.caption || 'Foto da visita'}
              className="max-h-[80vh] max-w-full rounded-md object-contain"
            />
            {photo.caption && (
              <figcaption className="mt-3 max-w-[68ch] px-4 text-center text-sm text-white/90">
                {photo.caption}
              </figcaption>
            )}
          </figure>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima foto"
              className="absolute right-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onNavigate(i)}
                aria-label={`Ver a foto ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={p.signed_url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
