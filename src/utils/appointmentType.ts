export const APPOINTMENT_TYPES = [
  'inspection',
  'follow_up_meeting',
  'results_meeting',
  'document_guidance',
  'training',
  'other',
  'briefing',
  'audit',
  'online_followup',
] as const;

export type AppointmentType = typeof APPOINTMENT_TYPES[number];

export const APPOINTMENT_TYPE_RULES: Record<AppointmentType, {
  label: string;
  isInspection: boolean;
  requiresServiceAddress: boolean;
  showsReportDueDate: boolean;
  usesSanitaryTimeline: boolean;
}> = {
  inspection: {
    label: 'Inspeção',
    isInspection: true,
    requiresServiceAddress: true,
    showsReportDueDate: true,
    usesSanitaryTimeline: true,
  },
  follow_up_meeting: {
    label: 'Reunião de acompanhamento',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
  results_meeting: {
    label: 'Reunião de resultados',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
  document_guidance: {
    label: 'Orientação documental',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
  training: {
    label: 'Treinamento',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
  other: {
    label: 'Outro compromisso',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
  /** Primeiro contato de quem ainda não é cliente. Sempre online. */
  briefing: {
    label: 'Briefing com a consultora',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
  /**
   * PORT-07 — a auditoria mensal é uma fiscalização completa: roteiro, relatório e plano de
   * ação novos. É uma inspeção com outro nome, e o nome existe para separar a visita
   * contratada por recorrência da inspeção avulsa no cronograma e na agenda.
   */
  audit: {
    label: 'Auditoria',
    isInspection: true,
    requiresServiceAddress: true,
    showsReportDueDate: true,
    usesSanitaryTimeline: true,
  },
  online_followup: {
    label: 'Acompanhamento online',
    isInspection: false,
    requiresServiceAddress: false,
    showsReportDueDate: false,
    usesSanitaryTimeline: false,
  },
};

export function isAppointmentType(value: unknown): value is AppointmentType {
  return typeof value === 'string' && APPOINTMENT_TYPES.includes(value as AppointmentType);
}

/** Campos ausentes durante o rollout e registros legados são inspeções. */
export function normalizeAppointmentType(value: unknown): AppointmentType {
  if (value == null || value === '') return 'inspection';
  if (isAppointmentType(value)) return value;
  throw new Error(`Tipo de compromisso inválido: ${String(value)}`);
}

export function isInspectionAppointment(value: unknown): boolean {
  return APPOINTMENT_TYPE_RULES[normalizeAppointmentType(value)].isInspection;
}

export function assertInspectionAppointment(value: unknown, action: string): void {
  if (!isInspectionAppointment(value)) {
    throw new Error(`Somente compromissos de inspeção podem ${action}.`);
  }
}

/**
 * Piso de 45 minutos, para todo tipo de compromisso (AGD-03, 29/08/2026). Pedido da Ester: nada
 * de 15 ou 30 minutos — compromisso curto demais não cabe no deslocamento nem na conversa, e o
 * briefing de 15 min de 18/08 varreu a manhã inteira da agenda. Treinamento fica em 60 porque o
 * passo dele é de 30 em 30; 60 é o primeiro múltiplo acima do piso.
 */
export const MIN_APPOINTMENT_MINUTES = 45;

export function isAllowedAppointmentDuration(type: AppointmentType, minutes: number): boolean {
  if (!Number.isInteger(minutes)) return false;
  if (minutes < MIN_APPOINTMENT_MINUTES) return false;
  // Auditoria acompanha a inspeção (PORT-07): uma fiscalização presencial não cabe em 90 min.
  if (type === 'inspection' || type === 'audit') return minutes <= 720;
  if (type === 'training') return minutes >= 60 && minutes <= 480 && minutes % 30 === 0;
  if (type === 'other') return minutes <= 480 && minutes % 15 === 0;
  if (type === 'briefing') return minutes === 45 || minutes === 60;
  // follow_up_meeting, results_meeting, document_guidance, online_followup
  return minutes === 45 || minutes === 60 || minutes === 90;
}

export function assertAppointmentDuration(type: AppointmentType, minutes: number): void {
  if (!isAllowedAppointmentDuration(type, minutes)) {
    throw new Error('Duração inválida para o tipo de compromisso.');
  }
}

/**
 * Como o cliente lê o estado de uma visita. Vive aqui porque o portal (agenda) e
 * a página pública do protocolo precisam dizer a mesma coisa — antes o texto era
 * copiado nos dois lugares.
 */
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Relatório em andamento',
  report_available: 'Relatório disponível',
  cancelled: 'Cancelada',
};
