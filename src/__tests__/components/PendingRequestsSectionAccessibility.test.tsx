import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, test, vi } from 'vitest';
import { PendingRequestsSection } from '../../components/schedules/PendingRequestsSection';
import type { AppointmentRequest } from '../../types';

function pendingRequest(overrides: Partial<AppointmentRequest> = {}): AppointmentRequest {
  return {
    id: 'req-1',
    tenant_id: 'tenant-1',
    slot_id: null,
    client_id: null,
    schedule_id: null,
    inspection_id: null,
    appointment_type: 'inspection',
    subject: null,
    duration_minutes: null,
    consultant_names: null,
    preferred_consultant_name: null,
    meeting_url: null,
    participant_names: null,
    cancellation_reason: null,
    public_token: 'tok-1',
    unit_name: 'Clínica Vida Nova',
    district: 'Copacabana',
    responsible_name: 'Maria Silva',
    phone: '21999999999',
    email: null,
    requested_date: '2026-08-20',
    requested_period: 'manha',
    requested_time: null,
    status: 'requested',
    report_due_at: null,
    report_due_source: null,
    report_delivered_at: null,
    report_pdf_path: null,
    notes: null,
    internal_notes: null,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    ...overrides,
  };
}

describe('P360-014 — decomposição e acessibilidade de PendingRequestsSection', () => {
  test('lista de solicitações pendentes não tem violações críticas de WCAG A/AA', async () => {
    const { container } = render(
      <PendingRequestsSection
        pending={[pendingRequest()]}
        busy={null}
        onRefresh={vi.fn()}
        onConfirm={vi.fn()}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Clínica Vida Nova')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('botões de ação por solicitação têm nome acessível', () => {
    render(
      <PendingRequestsSection
        pending={[pendingRequest()]}
        busy={null}
        onRefresh={vi.fn()}
        onConfirm={vi.fn()}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Cancelar solicitação de Clínica Vida Nova/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excluir solicitação de Clínica Vida Nova/ })).toBeInTheDocument();
  });

  test('estado vazio não tem violações críticas', async () => {
    const { container } = render(
      <PendingRequestsSection
        pending={[]}
        busy={null}
        onRefresh={vi.fn()}
        onConfirm={vi.fn()}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Nenhuma solicitação pendente do portal público.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
