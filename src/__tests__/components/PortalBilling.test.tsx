import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { PortalBilling } from '../../components/client/PortalBilling';
import type { ClientPortalInvoice } from '../../services/clientPortalService';

const invoice: ClientPortalInvoice = {
  id: 'inv-1',
  competence_month: '2026-07-01',
  file_name: 'nota-julho.pdf',
  mime_type: 'application/pdf',
  created_at: '2026-07-01T00:00:00Z',
  signed_url: 'https://files.example.com/inv-1',
};

function renderBilling(overrides: Partial<ComponentProps<typeof PortalBilling>> = {}) {
  const onAudit = vi.fn();
  const onAcknowledgePayment = vi.fn();
  render(
    <PortalBilling
      invoices={[]}
      paymentAckBusy={false}
      paymentAckSent={false}
      onAcknowledgePayment={onAcknowledgePayment}
      onAudit={onAudit}
      {...overrides}
    />
  );
  return { onAudit, onAcknowledgePayment };
}

describe('P360-009 - PortalBilling', () => {
  test('não renderiza nada sem pagamento, notas ou erro', () => {
    const { container } = render(
      <PortalBilling
        invoices={[]}
        paymentAckBusy={false}
        paymentAckSent={false}
        onAcknowledgePayment={vi.fn()}
        onAudit={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('mostra pagamento pendente com link e botão "já paguei"', () => {
    renderBilling({
      payment: { type: 'monthly', status: 'pending', link: 'https://pay.example.com', due_date: '2026-08-10', updated_at: null },
    });
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pagar agora/ })).toHaveAttribute('href', 'https://pay.example.com');
    expect(screen.getByText('Ja paguei')).toBeInTheDocument();
  });

  test('lista notas fiscais quando presentes', () => {
    renderBilling({ invoices: [invoice] });
    expect(screen.getByText('Notas Fiscais')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Baixar/ })).toHaveAttribute('href', invoice.signed_url);
  });

  test('falha ao carregar notas fiscais não derruba o pagamento', () => {
    renderBilling({
      payment: { type: 'one_time', status: 'paid', link: null, updated_at: null },
      invoices: [],
      invoicesError: true,
    });
    expect(screen.getByText('Pagamento confirmado')).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar as notas fiscais agora/)).toBeInTheDocument();
    expect(screen.queryByText('Notas Fiscais')).not.toBeInTheDocument();
  });

  test('aciona o callback de confirmação de pagamento', () => {
    const { onAcknowledgePayment } = renderBilling({
      payment: { type: 'one_time', status: 'pending', link: 'https://pay.example.com', updated_at: null },
    });
    fireEvent.click(screen.getByText('Ja paguei'));
    expect(onAcknowledgePayment).toHaveBeenCalledTimes(1);
  });
});
