import { useState } from 'react';
import { CalendarOff, Loader2, Trash2 } from 'lucide-react';
import { AppointmentAdminService, type BlockedDateRow } from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { SCHEDULE_CONSULTANTS, TEXT_INPUT, errorMessage, formatDateBR } from './appointmentRequestsShared';
import { toast } from '../../store/useToastStore';
import { toDateKey } from '../../utils/date';

interface BlockedDatesSectionProps {
  blockedDates: BlockedDateRow[];
  onChanged: () => void;
}

const WHO_ALL = 'Todas';

export function BlockedDatesSection({ blockedDates, onChanged }: BlockedDatesSectionProps) {
  const [day, setDay] = useState('');
  const [reason, setReason] = useState('');
  const [who, setWho] = useState(WHO_ALL);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return;
    setSaving(true);
    try {
      await AppointmentAdminService.addBlockedDate(day, reason, who === WHO_ALL ? undefined : who);
      setDay('');
      setReason('');
      setWho(WHO_ALL);
      onChanged();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
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
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <h2 className="mb-2 flex items-center text-lg font-semibold text-navy">
        <CalendarOff className="mr-2 h-5 w-5 text-primary-600" />
        Datas bloqueadas
      </h2>
      <p className="mb-4 text-sm text-navy-3">
        Feriados, férias e compromissos: os dias bloqueados desaparecem do calendário público.
      </p>

      <Card className="mb-4 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="blocked-date-day" className="block text-xs font-medium text-navy-2">Data</label>
              <input
                id="blocked-date-day"
                type="date"
                required
                value={day}
                min={toDateKey(new Date())}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-xl border border-control p-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="blocked-date-who" className="block text-xs font-medium text-navy-2">Quem</label>
              <select
                id="blocked-date-who"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="rounded-xl border border-control bg-surface p-2.5 text-sm"
              >
                <option value={WHO_ALL}>Todas (feriado)</option>
                {SCHEDULE_CONSULTANTS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <label htmlFor="blocked-date-reason" className="block text-xs font-medium text-navy-2">Motivo (opcional)</label>
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
        <p className="text-sm text-navy-3">Nenhuma data bloqueada nos próximos dias.</p>
      ) : (
        <div className="space-y-2">
          {blockedDates.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-xl border border-default bg-surface p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <CalendarOff className="h-4 w-4 text-navy-3" />
                <span className="font-medium text-navy">{formatDateBR(row.day)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.consultant_name ? 'bg-primary-50 text-primary-700' : 'bg-surface-sunken text-navy-2'}`}>
                  {row.consultant_name || WHO_ALL}
                </span>
                {row.reason && <span className="text-navy-3">{row.reason}</span>}
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
