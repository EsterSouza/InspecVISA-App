import type { AppointmentRequest, Client } from '../types';
import { isInspectionAppointment } from './appointmentType';

export function shouldShowIlpiAreaScores(
  request: Pick<AppointmentRequest, 'client_id' | 'appointment_type'>,
  clients: Pick<Client, 'id' | 'category'>[]
): boolean {
  return isInspectionAppointment(request.appointment_type)
    && clients.find((client) => client.id === request.client_id)?.category === 'ilpi';
}
