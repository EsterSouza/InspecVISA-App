import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppointmentRequest } from '../../../types';
import {
  AppointmentAdminService,
  type AppointmentEventNotificationResult,
} from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { errorMessage } from '../appointmentRequestsShared';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { toast } from '../../../store/useToastStore';

interface RescheduleModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onSaved: (notify: AppointmentEventNotificationResult | null) => void;
}

export function RescheduleModal({ request, onClose, onSaved }: RescheduleModalProps) {
  const [date, setDate] = useState(request.requested_date?.split('T')[0] || '');
  const [time, setTime] = useState(request.requested_time || '09:00');
  const [saving, setSaving] = useState(false);

  const handleSave = async (onlyMark: boolean) => {
    setSaving(true);
    try {
      const notify = onlyMark
        ? await AppointmentAdminService.rescheduleRequest(request)
        : await AppointmentAdminService.rescheduleRequest(request, date, time);
      onSaved(notify);
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="reschedule-title" className="w-full max-w-sm shadow-2xl">
        <CardContent className="p-6">
          <h3 id="reschedule-title" className="mb-1 text-lg font-bold text-navy">Remarcar inspeção</h3>
          <p className="mb-4 text-sm text-navy-3">{request.unit_name}</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nova data" htmlFor="reschedule-date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Horário" htmlFor="reschedule-time">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-navy-3">
            A nova data atualiza o portal do cliente, a agenda interna e o bloqueio do calendário público.
          </p>

          <div className="mt-5 space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={saving || !date}
              onClick={() => void handleSave(false)}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remarcar para esta data
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave(true)}
            >
              Marcar como remarcada (data a definir)
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
