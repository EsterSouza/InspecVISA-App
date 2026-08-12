export type AppointmentRecipientSource = 'client' | 'request';

function validEmail(value: unknown): string | null {
  const email = String(value ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function resolveAppointmentRecipient(params: {
  clientId: string | null;
  clientEmail: unknown;
  requestEmail: unknown;
}): { email: string | null; source: AppointmentRecipientSource } {
  if (params.clientId) {
    return { email: validEmail(params.clientEmail), source: 'client' };
  }
  return { email: validEmail(params.requestEmail), source: 'request' };
}
