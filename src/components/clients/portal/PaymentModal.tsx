import { useState } from 'react';
import { Loader2, Mail, Trash2 } from 'lucide-react';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, errorMessage } from './shared';

interface PaymentModalProps {
  account: ClientPortalAccountRow;
  onClose: () => void;
  onSaved: () => void;
}

export function PaymentModal({ account, onClose, onSaved }: PaymentModalProps) {
  const [type, setType] = useState<'monthly' | 'one_time' | null>(account.payment_type);
  const [status, setStatus] = useState<'pending' | 'paid'>(account.payment_status);
  const [link, setLink] = useState(account.payment_link || '');
  const [paymentLinks, setPaymentLinks] = useState(
    account.payment_links?.length
      ? account.payment_links
      : [{ label: 'Principal', url: account.payment_link || '' }]
  );
  const [dueDate, setDueDate] = useState(account.payment_due_date || '');
  const [sendingOverdue, setSendingOverdue] = useState(false);
  const [overdueSent, setOverdueSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOverdueEmail = async () => {
    setSendingOverdue(true);
    setOverdueSent(false);
    setError(null);
    try {
      await AppointmentAdminService.sendPaymentOverdueEmail({
        email: account.email,
        accountName: account.name,
        dueDate: dueDate || null,
        paymentLink: link.trim() || null,
      });
      setOverdueSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSendingOverdue(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const cleanLinks = paymentLinks.filter((item) => item.url.trim());
      await AppointmentAdminService.setPortalPayment(account.id, { type, status, link, dueDate, links: cleanLinks });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSendPaymentEmail = async () => {
    if (!link.trim()) {
      setError('Informe o link de pagamento antes de enviar.');
      return;
    }
    setSending(true);
    setSent(false);
    setError(null);
    try {
      const cleanLinks = paymentLinks.filter((item) => item.url.trim());
      await AppointmentAdminService.setPortalPayment(account.id, { type, status, link, dueDate, links: cleanLinks });
      await AppointmentAdminService.sendPaymentLinkEmail({
        email: account.email,
        accountName: account.name,
        paymentLink: link.trim(),
        paymentType: type,
        dueDate: type === 'monthly' ? dueDate || null : null,
      });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="payment-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 id="payment-title" className="mb-1 text-xl font-bold text-navy">Pagamento</h3>
          <p className="mb-5 text-sm text-navy-3">{account.name}</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="payment-link" className="text-sm font-medium text-navy-2">Link de pagamento</label>
              <input
                id="payment-link"
                type="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setPaymentLinks((prev) => {
                    const next = prev.length ? [...prev] : [{ label: 'Principal', url: '' }];
                    next[0] = { ...next[0], label: next[0].label || 'Principal', url: e.target.value };
                    return next;
                  });
                }}
                placeholder="Cole o link (Mercado Pago, Pix, Stripe...)"
                className={TEXT_INPUT}
              />
              <p className="text-xs text-navy-3">O link deve oferecer Pix, boleto, NuPay e cartao de credito/debito no provedor de pagamento.</p>
              <p className="text-xs text-navy-3">O cliente vê um botão "Pagar agora" no portal enquanto estiver pendente.</p>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span id="payment-extra-links-label" className="text-sm font-medium text-navy-2">Links adicionais</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentLinks((prev) => [...prev, { label: '', url: '' }])}
                >
                  Adicionar mais
                </Button>
              </div>
              <div className="space-y-2" role="group" aria-labelledby="payment-extra-links-label">
                {paymentLinks.map((paymentLink, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                    <label htmlFor={`payment-link-label-${index}`} className="sr-only">Nome do link {index + 1}</label>
                    <input
                      id={`payment-link-label-${index}`}
                      type="text"
                      value={paymentLink.label || ''}
                      onChange={(e) => setPaymentLinks((prev) => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))}
                      placeholder={index === 0 ? 'Principal' : 'Ex: Mensalidade'}
                      className="rounded-xl border border-control p-2.5 text-sm placeholder:text-navy-3"
                    />
                    <label htmlFor={`payment-link-url-${index}`} className="sr-only">URL do link {index + 1}</label>
                    <input
                      id={`payment-link-url-${index}`}
                      type="url"
                      value={paymentLink.url}
                      onChange={(e) => {
                        setPaymentLinks((prev) => prev.map((item, i) => i === index ? { ...item, url: e.target.value } : item));
                        if (index === 0) setLink(e.target.value);
                      }}
                      placeholder="https://..."
                      className="rounded-xl border border-control p-2.5 text-sm placeholder:text-navy-3"
                    />
                    {paymentLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPaymentLinks((prev) => prev.filter((_, i) => i !== index))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-danger hover:bg-danger-soft"
                        aria-label={`Remover link ${paymentLink.label || index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span id="payment-type-label" className="text-sm font-medium text-navy-2">Tipo de pagamento</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="payment-type-label">
                <button type="button" onClick={() => setType('monthly')} aria-pressed={type === 'monthly'} className={`h-11 rounded-xl border text-sm font-bold ${type === 'monthly' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-default text-navy-2'}`}>Mensal</button>
                <button type="button" onClick={() => setType('one_time')} aria-pressed={type === 'one_time'} className={`h-11 rounded-xl border text-sm font-bold ${type === 'one_time' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-default text-navy-2'}`}>Único</button>
              </div>
            </div>

            {type === 'monthly' && (
              <div className="space-y-1.5">
                <label htmlFor="payment-due-date" className="text-sm font-medium text-navy-2">Data limite do pagamento mensal</label>
                <input
                  id="payment-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={TEXT_INPUT}
                />
              </div>
            )}

            <div className="space-y-2">
              <span id="payment-status-label" className="text-sm font-medium text-navy-2">Situação</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="payment-status-label">
                <button type="button" onClick={() => setStatus('pending')} aria-pressed={status === 'pending'} className={`h-11 rounded-xl border text-sm font-bold ${status === 'pending' ? 'border-amber-strong bg-amber-soft text-amber-soft-ink' : 'border-default text-navy-2'}`}>Pendente</button>
                <button type="button" onClick={() => setStatus('paid')} aria-pressed={status === 'paid'} className={`h-11 rounded-xl border text-sm font-bold ${status === 'paid' ? 'border-green-600 bg-green-50 text-green-700' : 'border-default text-navy-2'}`}>Pago</button>
              </div>
            </div>

            {/* Suspender agendamento saiu daqui: virou modo (auto/exceção/manual) em
                "Acesso do portal", junto com as demais travas do que o cliente enxerga.
                Aqui fica só dinheiro. */}
            <div className="rounded-xl border border-default bg-surface-sunken p-3 space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-amber-soft-border text-amber-soft-ink hover:bg-amber-soft"
                disabled={sendingOverdue}
                onClick={() => void handleSendOverdueEmail()}
              >
                {sendingOverdue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Enviar cobrança por atraso
              </Button>
              {overdueSent && (
                <div role="status" aria-live="polite" className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                  Aviso de atraso enviado para {account.email}.
                </div>
              )}
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">{error}</div>
            )}

            {sent && (
              <div role="status" aria-live="polite" className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">
                Link de pagamento enviado para {account.email}.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button type="button" variant="outline" className="flex-1" disabled={sending || saving} onClick={() => void handleSendPaymentEmail()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Enviar link
              </Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
