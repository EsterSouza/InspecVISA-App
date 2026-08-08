import { useState } from 'react';
import { CalendarOff, Loader2, Trash2 } from 'lucide-react';
import { AppointmentAdminService, type BlockedDateRow } from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { TEXT_INPUT, errorMessage, formatDateBR } from './appointmentRequestsShared';

interface BlockedDatesSectionProps {
  blockedDates: BlockedDateRow[];
  onChanged: () => void;
}

export function BlockedDatesSection({ blockedDates, onChanged }: BlockedDatesSectionProps) {
  const [day, setDay] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return;
    setSaving(true);
    try {
      await AppointmentAdminService.addBlockedDate(day, reason);
      setDay('');
      setReason('');
      onChanged();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: BlockedDateRow) => {
    setBusyId(row.id);
    try {
      await AppointmentAdminService.removeBlockedDate(row.id);
      onChanged();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <h2 className="mb-2 flex items-center text-lg font-semibold text-gray-900">
        <CalendarOff className="mr-2 h-5 w-5 text-primary-600" />
        Datas bloqueadas
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Feriados, férias e compromissos: os dias bloqueados desaparecem do calendário público.
      </p>

      <Card className="mb-4 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="blocked-date-day" className="block text-xs font-medium text-gray-600">Data</label>
              <input
                id="blocked-date-day"
                type="date"
                required
                value={day}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-xl border border-gray-300 p-2.5 text-sm"
              />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <label htmlFor="blocked-date-reason" className="block text-xs font-medium text-gray-600">Motivo (opcional)</label>
              <input
                id="blocked-date-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Feriado de Corpus Christi"
                className={TEXT_INPUT.replace('p-3', 'p-2.5')}
              />
            </div>
            <Button type="submit" size="sm" disabled={saving || !day}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarOff className="mr-1.5 h-4 w-4" />}
              Bloquear
            </Button>
          </form>
        </CardContent>
      </Card>

      {blockedDates.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma data bloqueada nos próximos dias.</p>
      ) : (
        <div className="space-y-2">
          {blockedDates.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <CalendarOff className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-800">{formatDateBR(row.day)}</span>
                {row.reason && <span className="text-gray-500">{row.reason}</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === row.id}
                onClick={() => void handleRemove(row)}
                className="text-red-500 hover:bg-red-50"
                aria-label={`Remover bloqueio de ${formatDateBR(row.day)}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
