import { useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import {
  AppointmentAdminService,
  type ClientPortalAccountRow,
  type ClientPortalInvoiceRow,
} from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { useConfirmDialog } from '../../ui/ConfirmDialog';
import { errorMessage } from './shared';

interface InvoicesModalProps {
  account: ClientPortalAccountRow;
  onClose: () => void;
}

function monthInputValue(competenceMonth: string): string {
  return competenceMonth.slice(0, 7);
}

function InvoicesSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando notas fiscais">
      <div className="h-10 animate-pulse rounded-lg bg-surface-sunken" />
      <div className="h-10 animate-pulse rounded-lg bg-surface-sunken" />
      <div className="h-10 animate-pulse rounded-lg bg-surface-sunken" />
      <span className="sr-only">Carregando notas fiscais...</span>
    </div>
  );
}

export function InvoicesModal({ account, onClose }: InvoicesModalProps) {
  const [invoices, setInvoices] = useState<ClientPortalInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await AppointmentAdminService.listInvoices(account.id);
      setInvoices(rows);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione o arquivo da nota fiscal (PDF).');
      return;
    }
    if (!month) {
      setError('Selecione o mês de competência.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await AppointmentAdminService.uploadInvoice(account.id, month, file);
      setFile(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (invoice: ClientPortalInvoiceRow) => {
    const ok = await confirm({
      title: 'Remover nota fiscal?',
      description: 'O cliente deixará de vê-la no portal.',
      confirmLabel: 'Remover nota fiscal',
    });
    if (!ok) return;
    setDeletingId(invoice.id);
    setError(null);
    try {
      await AppointmentAdminService.deleteInvoice(invoice);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="invoices-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 id="invoices-title" className="mb-1 text-xl font-bold text-navy">Notas fiscais</h3>
          <p className="mb-5 text-sm text-navy-3">{account.name}</p>

          <div className="mb-5 space-y-3 rounded-xl border border-default bg-surface-sunken p-3">
            <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <div className="space-y-1 text-xs font-medium text-navy-2">
                <label htmlFor="invoice-month">Mês de competência</label>
                <input
                  id="invoice-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full rounded-lg border border-control p-2 text-sm"
                />
              </div>
              <div className="space-y-1 text-xs font-medium text-navy-2">
                <label htmlFor="invoice-file">Arquivo (PDF)</label>
                <input
                  id="invoice-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-control bg-surface p-1.5 text-sm"
                />
              </div>
            </div>
            <Button type="button" size="sm" className="w-full" disabled={uploading} onClick={() => void handleUpload()}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Enviar nota fiscal
            </Button>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">{error}</div>
          )}

          {loading ? (
            <InvoicesSkeleton />
          ) : loadError ? (
            <div className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
              <p role="alert">{loadError}</p>
              <Button variant="outline" size="sm" className="mt-2 min-h-11" onClick={() => void load()}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-3">Nenhuma nota fiscal enviada ainda.</p>
          ) : (
            <ul className="divide-y divide-default">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {monthInputValue(invoice.competence_month)}
                    </p>
                    <p className="truncate text-xs text-navy-3">{invoice.file_name}</p>
                  </div>
                  {invoice.signed_url && (
                    <a
                      href={invoice.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50"
                      aria-label={`Baixar nota fiscal de ${monthInputValue(invoice.competence_month)}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={deletingId === invoice.id}
                    onClick={() => void handleDelete(invoice)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                    aria-label={`Remover nota fiscal de ${monthInputValue(invoice.competence_month)}`}
                  >
                    {deletingId === invoice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button type="button" variant="ghost" className="mt-5 w-full" onClick={onClose}>
            Fechar
          </Button>
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  );
}
