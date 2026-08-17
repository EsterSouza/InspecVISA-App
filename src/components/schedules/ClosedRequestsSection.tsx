import { CheckCircle, Trash2 } from 'lucide-react';
import type { AppointmentRequest, Client } from '../../types';
import { Button } from '../ui/Button';
import { STATUS_BADGES, STATUS_LABELS, formatDateBR, usePagedList } from './appointmentRequestsShared';
import { Pager } from './Pager';
import { ActiveRequestCard } from './ActiveRequestCard';
import { shouldShowIlpiAreaScores } from '../../utils/clientCategory';

interface ClosedRequestsSectionProps {
  closed: AppointmentRequest[];
  clients: Client[];
  busy: string | null;
  show: boolean;
  onToggleShow: () => void;
  onPublishReport: (request: AppointmentRequest, file: File | null) => void;
  onAddAttachment: (request: AppointmentRequest, file: File | null) => void;
  onAddPhotos: (request: AppointmentRequest) => void;
  onSetDueDate: (request: AppointmentRequest) => void;
  onCancel: (request: AppointmentRequest) => void;
  onMarkInProgress: (request: AppointmentRequest) => void;
  onShareWhatsapp: (request: AppointmentRequest) => void;
  onSetCompliance: (request: AppointmentRequest, score: number | null) => void;
  onSetAreaScores: (request: AppointmentRequest, sanitary: number | null, nutrition: number | null) => void;
  onToggleReportHidden: (request: AppointmentRequest) => void;
  onDelete: (request: AppointmentRequest) => void;
}

export function ClosedRequestsSection({
  closed,
  clients,
  busy,
  show,
  onToggleShow,
  onPublishReport,
  onAddAttachment,
  onAddPhotos,
  onSetDueDate,
  onCancel,
  onMarkInProgress,
  onShareWhatsapp,
  onSetCompliance,
  onSetAreaScores,
  onToggleReportHidden,
  onDelete,
}: ClosedRequestsSectionProps) {
  const closedPage = usePagedList(closed);

  if (closed.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={onToggleShow}
        aria-expanded={show}
        aria-controls="closed-requests-list"
        className="mb-4 flex items-center text-lg font-semibold text-navy-3 hover:text-navy"
      >
        <CheckCircle className="mr-2 h-5 w-5 text-navy-3" />
        Encerradas ({closed.length}) <span aria-hidden="true">&nbsp;{show ? '▾' : '▸'}</span>
      </button>

      {show && (
        <div id="closed-requests-list" className="grid gap-3">
          {closedPage.items.map((request) =>
            request.status === 'report_available' ? (
              <ActiveRequestCard
                key={request.id}
                request={request}
                showIlpiAreaScores={shouldShowIlpiAreaScores(request, clients)}
                busy={busy === request.id}
                onPublishReport={(file) => onPublishReport(request, file)}
                onAddAttachment={(file) => onAddAttachment(request, file)}
                onAddPhotos={() => onAddPhotos(request)}
                onSetDueDate={() => onSetDueDate(request)}
                onCancel={() => onCancel(request)}
                onMarkInProgress={() => onMarkInProgress(request)}
                onShareWhatsapp={() => onShareWhatsapp(request)}
                onSetCompliance={(score) => onSetCompliance(request, score)}
                onSetAreaScores={(sanitary, nutrition) => onSetAreaScores(request, sanitary, nutrition)}
                onToggleReportHidden={() => onToggleReportHidden(request)}
                onDelete={() => onDelete(request)}
              />
            ) : (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken/60 p-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-navy-3">{request.unit_name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGES[request.status]}`}>
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-navy-3">{formatDateBR(request.requested_date)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === request.id}
                    onClick={() => onDelete(request)}
                    className="text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            )
          )}
          <Pager page={closedPage.page} totalPages={closedPage.totalPages} onChange={closedPage.setPage} />
        </div>
      )}
    </section>
  );
}
