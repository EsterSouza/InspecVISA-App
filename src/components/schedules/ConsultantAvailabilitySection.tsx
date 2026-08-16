import { useEffect, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import type { ConsultantAvailabilityRow } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { SCHEDULE_CONSULTANTS, errorMessage } from './appointmentRequestsShared';
import { toast } from '../../store/useToastStore';

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
];
const PERIODS: { value: 'manha' | 'tarde'; label: string }[] = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
];

export function ConsultantAvailabilitySection() {
  const [rows, setRows] = useState<ConsultantAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await AppointmentAdminService.listConsultantAvailability());
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const isAvailable = (consultant: string, weekday: number, period: string) =>
    rows.some((r) => r.consultant_name === consultant && r.weekday === weekday && r.period === period);

  const toggle = async (consultant: string, weekday: number, period: 'manha' | 'tarde') => {
    const key = `${consultant}-${weekday}-${period}`;
    const nextAvailable = !isAvailable(consultant, weekday, period);
    setBusyKey(key);
    try {
      await AppointmentAdminService.setConsultantAvailability(consultant, weekday, period, nextAvailable);
      setRows((prev) =>
        nextAvailable
          ? [...prev, { tenant_id: '', consultant_name: consultant, weekday, period }]
          : prev.filter((r) => !(r.consultant_name === consultant && r.weekday === weekday && r.period === period))
      );
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section>
      <h2 className="mb-2 flex items-center text-lg font-semibold text-gray-900">
        <CalendarClock className="mr-2 h-5 w-5 text-primary-600" />
        Disponibilidade por consultora
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Em quais dias e turnos cada consultora aparece na agenda (grade fixa de 09:30 às 17:00). Quem não
        estiver marcado aqui não aparece como opção nesse dia/turno para clientes nem no Portal do Cliente.
      </p>

      {loading ? (
        <div role="status" className="flex h-24 items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" /> Carregando disponibilidade...
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
      ) : (
        <div className="space-y-4">
          {SCHEDULE_CONSULTANTS.map((consultant) => (
            <Card key={consultant} className="shadow-sm">
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-bold text-gray-900">{consultant}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-center text-sm">
                    <thead>
                      <tr>
                        <th className="w-20 text-left text-xs font-semibold text-gray-500"></th>
                        {WEEKDAYS.map((day) => (
                          <th key={day.value} className="pb-1 text-xs font-semibold text-gray-500">{day.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map((period) => (
                        <tr key={period.value}>
                          <td className="pr-2 text-left text-xs font-semibold text-gray-600">{period.label}</td>
                          {WEEKDAYS.map((day) => {
                            const active = isAvailable(consultant, day.value, period.value);
                            const key = `${consultant}-${day.value}-${period.value}`;
                            return (
                              <td key={day.value} className="p-1">
                                <button
                                  type="button"
                                  onClick={() => void toggle(consultant, day.value, period.value)}
                                  disabled={busyKey === key}
                                  aria-pressed={active}
                                  aria-label={`${consultant} — ${day.label} ${period.label}${active ? ', disponível' : ', indisponível'}`}
                                  className={`min-h-11 w-full rounded-md border text-xs font-semibold transition-colors ${
                                    active
                                      ? 'border-primary-600 bg-primary-600 text-white'
                                      : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
                                  } disabled:opacity-50`}
                                >
                                  {busyKey === key ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : active ? 'Livre' : '—'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
