export const APPOINTMENT_TYPES = [
  'inspection',
  'follow_up_meeting',
  'results_meeting',
  'document_guidance',
  'training',
  'other',
  'briefing',
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

export function isAllowedAppointmentDuration(type: AppointmentType, minutes: number): boolean {
  if (!Number.isInteger(minutes)) return false;
  if (type === 'inspection') return minutes >= 15 && minutes <= 720;
  if (type === 'training') return minutes >= 30 && minutes <= 480 && minutes % 30 === 0;
  if (type === 'other') return minutes >= 15 && minutes <= 480 && minutes % 15 === 0;
  if (type === 'briefing') return minutes === 15 || minutes === 30 || minutes === 45;
  return minutes === 30 || minutes === 60 || minutes === 90;
}

export function assertAppointmentDuration(type: AppointmentType, minutes: number): void {
  if (!isAllowedAppointmentDuration(type, minutes)) {
    throw new Error('Duração inválida para o tipo de compromisso.');
  }
}
