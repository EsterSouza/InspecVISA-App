import React, { useEffect, useState } from 'react';
import {
  CalendarOff,
  Copy,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import type {
  Client,
  ClientPortalFeature,
  ClientPortalFeatureRow,
  ClientPortalSettings,
  SchedulingSuspensionMode,
} from '../../types';
import {
  AppointmentAdminService,
  type ClientPortalAccountRow,
  type ClientPortalInvoiceRow,
} from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'operação falhou.';
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

interface ClientPortalManagementProps {
  accounts: ClientPortalAccountRow[];
  clients: Client[];
  onChanged: () => void;
}

export function ClientPortalManagement({ accounts, clients, onChanged }: ClientPortalManagementProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<{
    email: string;
    code: string;
    accountName: string;
    unitCount: number;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<ClientPortalAccountRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ClientPortalAccountRow | null>(null);
  const [invoicesTarget, setInvoicesTarget] = useState<ClientPortalAccountRow | null>(null);
  const [accessTarget, setAccessTarget] = useState<ClientPortalAccountRow | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const portalUrl = `${window.location.origin}/cliente`;
  const clientNameMap = new Map(clients.map((client) => [client.id, client.name]));

  const sendAccessEmail = async (params: {
    email: string;
    code: string;
    accountName: string;
    unitCount: number;
  }) => {
    await AppointmentAdminService.sendPortalAccessEmail({
      email: params.email,
      code: params.code,
      accountName: params.accountName,
      portalUrl,
      unitCount: params.unitCount,
    });
  };

  const handleRegenerate = async (account: ClientPortalAccountRow) => {
    if (!confirm(`Gerar uma nova senha para "${account.name}"? A senha atual deixa de funcionar.`)) return;
    setBusyId(account.id);
    try {
      const code = generateAccessCode();
      await AppointmentAdminService.setPortalAccessCode(account.id, code);
      let emailSent = false;
      let emailError: string | undefined;
      try {
        await sendAccessEmail({
          email: account.email,
          code,
          accountName: account.name,
          unitCount: account.client_ids.length,
        });
        emailSent = true;
      } catch (err) {
        emailError = errorMessage(err);
      }
      setNewCode({
        email: account.email,
        code,
        accountName: account.name,
        unitCount: account.client_ids.length,
        emailSent,
        emailError,
      });
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (account: ClientPortalAccountRow) => {
    if (!confirm(`Remover o acesso de "${account.name}"? O cliente não conseguirá mais entrar no portal.`)) return;
    setBusyId(account.id);
    try {
      await AppointmentAdminService.deletePortalAccount(account.id);
      onChanged();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center text-lg font-semibold text-gray-900">
          <KeyRound className="mr-2 h-5 w-5 text-primary-600" />
          Portal do Cliente — acessos
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" /> Configurações institucionais
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Criar acesso
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        O cliente entra em <span className="font-mono font-medium text-primary-700">{portalUrl}</span>{' '}
        com e-mail/usuario e senha permanente, e acompanha todas as unidades vinculadas (agendamentos,
        relatorios, fotos e anexos).
      </p>

      {accounts.length === 0 ? (
        <Card className="border-dashed bg-gray-50 py-8 text-center">
          <p className="text-sm text-gray-500">Nenhum acesso criado ainda.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{account.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      account.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {account.payment_status === 'paid' ? 'Pago' : 'Pgto pendente'}
                    {account.payment_type ? ` · ${account.payment_type === 'monthly' ? 'mensal' : 'único'}` : ''}
                  </span>
                  {account.scheduling_suspension_mode === 'suspended' && (
                    <span className="flex items-center gap-1 shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                      <CalendarOff className="h-3 w-3" /> Agendamento suspenso
                    </span>
                  )}
                  {account.scheduling_suspension_mode === 'always_open' && (
                    <span className="flex items-center gap-1 shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                      Agenda liberada mesmo em atraso
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">
                  {account.email} · {account.client_ids.length} unidade{account.client_ids.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 max-w-2xl truncate text-xs text-gray-500">
                  Unidades: {account.client_ids.map((id) => clientNameMap.get(id) || id).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setAccessTarget(account)}
                  title="Acesso do portal: o que este cliente enxerga e quando"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setPaymentTarget(account)}
                  title="Pagamento (link, tipo e status)"
                >
                  <CreditCard className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setInvoicesTarget(account)}
                  title="Notas fiscais por mês de competência"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText([
                        `Portal do Cliente: ${portalUrl}`,
                        `E-mail: ${account.email}`,
                        account.username ? `Usuario: ${account.username}` : '',
                        account.access_code_plain ? `Senha: ${account.access_code_plain}` : '',
                      ].filter(Boolean).join('\n'))
                      .then(() => {
                        setCopiedId(account.id);
                        window.setTimeout(() => setCopiedId(null), 2000);
                      })
                      .catch(() => {});
                  }}
                  title={copiedId === account.id ? 'Link copiado' : 'Copiar link de acesso ao portal'}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setEditTarget(account)}
                  title="Editar acesso e unidades vinculadas"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => void handleRegenerate(account)}
                  title="Gerar nova senha"
                >
                  {busyId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => void handleDelete(account)}
                  className="text-red-500 hover:bg-red-50"
                  title="Remover acesso"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePortalAccountModal
          clients={clients}
          onClose={() => setShowCreate(false)}
          onCreated={async (email, code, accountName, unitCount) => {
            setShowCreate(false);
            let emailSent = false;
            let emailError: string | undefined;
            try {
              await sendAccessEmail({ email, code, accountName, unitCount });
              emailSent = true;
            } catch (err) {
              emailError = errorMessage(err);
            }
            setNewCode({ email, code, accountName, unitCount, emailSent, emailError });
            onChanged();
          }}
        />
      )}

      {showSettings && (
        <PortalSettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={() => setShowSettings(false)}
        />
      )}

      {newCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-bold text-gray-900">Senha gerada</h3>
              <p className="mt-1 text-sm text-gray-500">
                Envie ao cliente. Esta senha permanece valida ate voce gerar uma nova.
              </p>
              <div className={`mt-3 rounded-md border p-2 text-xs ${
                newCode.emailSent
                  ? 'border-green-100 bg-green-50 text-green-700'
                  : 'border-amber-100 bg-amber-50 text-amber-800'
              }`}>
                {newCode.emailSent
                  ? 'E-mail enviado automaticamente para o cliente.'
                  : `E-mail nao enviado. ${newCode.emailError || 'Copie os dados e envie manualmente.'}`}
              </div>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">{newCode.accountName}</p>
                <p className="text-xs text-gray-400">{newCode.email}</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-gray-900">
                  {newCode.code}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {newCode.unitCount} unidade{newCode.unitCount === 1 ? '' : 's'} vinculada{newCode.unitCount === 1 ? '' : 's'}
                </p>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`Portal do Cliente: ${portalUrl}\nE-mail: ${newCode.email}\nSenha: ${newCode.code}`)
                    .catch(() => {});
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copiar dados de acesso
              </Button>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setNewCode(null)}>
                Fechar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {editTarget && (
        <EditPortalUnitsModal
          account={editTarget}
          clients={clients}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onChanged();
          }}
        />
      )}

      {accessTarget && (
        <PortalAccessModal
          account={accessTarget}
          onClose={() => setAccessTarget(null)}
          onSaved={onChanged}
        />
      )}

      {paymentTarget && (
        <PaymentModal
          account={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => {
            setPaymentTarget(null);
            onChanged();
          }}
        />
      )}

      {invoicesTarget && (
        <InvoicesModal account={invoicesTarget} onClose={() => setInvoicesTarget(null)} />
      )}
    </section>
  );
}

// ─── Modal: notas fiscais por mês de competência ──────────────

interface InvoicesModalProps {
  account: ClientPortalAccountRow;
  onClose: () => void;
}

function monthInputValue(competenceMonth: string): string {
  return competenceMonth.slice(0, 7);
}

function InvoicesModal({ account, onClose }: InvoicesModalProps) {
  const [invoices, setInvoices] = useState<ClientPortalInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await AppointmentAdminService.listInvoices(account.id);
      setInvoices(rows);
    } catch (err) {
      setError(errorMessage(err));
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
    if (!confirm('Remover esta nota fiscal? O cliente deixará de vê-la no portal.')) return;
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
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Notas fiscais</h3>
          <p className="mb-5 text-sm text-gray-500">{account.name}</p>

          <div className="mb-5 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <label className="space-y-1 text-xs font-medium text-gray-700">
                Mês de competência
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-gray-700">
                Arquivo (PDF)
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-300 bg-white p-1.5 text-sm"
                />
              </label>
            </div>
            <Button type="button" size="sm" className="w-full" disabled={uploading} onClick={() => void handleUpload()}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Enviar nota fiscal
            </Button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhuma nota fiscal enviada ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {monthInputValue(invoice.competence_month)}
                    </p>
                    <p className="truncate text-xs text-gray-500">{invoice.file_name}</p>
                  </div>
                  {invoice.signed_url && (
                    <a
                      href={invoice.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg p-2 text-primary-600 hover:bg-primary-50"
                      title="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={deletingId === invoice.id}
                    onClick={() => void handleDelete(invoice)}
                    className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"
                    title="Remover"
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
    </div>
  );
}

// ─── Modal: pagamento do acesso do cliente ────────────────────

interface PaymentModalProps {
  account: ClientPortalAccountRow;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Central de acesso do portal (PORT-01) ────────────────────
//
// Um lugar só para "o que este cliente enxerga e quando". Pagamento continua no modal de
// Pagamento — lá é dinheiro; aqui é acesso.

const PORTAL_FEATURES: { key: ClientPortalFeature; label: string; hint: string }[] = [
  { key: 'reports', label: 'Relatórios e documentos', hint: 'PDFs de laudo e anexos publicados na visita.' },
  { key: 'photos', label: 'Fotos', hint: 'Fotos da inspeção anexadas ao compromisso.' },
  { key: 'action_plan', label: 'Plano de ação', hint: 'Pendências publicadas com prazo e responsável.' },
  { key: 'compliance', label: 'Indicadores de conformidade', hint: 'Percentuais, classificação e contagem de não conformidades.' },
];

const SCHEDULING_MODES: { key: SchedulingSuspensionMode; label: string; hint: string }[] = [
  { key: 'auto', label: 'Automático', hint: 'Suspende sozinho quando a conta passa da tolerância de atraso, e volta quando o pagamento é marcado como pago.' },
  { key: 'always_open', label: 'Sempre liberado', hint: 'Exceção manual: continua agendando mesmo em atraso.' },
  { key: 'suspended', label: 'Suspenso', hint: 'Suspenso na mão, independente de pagamento.' },
];

/** `datetime-local` só aceita `YYYY-MM-DDTHH:mm`; o banco devolve ISO com fuso. */
function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface PortalAccessModalProps {
  account: ClientPortalAccountRow;
  onClose: () => void;
  onSaved: () => void;
}

function PortalAccessModal({ account, onClose, onSaved }: PortalAccessModalProps) {
  const [rows, setRows] = useState<ClientPortalFeatureRow[]>([]);
  const [mode, setMode] = useState<SchedulingSuspensionMode>(account.scheduling_suspension_mode);
  const [graceDays, setGraceDays] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      AppointmentAdminService.listPortalFeatures(account.id),
      AppointmentAdminService.getPortalSettings().catch(() => null),
    ])
      .then(([featureRows, settings]) => {
        setRows(featureRows);
        if (settings?.overdue_grace_days != null) setGraceDays(settings.overdue_grace_days);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [account.id]);

  useEffect(load, [load]);

  const rowFor = (feature: ClientPortalFeature) => rows.find((row) => row.feature === feature);

  const save = async (feature: ClientPortalFeature, patch: Partial<ClientPortalFeatureRow>) => {
    const current = rowFor(feature);
    setBusy(feature);
    setError(null);
    try {
      await AppointmentAdminService.setPortalFeature(account.id, feature, {
        state: patch.state ?? current?.state ?? 'released',
        releaseAt: patch.release_at !== undefined ? patch.release_at : current?.release_at ?? null,
        hideAt: patch.hide_at !== undefined ? patch.hide_at : current?.hide_at ?? null,
        lockWhenOverdue:
          patch.lock_when_overdue !== undefined ? patch.lock_when_overdue : current?.lock_when_overdue ?? false,
      });
      load();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveMode = async (next: SchedulingSuspensionMode) => {
    setBusy('scheduling');
    setError(null);
    try {
      await AppointmentAdminService.setSchedulingMode(account.id, next);
      setMode(next);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Acesso do portal</h3>
          <p className="mb-5 text-sm text-gray-500">{account.name}</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-sm font-bold text-gray-800">Agendamento</p>
            <p className="mb-3 text-xs text-gray-500">
              Tolerância atual: {graceDays} dia{graceDays === 1 ? '' : 's'} depois do vencimento. Muda em
              Configurações do portal e vale para toda a carteira.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SCHEDULING_MODES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={busy === 'scheduling'}
                  onClick={() => void saveMode(option.key)}
                  title={option.hint}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    mode === option.key
                      ? 'border-primary-500 bg-primary-50 text-primary-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="mt-0.5 block leading-tight">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mb-1 text-sm font-bold text-gray-800">O que o cliente enxerga</p>
          <p className="mb-3 text-xs text-gray-500">
            Atraso de pagamento <span className="font-semibold">não</span> esconde o que já foi entregue. Só o que
            estiver marcado abaixo fecha sozinho quando a conta atrasa.
          </p>

          {loading ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-400">
              Carregando as travas desta conta...
            </div>
          ) : (
            <div className="space-y-3">
              {PORTAL_FEATURES.map(({ key, label, hint }) => {
                const row = rowFor(key);
                const state = row?.state ?? 'released';
                return (
                  <div key={key} className="rounded-xl border border-gray-100 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-400">{hint}</p>
                      </div>
                      {busy === key && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(['released', 'hidden', 'scheduled'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          disabled={busy === key}
                          onClick={() =>
                            void save(key, {
                              state: option,
                              // Programar sem data é recusado pelo banco; sugere daqui a uma semana.
                              release_at:
                                option === 'scheduled'
                                  ? row?.release_at ||
                                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                                  : null,
                            })
                          }
                          className={`h-9 rounded-lg border text-xs font-bold transition-colors ${
                            state === option
                              ? option === 'hidden'
                                ? 'border-red-400 bg-red-50 text-red-700'
                                : option === 'scheduled'
                                  ? 'border-sky-400 bg-sky-50 text-sky-700'
                                  : 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {option === 'released' ? 'Liberado' : option === 'hidden' ? 'Oculto' : 'Programado'}
                        </button>
                      ))}
                    </div>

                    {state === 'scheduled' && (
                      <label className="mt-2 block text-xs text-gray-600">
                        Liberar a partir de
                        <input
                          type="datetime-local"
                          value={toLocalInput(row?.release_at ?? null)}
                          disabled={busy === key}
                          onChange={(e) =>
                            void save(key, {
                              state: 'scheduled',
                              release_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
                        />
                      </label>
                    )}

                    <label className="mt-2 block text-xs text-gray-600">
                      Ocultar a partir de <span className="text-gray-400">(fim de contrato — opcional)</span>
                      <input
                        type="datetime-local"
                        value={toLocalInput(row?.hide_at ?? null)}
                        disabled={busy === key}
                        onChange={(e) =>
                          void save(key, { hide_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
                      />
                    </label>

                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!row?.lock_when_overdue}
                        disabled={busy === key}
                        onChange={(e) => void save(key, { lock_when_overdue: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Fechar sozinho enquanto o pagamento estiver atrasado
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentModal({ account, onClose, onSaved }: PaymentModalProps) {
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
      <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Pagamento</h3>
          <p className="mb-5 text-sm text-gray-500">{account.name}</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Link de pagamento</label>
              <input
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
                className="w-full rounded-xl border border-gray-300 p-3 text-sm"
              />
              <p className="text-xs text-gray-400">O link deve oferecer Pix, boleto, NuPay e cartao de credito/debito no provedor de pagamento.</p>
              <p className="text-xs text-gray-400">O cliente vê um botão "Pagar agora" no portal enquanto estiver pendente.</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">Links adicionais</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentLinks((prev) => [...prev, { label: '', url: '' }])}
                >
                  Adicionar mais
                </Button>
              </div>
              <div className="space-y-2">
                {paymentLinks.map((paymentLink, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                    <input
                      type="text"
                      value={paymentLink.label || ''}
                      onChange={(e) => setPaymentLinks((prev) => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))}
                      placeholder={index === 0 ? 'Principal' : 'Ex: Mensalidade'}
                      className="rounded-xl border border-gray-300 p-2.5 text-sm"
                    />
                    <input
                      type="url"
                      value={paymentLink.url}
                      onChange={(e) => {
                        setPaymentLinks((prev) => prev.map((item, i) => i === index ? { ...item, url: e.target.value } : item));
                        if (index === 0) setLink(e.target.value);
                      }}
                      placeholder="https://..."
                      className="rounded-xl border border-gray-300 p-2.5 text-sm"
                    />
                    {paymentLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPaymentLinks((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-xl p-2 text-red-500 hover:bg-red-50"
                        title="Remover link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tipo de pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setType('monthly')} className={`h-11 rounded-xl border text-sm font-bold ${type === 'monthly' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>Mensal</button>
                <button type="button" onClick={() => setType('one_time')} className={`h-11 rounded-xl border text-sm font-bold ${type === 'one_time' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>Único</button>
              </div>
            </div>

            {type === 'monthly' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Data limite do pagamento mensal</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Situação</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setStatus('pending')} className={`h-11 rounded-xl border text-sm font-bold ${status === 'pending' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}>Pendente</button>
                <button type="button" onClick={() => setStatus('paid')} className={`h-11 rounded-xl border text-sm font-bold ${status === 'paid' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>Pago</button>
              </div>
            </div>

            {/* Suspender agendamento saiu daqui: virou modo (auto/exceção/manual) em
                "Acesso do portal", junto com as demais travas do que o cliente enxerga.
                Aqui fica só dinheiro. */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                disabled={sendingOverdue}
                onClick={() => void handleSendOverdueEmail()}
              >
                {sendingOverdue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Enviar cobrança por atraso
              </Button>
              {overdueSent && (
                <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                  Aviso de atraso enviado para {account.email}.
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            {sent && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">
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

interface PortalSettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function PortalSettingsModal({ onClose, onSaved }: PortalSettingsModalProps) {
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AppointmentAdminService.getPortalSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.savePortalSettings({
        tutorial_pdf_url: settings.tutorial_pdf_url,
        support_whatsapp: settings.support_whatsapp,
        quick_access_enabled: settings.quick_access_enabled,
        multi_purpose_schedule: settings.multi_purpose_schedule,
        action_plan_enabled: settings.action_plan_enabled,
        service_requests_enabled: settings.service_requests_enabled,
        overdue_grace_days: settings.overdue_grace_days,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setFlag = (
    key: 'quick_access_enabled' | 'multi_purpose_schedule' | 'action_plan_enabled' | 'service_requests_enabled',
    checked: boolean
  ) => setSettings((current) => current ? { ...current, [key]: checked } : current);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Configurações institucionais do portal</h3>
          <p className="mb-5 text-sm text-gray-500">
            Estes dados valem para todas as contas deste tenant e podem ser alterados sem novo deploy.
          </p>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : settings ? (
            <div className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium text-gray-700">
                Tutorial do portal (PDF)
                <input
                  type="url"
                  value={settings.tutorial_pdf_url || ''}
                  onChange={(e) => setSettings({ ...settings, tutorial_pdf_url: e.target.value || null })}
                  placeholder="https://.../tutorial.pdf"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-normal"
                />
                <span className="block text-xs font-normal text-gray-500">Informe uma URL HTTPS pública para o PDF.</span>
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-gray-700">
                WhatsApp de suporte
                <input
                  type="tel"
                  value={settings.support_whatsapp || ''}
                  onChange={(e) => setSettings({ ...settings, support_whatsapp: e.target.value || null })}
                  placeholder="Ex.: +55 21 99999-9999"
                  maxLength={40}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-normal"
                />
                <span className="block text-xs font-normal text-gray-500">Canal institucional exibido ao cliente quando habilitado.</span>
              </label>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">Recursos habilitados por tenant</p>
                {[
                  ['quick_access_enabled', 'Acessos rápidos'],
                  ['multi_purpose_schedule', 'Agenda multiuso'],
                  ['action_plan_enabled', 'Plano de ação'],
                  ['service_requests_enabled', 'Solicitações de consultoria'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings[key as keyof ClientPortalSettings] === true}
                      onChange={(e) => setFlag(key as Parameters<typeof setFlag>[0], e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <label className="block space-y-1.5 text-sm font-medium text-gray-700">
                Tolerância de atraso (dias)
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={settings.overdue_grace_days ?? 5}
                  onChange={(e) =>
                    setSettings({ ...settings, overdue_grace_days: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-normal"
                />
                <span className="block text-xs font-normal text-gray-500">
                  Dias depois do vencimento antes de a conta contar como em atraso. Só conta quando há data de
                  vencimento cadastrada, e é o que dispara a suspensão automática de agendamento.
                </span>
              </label>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
                <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar configurações
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {error || 'Não foi possível carregar as configurações.'}
              </div>
              <Button type="button" variant="ghost" className="w-full" onClick={onClose}>Fechar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface EditPortalUnitsModalProps {
  account: ClientPortalAccountRow;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}

function EditPortalUnitsModal({ account, clients, onClose, onSaved }: EditPortalUnitsModalProps) {
  const [email, setEmail] = useState(account.email);
  const [username, setUsername] = useState(account.username || '');
  const [mainDriveFolderUrl, setMainDriveFolderUrl] = useState(account.main_drive_folder_url || '');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(account.client_ids));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!email.trim()) {
      setError('Informe o e-mail de acesso.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Selecione ao menos uma unidade (ou remova o acesso).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.updatePortalAccount(account.id, {
        email,
        username,
        mainDriveFolderUrl,
      });
      await AppointmentAdminService.setPortalAccountClients(account.id, [...selectedIds]);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Editar acesso</h3>
          <p className="mb-5 text-sm text-gray-500">
            {account.name} — {selectedIds.size} unidade{selectedIds.size === 1 ? '' : 's'} vinculada
            {selectedIds.size === 1 ? '' : 's'}
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-gray-700">
              E-mail de acesso
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-normal"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-gray-700">
              Nome de usuario
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario sem espacos"
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-normal"
              />
            </label>
          </div>

          <label className="mb-4 block space-y-1.5 text-sm font-medium text-gray-700">
            Pasta Principal Completa da conta
            <input
              type="url"
              value={mainDriveFolderUrl}
              onChange={(e) => setMainDriveFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-normal"
            />
            <span className="block text-xs font-normal text-gray-500">
              Pasta raiz única desta conta. Não altera as Pastas Sanitárias Personalizadas de cada unidade.
            </span>
          </label>

          <input
            type="text"
            placeholder="Filtrar unidades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 w-full rounded-xl border border-gray-300 p-2.5 text-sm"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
            {filtered.length === 0 ? (
              <p className="p-2 text-sm text-gray-400">Nenhuma unidade encontrada.</p>
            ) : (
              filtered.map((client) => (
                <label
                  key={client.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(client.id)}
                    onChange={() => toggle(client.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-gray-800">{client.name}</span>
                </label>
              ))
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar acesso
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CreatePortalAccountModalProps {
  clients: Client[];
  onClose: () => void;
  onCreated: (email: string, code: string, accountName: string, unitCount: number) => void | Promise<void>;
}

function CreatePortalAccountModal({ clients, onClose, onCreated }: CreatePortalAccountModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Informe o nome e o e-mail do cliente.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Selecione ao menos uma unidade.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const code = generateAccessCode();
      await AppointmentAdminService.createPortalAccount({
        name: name.trim(),
        email: email.trim(),
        code,
        clientIds: [...selectedIds],
      });
      await onCreated(email.trim().toLowerCase(), code, name.trim(), selectedIds.size);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Criar acesso do cliente</h3>
          <p className="mb-5 text-sm text-gray-500">
            Ideal para franquias e redes: um login acompanha várias unidades.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nome do acesso (ex.: Rede Sênior — Matriz)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm"
            />
            <input
              type="email"
              placeholder="E-mail de login do cliente"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Unidades vinculadas ({selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'})
              </label>
              <input
                type="text"
                placeholder="Filtrar unidades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm"
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
                {filtered.length === 0 ? (
                  <p className="p-2 text-sm text-gray-400">Nenhuma unidade encontrada.</p>
                ) : (
                  filtered.map((client) => (
                    <label
                      key={client.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={() => toggle(client.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600"
                      />
                      <span className="min-w-0 flex-1 truncate text-gray-800">{client.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleCreate()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar acesso
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
