import { CalendarDays, CheckCircle, Clock, Inbox, MapPin, Phone, RefreshCw, Trash2, XCircle } from 'lucide-react';
import type { AppointmentRequest } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { PERIOD_LABELS, formatCreatedAt, formatDateBR, usePagedList } from './appointmentRequestsShared';
import { Pager } from './Pager';

interface PendingRequestsSectionProps {
  pending: AppointmentRequest[];
  busy: string | null;
  onRefresh: () => void;
  onConfirm: (request: AppointmentRequest) => void;
  onReschedule: (request: AppointmentRequest) => void;
  onCancel: (request: AppointmentRequest) => void;
  onDelete: (request: AppointmentRequest) => void;
}

export function PendingRequestsSection({
  pending,
  busy,
  onRefresh,
  onConfirm,
  onReschedule,
  onCancel,
  onDelete,
}: PendingRequestsSectionProps) {
  const pendingPage = usePagedList(pending);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center text-lg font-semibold text-gray-900">
          <Inbox className="mr-2 h-5 w-5 text-amber-500" />
          Solicitações pendentes
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              {pending.length}
            </span>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Atualizar solicitações pendentes">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {pending.length === 0 ? (
        <Card className="border-dashed bg-gray-50 py-10 text-center">
          <p className="text-sm text-gray-500">Nenhuma solicitação pendente do portal público.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingPage.items.map((request) => (
            <Card key={request.id} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">{request.unit_name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center">
                        <MapPin className="mr-1 h-3.5 w-3.5" /> {request.district}
                      </span>
                      <span className="flex items-center">
                        <CalendarDays className="mr-1 h-3.5 w-3.5" />
                        {formatDateBR(request.requested_date)}
                        {request.requested_period
                          ? ` · ${PERIOD_LABELS[request.requested_period] || request.requested_period}`
                          : ''}
                      </span>
                      {request.phone && (
                        <span className="flex items-center">
                          <Phone className="mr-1 h-3.5 w-3.5" /> {request.phone}
                        </span>
                      )}
                      <span className="flex items-center text-xs text-gray-500">
                        <Clock className="mr-1 h-3 w-3" /> recebida em {formatCreatedAt(request.created_at)}
                      </span>
                    </div>
                    {request.notes && (
                      <p className="mt-2 text-sm italic text-gray-500">“{request.notes}”</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      disabled={busy === request.id}
                      onClick={() => onConfirm(request)}
                    >
                      <CheckCircle className="mr-1.5 h-4 w-4" /> Confirmar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === request.id}
                      onClick={() => onReschedule(request)}
                    >
                      Remarcar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === request.id}
                      onClick={() => onCancel(request)}
                      className="text-red-500 hover:bg-red-50"
                      aria-label={`Cancelar solicitação de ${request.unit_name}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === request.id}
                      onClick={() => onDelete(request)}
                      className="text-red-600 hover:bg-red-50"
                      aria-label={`Excluir solicitação de ${request.unit_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Pager page={pendingPage.page} totalPages={pendingPage.totalPages} onChange={pendingPage.setPage} />
        </div>
      )}
    </section>
  );
}
