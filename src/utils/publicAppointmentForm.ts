import type { AppointmentType } from './appointmentType';

export const PUBLIC_APPOINTMENT_DRAFT_KEY = 'inspecvisa-public-appointment-draft-v1';

export const PUBLIC_APPOINTMENT_TYPE_OPTIONS: Array<{ value: AppointmentType; description: string }> = [
  { value: 'inspection', description: 'Avaliação sanitária presencial da unidade.' },
  { value: 'follow_up_meeting', description: 'Acompanhamento das próximas ações.' },
  { value: 'results_meeting', description: 'Apresentação e alinhamento de resultados.' },
  { value: 'document_guidance', description: 'Orientação sobre documentos e processos.' },
  { value: 'training', description: 'Treinamento da equipe.' },
  { value: 'other', description: 'Outro compromisso com as consultoras.' },
];

export function publicAppointmentDurations(type: AppointmentType): number[] {
  if (type === 'inspection') return [60, 90, 120, 180, 240, 360, 480, 720];
  if (type === 'training') return [30, 60, 90, 120, 180, 240, 360, 480];
  if (type === 'other') return [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];
  return [30, 60, 90];
}

export function defaultPublicAppointmentDuration(type: AppointmentType): number {
  return publicAppointmentDurations(type)[0];
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return minutes + ' minutos';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours + ' hora' + (hours === 1 ? '' : 's') + (remainder ? ' e ' + remainder + ' min' : '');
}

export function buildAppointmentNotes(objective: string, notes: string): string | undefined {
  const parts = [
    objective.trim() ? 'Objetivo: ' + objective.trim() : '',
    notes.trim() ? 'Observações: ' + notes.trim() : '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
}
