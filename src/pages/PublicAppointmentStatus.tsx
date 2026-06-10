import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  Download,
  FileText,
  FileType,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { AppointmentAttachment, PublicAppointmentStatusResult } from '../types';
import { publicAppointmentService } from '../services/publicAppointmentService';
import { formatReportDueDate } from '../utils/businessDays';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatProtocol } from '../utils/protocol';

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

const TIMELINE_STEPS: TimelineStep[] = [
  { label: 'Solicitação recebida' },
  { label: 'Confirmada / Agendada' },
  { label: 'Inspeção em andamento' },
  { label: 'Finalizada' },
  { label: 'Relatório em preparação' },
  { label: 'Relatório disponível' },
];

/** Índice da etapa ATUAL na linha do tempo para cada status. */
function currentStepIndex(status: PublicAppointmentStatusResult['status']): number {
  switch (status) {
    case 'requested': return 0;
    case 'confirmed': return 1;
    case 'rescheduled': return 1; // aguardando nova confirmação de data
    case 'in_progress': return 2;
    case 'completed': return 4; // finalizada concluída → relatório em preparação
    case 'report_available': return 5;
    case 'cancelled': return -1;
    default: return 0;
  }
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

  const load = useCallback(async (isRefresh = false) => {
    if (!token) {
      setInvalidToken(true);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    try {
      const result = await publicAppointmentService.getAppointmentStatus(token);
      setStatus(result);
      setInvalidToken(false);

      if (result.status === 'report_available') {
        try {
          const list = await publicAppointmentService.getAppointmentAssets(token);
          setAssets(list);
        } catch (err) {
          console.warn('[PublicAppointmentStatus] Falha ao carregar anexos:', err);
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
            <h2 className="text-lg font-bold text-gray-900">Protocolo não encontrado</h2>
            <p className="mt-2 text-sm text-gray-600">
              Não localizamos nenhuma solicitação com este código. Verifique se o link está completo
              ou faça uma nova solicitação de agendamento.
            </p>
            <Link
              to="/agendar"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Fazer nova solicitação
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const stepIndex = currentStepIndex(status.status);
  const isCancelled = status.status === 'cancelled';
  const isRescheduled = status.status === 'rescheduled';
  const reportPdf = assets.find((a) => a.kind === 'report_pdf' && a.signed_url);
  const photos = assets.filter((a) => a.kind === 'photo' && a.signed_url);
  const attachments = assets.filter((a) => a.kind === 'attachment');

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-[600px] px-4 py-8 pb-16">
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
            </div>
          </div>
        )}

        {/* Linha do tempo */}
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Andamento
          </h3>
          <ol className="space-y-0">
            {TIMELINE_STEPS.map((step, i) => {
              const done = !isCancelled && i < stepIndex;
              const current = !isCancelled && i === stepIndex;
              const isLast = i === TIMELINE_STEPS.length - 1;
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
                <dd className="font-medium text-gray-900">{status.unit_name}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-400">Bairro</dt>
                <dd className="font-medium text-gray-900">{status.district}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-400">Data solicitada</dt>
                <dd className="font-medium text-gray-900">
                  {formatDateBR(status.requested_date)}
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

        {/* Prazo do relatório */}
        {!isCancelled && (
          <section className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary-700">
              Prazo do relatório
            </h3>
            <p className="text-sm font-medium text-gray-800">
              {formatReportDueDate(status.report_due_at, status.report_due_source)}
            </p>
          </section>
        )}

        {/* Relatório e anexos */}
        {status.status === 'report_available' && (
          <section className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-green-700">
              Relatório disponível
            </h3>

            {reportPdf ? (
              <a
                href={reportPdf.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                Baixar relatório (PDF)
              </a>
            ) : (
              <p className="text-sm text-gray-500">
                O relatório está sendo disponibilizado. Atualize a página em alguns instantes.
              </p>
            )}

            {photos.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Fotos da inspeção
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                    >
                      <img
                        src={photo.signed_url}
                        alt={photo.caption || 'Foto da inspeção'}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {photo.caption && (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white">
                          {photo.caption}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

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
                          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                        >
                          {attachmentIcon(asset)}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                            {asset.file_name || 'Anexo'}
                          </span>
                          <Download className="h-4 w-4 shrink-0 text-gray-400" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 opacity-60">
                          {attachmentIcon(asset)}
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
        )}

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
    </div>
  );
}
