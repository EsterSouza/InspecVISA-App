import { CheckCircle2, CreditCard, Download, FileText, Loader2, Receipt } from 'lucide-react';
import type { ClientPortalAuditEventType } from '../../types';
import type { ClientPortalInvoice, ClientPortalPayment } from '../../services/clientPortalService';
import { formatCompetenceMonth, formatDateBR, paymentLinks } from '../../utils/clientPortalFormat';

interface PortalBillingProps {
  payment?: ClientPortalPayment;
  invoices: ClientPortalInvoice[];
  invoicesError?: boolean;
  paymentAckBusy: boolean;
  paymentAckSent: boolean;
  onAcknowledgePayment: () => void;
  onAudit: (eventType: ClientPortalAuditEventType, payload?: Record<string, unknown>) => void;
  loading?: boolean;
}

export function PortalBilling({
  payment,
  invoices,
  invoicesError,
  paymentAckBusy,
  paymentAckSent,
  onAcknowledgePayment,
  onAudit,
  loading,
}: PortalBillingProps) {
  if (loading) {
    return (
      <div className="mb-6 h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-50" aria-hidden="true" />
    );
  }

  const hasPayment = !!payment && (payment.type || payment.link || payment.status === 'paid');
  const links = payment ? paymentLinks(payment) : [];

  if (!hasPayment && invoices.length === 0 && !invoicesError) return null;

  return (
    <div className="mb-6 space-y-6">
      {hasPayment && payment && (
        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            payment.status === 'paid' ? 'border-green-200 bg-green-50/70' : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            {payment.status === 'paid' ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            ) : (
              <CreditCard className="h-6 w-6 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="text-sm font-bold text-gray-900">
                {payment.status === 'paid' ? 'Pagamento confirmado' : 'Pagamento pendente'}
                {payment.type && (
                  <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                    {payment.type === 'monthly' ? 'Mensal' : 'Único'}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {payment.status === 'paid'
                  ? 'Obrigado! Seu pagamento está em dia.'
                  : 'Use o botão para efetuar o pagamento e liberar o acompanhamento completo.'}
              </p>
              {payment.type === 'monthly' && payment.due_date && (
                <p className="text-xs font-medium text-gray-600">Vencimento: {formatDateBR(payment.due_date)}</p>
              )}
              {payment.status !== 'paid' && payment.link && (
                <p className="text-xs text-gray-500">Opcoes no link: Pix, boleto, NuPay e cartao de credito/debito.</p>
              )}
              {paymentAckSent && (
                <p className="mt-1 text-xs font-medium text-green-700">
                  Aviso recebido. A equipe vai conferir o pagamento.
                </p>
              )}
            </div>
          </div>
          {payment.status !== 'paid' && links.length > 0 && (
            <div className="flex flex-col gap-2 sm:min-w-44">
              {links.map((item, index) => (
                <a
                  key={`${item.url}-${index}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    onAudit('payment_link_clicked', { label: item.label || 'Pagar agora', index });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
                >
                  <CreditCard className="h-4 w-4" />
                  {item.label || 'Pagar agora'}
                </a>
              ))}
              <button
                type="button"
                onClick={onAcknowledgePayment}
                disabled={paymentAckBusy || paymentAckSent}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-50 disabled:opacity-60"
              >
                {paymentAckBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {paymentAckSent ? 'Aviso enviado' : 'Ja paguei'}
              </button>
            </div>
          )}
        </div>
      )}

      {invoicesError ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-3 text-center text-xs text-gray-400">
          Não foi possível carregar as notas fiscais agora. O restante do painel continua disponível.
        </p>
      ) : (
        invoices.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-3.5">
              <Receipt className="h-4 w-4 shrink-0 text-primary-700" />
              <h3 className="text-sm font-bold text-gray-900">Notas Fiscais</h3>
              <span className="ml-auto text-xs text-gray-400">
                {invoices.length} nota{invoices.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="divide-y divide-gray-50">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {formatCompetenceMonth(invoice.competence_month)}
                    </p>
                    <p className="truncate text-xs text-gray-500">{invoice.file_name}</p>
                  </div>
                  {invoice.signed_url ? (
                    <a
                      href={invoice.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        onAudit('invoice_download_clicked', {
                          invoice_id: invoice.id,
                          competence_month: invoice.competence_month,
                        });
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-gray-400">Indisponível</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
