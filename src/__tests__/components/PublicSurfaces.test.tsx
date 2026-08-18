import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AppointmentAttachment, PublicAppointmentStatusResult } from '../../types';

// FE-26: as duas superfícies que o cliente vê sem login. O que se prova aqui é o que a
// conferência no navegador não pega sozinha: um `<h1>` só por página (a marca do cabeçalho
// deixou de ser título), estado dito por palavra e não só por cor, e a galeria de fotos em
// `<dialog>` — trap de foco e `Esc` vêm do elemento, não de código nosso.

const statusBase: PublicAppointmentStatusResult = {
  id: 'appointment-1',
  client_id: 'client-1',
  unit_name: 'Casa de Repouso Bem Viver',
  district: 'Ilha do Governador',
  municipality: 'Rio de Janeiro',
  attendance_mode: 'presencial',
  appointment_type: 'inspection',
  status: 'report_available',
  requested_date: '2026-08-12',
  requested_period: 'manha',
  requested_time: '09:00',
  report_due_at: '2026-08-20',
  report_due_source: 'business_days',
  created_at: '2026-08-01T12:00:00Z',
  updated_at: '2026-08-12T12:00:00Z',
};

const fotos: AppointmentAttachment[] = [
  {
    id: 'foto-1',
    kind: 'photo',
    file_name: 'cozinha.jpg',
    mime_type: 'image/jpeg',
    caption: 'Bancada da cozinha',
    signed_url: 'https://example.com/cozinha.jpg',
  } as AppointmentAttachment,
  {
    id: 'foto-2',
    kind: 'photo',
    file_name: 'deposito.jpg',
    mime_type: 'image/jpeg',
    caption: null,
    signed_url: 'https://example.com/deposito.jpg',
  } as AppointmentAttachment,
];

const appointmentDetails = vi.fn();
const reportActionItems = vi.fn();

vi.mock('../../services/clientPortalService', () => ({
  clientPortalService: {
    getStoredToken: () => null,
    appointmentDetails: (...args: unknown[]) => appointmentDetails(...args),
    reportActionItems: (...args: unknown[]) => reportActionItems(...args),
    audit: vi.fn(),
    overview: vi.fn(),
    submitReportEvidence: vi.fn(),
    setItemStatus: vi.fn(),
  },
}));

vi.mock('../../services/publicAppointmentService', () => ({
  publicAppointmentService: {
    listCalendarDays: vi.fn().mockResolvedValue([]),
    listAvailableTimes: vi.fn().mockResolvedValue([]),
    createAppointmentRequest: vi.fn(),
  },
}));

import { PublicAppointmentStatus } from '../../pages/PublicAppointmentStatus';
import { PublicSchedule } from '../../pages/PublicSchedule';

function renderStatus() {
  return render(
    <MemoryRouter initialEntries={['/portal/AB12CD34']}>
      <Routes>
        <Route path="/portal/:token" element={<PublicAppointmentStatus />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('FE-26 — página pública de acompanhamento', () => {
  beforeEach(() => {
    appointmentDetails.mockResolvedValue({ status: statusBase, assets: fotos });
    reportActionItems.mockResolvedValue({ items: [] });
  });

  test('tem um único h1, e ele é a tarefa da página — não a marca', async () => {
    renderStatus();
    const titulos = await screen.findAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Inspeção');
    expect(screen.getByText('Casa de Repouso Bem Viver')).toBeInTheDocument();
  });

  test('o estado chega por palavra, não só por cor', async () => {
    appointmentDetails.mockResolvedValue({ status: { ...statusBase, status: 'confirmed' }, assets: [] });
    renderStatus();
    expect(await screen.findByText('Confirmada')).toBeInTheDocument();
  });

  test('a galeria de fotos abre num dialog e fecha pelo botão', async () => {
    const user = userEvent.setup();
    renderStatus();

    const abrir = await screen.findByRole('button', { name: /Ver as 2 fotos/ });
    await user.click(abrir);

    const dialogo = await screen.findByRole('dialog', { name: /Fotos da visita/ });
    expect(dialogo).toBeInTheDocument();
    expect(screen.getByAltText('Bancada da cozinha')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar a galeria' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('link que não abre nada explica o que houve e o que fazer', async () => {
    appointmentDetails.mockRejectedValue(new Error('token inválido'));
    const { container } = renderStatus();

    expect(await screen.findByRole('heading', { level: 1, name: /Não encontramos esta solicitação/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Entrar no portal/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('FE-26 — página pública de agendamento', () => {
  test('a etapa atual é dita por número e palavra, com um h1 só', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/agendar']}>
        <PublicSchedule />
      </MemoryRouter>
    );

    const titulos = await screen.findAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);

    const etapas = screen.getByRole('list', { name: 'Etapa 1 de 4' });
    expect(etapas).toHaveTextContent('Finalidade');
    expect(etapas).toHaveTextContent('Agenda');
    expect(etapas).toHaveTextContent('Detalhes');
    expect(etapas).toHaveTextContent('Resumo');

    expect(await axe(container)).toHaveNoViolations();
  });
});
