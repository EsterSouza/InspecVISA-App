import { CheckCircle2, CreditCard, Download, FileText, Loader2, Receipt, RefreshCw } from 'lucide-react';
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
  onRetryInvoices?: () => void;
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
  onRetryInvoices,
}: PortalBillingProps) {
  if (loading) {
    return (
      <div className="mb-6 h-24 animate-pulse rounded-xl border border-default bg-surface-sunken" aria-hidden="true" />
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
            payment.status === 'paid' ? 'border-success-soft-border bg-success-soft/70' : 'border-amber-soft-border bg-amber-soft/70'
          }`}
        >
          <div className="flex items-center gap-3">
            {payment.status === 'paid' ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            ) : (
              <CreditCard className="h-6 w-6 shrink-0 text-amber-strong" />
            )}
            <div>
              <p className="text-sm font-bold text-navy">
                {payment.status === 'paid' ? 'Pagamento confirmado' : 'Pagamento pendente'}
                {payment.type && (
                  <span className="ml-2 rounded-full bg-surface/70 px-2 py-0.5 text-[10px] font-bold uppercase text-navy-2">
                    {payment.type === 'monthly' ? 'Mensal' : 'Único'}
                  </span>
                )}
              </p>
              <p className="text-xs text-navy-3">
                {payment.status === 'paid'
                  ? 'Obrigado! Seu pagamento está em dia.'
                  : 'Use o botão para efetuar o pagamento e liberar o acompanhamento completo.'}
              </p>
              {payment.type === 'monthly' && payment.due_date && (
                <p className="text-xs font-medium text-navy-2">Vencimento: {formatDateBR(payment.due_date)}</p>
              )}
              {payment.status !== 'paid' && payment.link && (
                <p className="text-xs text-navy-3">Opcoes no link: Pix, boleto, NuPay e cartao de credito/debito.</p>
              )}
              {paymentAckSent && (
                <p className="mt-1 text-xs font-medium text-success-soft-ink">
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
                  // Manual 2.0: âmbar é semântico, nunca ação principal. Branco sobre `--amber`
                  // dava 2,50:1 e reprovava AA — pendência que o FE-21 deixou para este card.
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-primary-800"
                >
                  <CreditCard className="h-4 w-4" />
                  {item.label || 'Pagar agora'}
                </a>
              ))}
              <button
                type="button"
                onClick={onAcknowledgePayment}
                disabled={paymentAckBusy || paymentAckSent}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-soft-border bg-surface px-4 py-2.5 text-sm font-semibold text-amber-soft-ink shadow-sm transition-colors hover:bg-amber-soft disabled:opacity-60"
              >
                {paymentAckBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {paymentAckSent ? 'Aviso enviado' : 'Ja paguei'}
              </button>
            </div>
          )}
        </div>
      )}

      {invoicesError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-default bg-surface p-3 text-center text-xs text-navy-3 sm:flex-row sm:justify-between sm:text-left">
          <p role="alert">Não foi possível carregar as notas fiscais agora. O restante do painel continua disponível.</p>
          {onRetryInvoices && (
            <button
              type="button"
              onClick={onRetryInvoices}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-semibold text-navy-2 hover:bg-surface-hover"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          )}
        </div>
      ) : (
        invoices.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-default bg-surface shadow-sm">
            <header className="flex items-center gap-2 border-b border-default bg-surface-sunken/70 px-5 py-3.5">
              <Receipt className="h-4 w-4 shrink-0 text-primary-700" />
              <h3 className="text-sm font-bold text-navy">Notas Fiscais</h3>
              <span className="ml-auto text-xs text-navy-3">
                {invoices.length} nota{invoices.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="divide-y divide-surface-sunken">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {formatCompetenceMonth(invoice.competence_month)}
                    </p>
                    <p className="truncate text-xs text-navy-3">{invoice.file_name}</p>
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
                    <span className="shrink-0 text-xs text-navy-3">Indisponível</span>
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
