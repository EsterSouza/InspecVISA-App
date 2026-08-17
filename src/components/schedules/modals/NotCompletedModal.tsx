import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppointmentRequest } from '../../../types';
import { AppointmentAdminService } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { errorMessage } from '../appointmentRequestsShared';

interface NotCompletedModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onSaved: () => void;
}

export function NotCompletedModal({ request, onClose, onSaved }: NotCompletedModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!reason.trim()) {
      setError('Descreva o motivo — ele ficará visível para o cliente no portal.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.markNotCompleted(request.id, reason.trim());
      onSaved();
    } catch (err) {
      setError(errorMessage(err) || 'Falha ao registrar motivo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="not-completed-title" className="w-full max-w-md shadow-2xl">
        <CardContent className="p-6">
          <h3 id="not-completed-title" className="mb-1 text-lg font-bold text-navy">Inspeção não realizada</h3>
          <p className="mb-4 text-sm text-navy-3">{request.unit_name}</p>

          <div className="space-y-1.5">
            <label htmlFor="not-completed-reason" className="text-sm font-medium text-navy-2">
              Motivo <span className="text-danger">*</span>
            </label>
            <textarea
              id="not-completed-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Cliente não estava no local, documentação pendente, acesso negado..."
              className="w-full rounded-xl border border-control p-3 text-sm placeholder:text-navy-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <p className="text-xs text-navy-3">
              Este texto ficará visível para o cliente no Portal do Cliente.
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-3 rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={saving || !reason.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar e reagendar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
