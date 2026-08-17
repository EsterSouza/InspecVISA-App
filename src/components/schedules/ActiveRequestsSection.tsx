import { CheckCircle } from 'lucide-react';
import type { AppointmentRequest, Client } from '../../types';
import { Card } from '../ui/Card';
import { usePagedList } from './appointmentRequestsShared';
import { Pager } from './Pager';
import { ActiveRequestCard } from './ActiveRequestCard';
import { shouldShowIlpiAreaScores } from '../../utils/clientCategory';

interface ActiveRequestsSectionProps {
  active: AppointmentRequest[];
  clients: Client[];
  busy: string | null;
  notificationStatuses: Map<string, { status: string; sentAt: string | null }>;
  show: boolean;
  onToggleShow: () => void;
  onPublishReport: (request: AppointmentRequest, file: File | null) => void;
  onAddAttachment: (request: AppointmentRequest, file: File | null) => void;
  onAddPhotos: (request: AppointmentRequest) => void;
  onSetDueDate: (request: AppointmentRequest) => void;
  onCancel: (request: AppointmentRequest) => void;
  onMarkInProgress: (request: AppointmentRequest) => void;
  onMarkCompleted: (request: AppointmentRequest) => void;
  onMarkNotCompleted: (request: AppointmentRequest) => void;
  onReschedule: (request: AppointmentRequest) => void;
  onRetryNotification: (request: AppointmentRequest) => void;
  onSetCompliance: (request: AppointmentRequest, score: number | null) => void;
  onSetAreaScores: (request: AppointmentRequest, sanitary: number | null, nutrition: number | null) => void;
  onToggleReportHidden: (request: AppointmentRequest) => void;
  onDelete: (request: AppointmentRequest) => void;
}

export function ActiveRequestsSection({
  active,
  clients,
  busy,
  notificationStatuses,
  show,
  onToggleShow,
  onPublishReport,
  onAddAttachment,
  onAddPhotos,
  onSetDueDate,
  onCancel,
  onMarkInProgress,
  onMarkCompleted,
  onMarkNotCompleted,
  onReschedule,
  onRetryNotification,
  onSetCompliance,
  onSetAreaScores,
  onToggleReportHidden,
  onDelete,
}: ActiveRequestsSectionProps) {
  const activePage = usePagedList(active);

  return (
    <section>
      <button
        type="button"
        onClick={onToggleShow}
        aria-expanded={show}
        aria-controls="active-requests-list"
        className="mb-4 flex items-center text-lg font-semibold text-navy hover:text-primary-700"
      >
        <CheckCircle className="mr-2 h-5 w-5 text-primary-600" />
        Solicitações ativas
        {active.length > 0 && (
          <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
            {active.length}
          </span>
        )}
        <span className="ml-2 text-sm text-navy-3" aria-hidden="true">{show ? '▾' : '▸'}</span>
      </button>

      {show && (
        <div id="active-requests-list">
          {active.length === 0 ? (
            <Card className="border-dashed bg-surface-sunken py-10 text-center">
              <p className="text-sm text-navy-3">Nenhuma solicitação ativa no momento.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activePage.items.map((request) => (
                <ActiveRequestCard
                  key={request.id}
                  request={request}
                  showIlpiAreaScores={shouldShowIlpiAreaScores(request, clients)}
                  busy={busy === request.id}
                  notificationStatus={notificationStatuses.get(request.id)}
                  onPublishReport={(file) => onPublishReport(request, file)}
                  onAddAttachment={(file) => onAddAttachment(request, file)}
                  onAddPhotos={() => onAddPhotos(request)}
                  onSetDueDate={() => onSetDueDate(request)}
                  onCancel={() => onCancel(request)}
                  onMarkInProgress={() => onMarkInProgress(request)}
                  onMarkCompleted={() => onMarkCompleted(request)}
                  onMarkNotCompleted={() => onMarkNotCompleted(request)}
                  onReschedule={() => onReschedule(request)}
                  onRetryNotification={() => onRetryNotification(request)}
                  onSetCompliance={(score) => onSetCompliance(request, score)}
                  onSetAreaScores={(sanitary, nutrition) => onSetAreaScores(request, sanitary, nutrition)}
                  onToggleReportHidden={() => onToggleReportHidden(request)}
                  onDelete={() => onDelete(request)}
                />
              ))}
              <Pager page={activePage.page} totalPages={activePage.totalPages} onChange={activePage.setPage} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
