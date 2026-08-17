import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppointmentRequest } from '../../../types';
import { AppointmentAdminService } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, errorMessage } from '../appointmentRequestsShared';
import { toast } from '../../../store/useToastStore';

interface DueDateModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onSaved: () => void;
}

export function DueDateModal({ request, onClose, onSaved }: DueDateModalProps) {
  const [dueDate, setDueDate] = useState(request.report_due_at?.split('T')[0] || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!dueDate) return;
    setSaving(true);
    try {
      await AppointmentAdminService.setManualDueDate(request, dueDate);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Erro', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="due-date-title" className="w-full max-w-sm shadow-2xl">
        <CardContent className="p-6">
          <h3 id="due-date-title" className="mb-1 text-lg font-bold text-navy">Prazo manual do relatório</h3>
          <p className="mb-4 text-sm text-navy-3">{request.unit_name}</p>
          <label htmlFor="due-date-input" className="sr-only">Data limite do relatório</label>
          <input
            id="due-date-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={TEXT_INPUT}
          />
          <div className="mt-5 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" disabled={saving || !dueDate} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar prazo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
