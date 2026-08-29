import type { AppointmentType } from './appointmentType';

export const PUBLIC_APPOINTMENT_DRAFT_KEY = 'inspecvisa-public-appointment-draft-v1';

type AppointmentTypeOption = { value: AppointmentType; description: string };

/** Finalidades de quem já é cliente e está autenticado no Portal do Cliente. */
export const PORTAL_APPOINTMENT_TYPE_OPTIONS: AppointmentTypeOption[] = [
  { value: 'inspection', description: 'Avaliação sanitária presencial da unidade.' },
  { value: 'follow_up_meeting', description: 'Acompanhamento das próximas ações.' },
  { value: 'results_meeting', description: 'Apresentação e alinhamento de resultados.' },
  { value: 'document_guidance', description: 'Orientação sobre documentos e processos.' },
  { value: 'training', description: 'Treinamento da equipe.' },
  { value: 'other', description: 'Outro compromisso com as consultoras.' },
];

/** Visitante anônimo só agenda o primeiro contato; o resto exige vínculo de cliente. */
export const PUBLIC_APPOINTMENT_TYPE_OPTIONS: AppointmentTypeOption[] = [
  { value: 'briefing', description: 'Conversa inicial online com a consultora para entender sua necessidade.' },
];

/**
 * PORT-07 — as duas finalidades que dependem do contrato da unidade, não do portal. Ficam fora
 * da lista fixa porque a marcação no cadastro é o que as libera; o servidor recusa igual, então
 * escondê-las aqui é cortesia, não a trava.
 */
export const CONTRACTED_APPOINTMENT_TYPE_OPTIONS: Record<'audit' | 'online_followup', AppointmentTypeOption> = {
  audit: { value: 'audit', description: 'Nova fiscalização da unidade, com relatório e plano de ação.' },
  online_followup: { value: 'online_followup', description: 'Acompanhamento periódico à distância com a consultora.' },
};

/** O que a unidade tem no contrato. Ausente vale como não contratado. */
export interface ContractedServices {
  has_audit_service?: boolean;
  has_online_followup?: boolean;
}

export function appointmentTypeOptionsFor(
  portalMode: boolean,
  contracted?: ContractedServices | null
): AppointmentTypeOption[] {
  if (!portalMode) return PUBLIC_APPOINTMENT_TYPE_OPTIONS;
  const options = [...PORTAL_APPOINTMENT_TYPE_OPTIONS];
  // Logo depois da inspeção: é a mesma visita, com outro nome no contrato.
  if (contracted?.has_audit_service) options.splice(1, 0, CONTRACTED_APPOINTMENT_TYPE_OPTIONS.audit);
  if (contracted?.has_online_followup) {
    options.push(CONTRACTED_APPOINTMENT_TYPE_OPTIONS.online_followup);
  }
  return options;
}

export function publicAppointmentDurations(type: AppointmentType): number[] {
  // Auditoria acompanha a inspeção desde o PORT-07 — mesma visita, mesma faixa de duração.
  if (type === 'inspection' || type === 'audit') return [60, 90, 120, 180, 240, 360, 480, 720];
  if (type === 'training') return [30, 60, 90, 120, 180, 240, 360, 480];
  if (type === 'other') return [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];
  if (type === 'briefing') return [45, 60];
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
