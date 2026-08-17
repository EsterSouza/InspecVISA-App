import { useEffect, useState } from 'react';
import { Clock, Loader2, Trash2 } from 'lucide-react';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import type { AppointmentBlock, AppointmentBlockRecurrence } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { SCHEDULE_CONSULTANTS, errorMessage } from './appointmentRequestsShared';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { toast } from '../../store/useToastStore';
import { toDateKey } from '../../utils/date';

const WHO_ALL = 'Todas';
const RECURRENCE_OPTIONS: { value: AppointmentBlockRecurrence; label: string }[] = [
  { value: 'none', label: 'Não repete' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensalmente' },
];

function formatBlockRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateLabel = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const startLabel = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endLabel = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} · ${startLabel} às ${endLabel}`;
}

export function PartialBlocksSection() {
  const [blocks, setBlocks] = useState<AppointmentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [day, setDay] = useState('');
  const [startTime, setStartTime] = useState('09:30');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [who, setWho] = useState(WHO_ALL);
  const [reason, setReason] = useState('');
  const [recurrence, setRecurrence] = useState<AppointmentBlockRecurrence>('none');
  const [occurrences, setOccurrences] = useState(4);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setBlocks(await AppointmentAdminService.listAvailabilityBlocks());
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const applyPreset = (preset: 'manha' | 'tarde') => {
    if (preset === 'manha') {
      setStartTime('09:30');
      setDurationMinutes(120);
    } else {
      setStartTime('13:00');
      setDurationMinutes(180);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day || !startTime) return;
    setSaving(true);
    try {
      await AppointmentAdminService.createAvailabilityBlocks({
        startsAt: new Date(`${day}T${startTime}`).toISOString(),
        durationMinutes,
        reason: reason || undefined,
        recurrence,
        occurrences: recurrence === 'none' ? 1 : occurrences,
        consultantName: who === WHO_ALL ? undefined : who,
      });
      setDay('');
      setReason('');
      setWho(WHO_ALL);
      setRecurrence('none');
      await load();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (block: AppointmentBlock) => {
    const ok = await confirm({
      title: 'Cancelar este bloqueio?',
      confirmLabel: 'Cancelar bloqueio',
    });
    if (!ok) return;
    setBusyId(block.id);
    try {
      await AppointmentAdminService.cancelAvailabilityBlock(block.id);
      await load();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <h2 className="mb-2 flex items-center text-lg font-semibold text-navy">
        <Clock className="mr-2 h-5 w-5 text-primary-600" />
        Bloqueio por horário ou turno
      </h2>
      <p className="mb-4 text-sm text-navy-3">
        Para travar só uma parte do dia (ex.: uma reunião às 14h, ou o turno inteiro de uma consultora),
        sem bloquear o dia todo. Pode repetir por semana ou mês.
      </p>

      <Card className="mb-4 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Data" htmlFor="partial-block-day" className="w-auto">
                <Input
                  type="date"
                  required
                  value={day}
                  min={toDateKey(new Date())}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
              <Field label="Início" htmlFor="partial-block-start" className="w-auto">
                <Input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field label="Duração (min)" htmlFor="partial-block-duration" className="w-auto">
                <Input
                  type="number"
                  required
                  min={15}
                  max={720}
                  step={15}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.min(720, Math.max(15, Number(e.target.value) || 15)))}
                  className="w-28"
                />
              </Field>
              <div className="flex gap-1.5">
                <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset('manha')}>Manhã inteira</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset('tarde')}>Tarde inteira</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Field label="Quem" htmlFor="partial-block-who" className="w-auto">
                <Select value={who} onChange={(e) => setWho(e.target.value)}>
                  <option value={WHO_ALL}>Todas</option>
                  {SCHEDULE_CONSULTANTS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Repetição" htmlFor="partial-block-recurrence" className="w-auto">
                <Select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as AppointmentBlockRecurrence)}
                >
                  {RECURRENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              {recurrence !== 'none' && (
                <Field label="Quantas vezes" htmlFor="partial-block-occurrences" className="w-auto">
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={occurrences}
                    onChange={(e) => setOccurrences(Math.min(52, Math.max(2, Number(e.target.value) || 2)))}
                    className="w-24"
                  />
                </Field>
              )}
              <Field label="Motivo" htmlFor="partial-block-reason" optional className="min-w-[180px] flex-1">
                <Input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex.: Reunião interna"
                />
              </Field>
              <Button type="submit" size="sm" disabled={saving || !day || !startTime}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Clock className="mr-1.5 h-4 w-4" />}
                Bloquear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div role="status" className="flex h-16 items-center justify-center gap-2 text-sm text-navy-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" /> Carregando bloqueios...
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">{loadError}</div>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-navy-3">Nenhum bloqueio parcial ativo.</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between rounded-xl border border-default bg-surface p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-navy-3" />
                <span className="font-medium text-navy">{formatBlockRange(block.starts_at, block.ends_at)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${block.consultant_name ? 'bg-primary-50 text-primary-700' : 'bg-surface-sunken text-navy-2'}`}>
                  {block.consultant_name || WHO_ALL}
                </span>
                {block.recurrence !== 'none' && (
                  <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber-soft-ink">
                    {block.occurrence_index}/{block.occurrence_count}
                  </span>
                )}
                {block.reason && <span className="text-navy-3">{block.reason}</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === block.id}
                onClick={() => void handleCancel(block)}
                className="text-danger hover:bg-danger-soft"
                aria-label={`Remover bloqueio de ${formatBlockRange(block.starts_at, block.ends_at)}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {confirmDialog}
    </section>
  );
}
