import { useState } from 'react';
import {
  CalendarOff,
  Copy,
  CreditCard,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { Client } from '../../types';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { errorMessage, generateAccessCode } from './portal/shared';
import { toast } from '../../store/useToastStore';
import { InvoicesModal } from './portal/InvoicesModal';
import { PaymentModal } from './portal/PaymentModal';
import { PortalAccessModal } from './portal/PortalAccessModal';
import { PortalSettingsModal } from './portal/PortalSettingsModal';
import { EditPortalUnitsModal } from './portal/EditPortalUnitsModal';
import { CreatePortalAccountModal } from './portal/CreatePortalAccountModal';

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
  const { confirm, confirmDialog } = useConfirmDialog();

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
    const ok = await confirm({
      title: `Gerar uma nova senha para "${account.name}"?`,
      description: 'A senha atual deixa de funcionar.',
      confirmLabel: 'Gerar nova senha',
    });
    if (!ok) return;
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
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (account: ClientPortalAccountRow) => {
    const ok = await confirm({
      title: `Remover o acesso de "${account.name}"?`,
      description: 'O cliente não conseguirá mais entrar no portal.',
      confirmLabel: 'Remover acesso',
    });
    if (!ok) return;
    setBusyId(account.id);
    try {
      await AppointmentAdminService.deletePortalAccount(account.id);
      onChanged();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center text-lg font-semibold text-navy">
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

      <p className="mb-4 text-sm text-navy-3">
        O cliente entra em <span className="font-mono font-medium text-primary-700">{portalUrl}</span>{' '}
        com e-mail/usuario e senha permanente, e acompanha todas as unidades vinculadas (agendamentos,
        relatorios, fotos e anexos).
      </p>

      {accounts.length === 0 ? (
        <Card className="border-dashed bg-surface-sunken py-8 text-center">
          <p className="text-sm text-navy-3">Nenhum acesso criado ainda.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-default bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-navy">{account.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      account.payment_status === 'paid' ? 'bg-success-soft text-success-soft-ink' : 'bg-amber-soft text-amber-soft-ink'
                    }`}
                  >
                    {account.payment_status === 'paid' ? 'Pago' : 'Pgto pendente'}
                    {account.payment_type ? ` · ${account.payment_type === 'monthly' ? 'mensal' : 'único'}` : ''}
                  </span>
                  {account.scheduling_suspension_mode === 'suspended' && (
                    <span className="flex items-center gap-1 shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-danger-soft-ink">
                      <CalendarOff className="h-3 w-3" /> Agendamento suspenso
                    </span>
                  )}
                  {account.scheduling_suspension_mode === 'always_open' && (
                    <span className="flex items-center gap-1 shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                      Agenda liberada mesmo em atraso
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-navy-3">
                  {account.email} · {account.client_ids.length} unidade{account.client_ids.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 max-w-2xl truncate text-xs text-navy-3">
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
                  aria-label={`Acesso do portal de ${account.name}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setPaymentTarget(account)}
                  title="Pagamento (link, tipo e status)"
                  aria-label={`Pagamento de ${account.name}`}
                >
                  <CreditCard className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setInvoicesTarget(account)}
                  title="Notas fiscais por mês de competência"
                  aria-label={`Notas fiscais de ${account.name}`}
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
                  aria-label={copiedId === account.id ? `Link copiado para ${account.name}` : `Copiar link de acesso de ${account.name}`}
                >
                  <Copy className="h-4 w-4" />
                  {copiedId === account.id && <span className="sr-only" aria-live="polite">Link copiado</span>}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => setEditTarget(account)}
                  title="Editar acesso e unidades vinculadas"
                  aria-label={`Editar acesso de ${account.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => void handleRegenerate(account)}
                  title="Gerar nova senha"
                  aria-label={`Gerar nova senha para ${account.name}`}
                >
                  {busyId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === account.id}
                  onClick={() => void handleDelete(account)}
                  className="text-danger hover:bg-danger-soft"
                  title="Remover acesso"
                  aria-label={`Remover acesso de ${account.name}`}
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
          <Card role="dialog" aria-modal="true" aria-labelledby="new-code-title" className="w-full max-w-sm shadow-2xl">
            <CardContent className="p-6 text-center">
              <h3 id="new-code-title" className="text-lg font-bold text-navy">Senha gerada</h3>
              <p className="mt-1 text-sm text-navy-3">
                Envie ao cliente. Esta senha permanece valida ate voce gerar uma nova.
              </p>
              <div
                role="status"
                aria-live="polite"
                className={`mt-3 rounded-md border p-2 text-xs ${
                  newCode.emailSent
                    ? 'border-success-soft-border bg-success-soft text-success-soft-ink'
                    : 'border-amber-soft-border bg-amber-soft text-amber-soft-ink'
                }`}
              >
                {newCode.emailSent
                  ? 'E-mail enviado automaticamente para o cliente.'
                  : `E-mail nao enviado. ${newCode.emailError || 'Copie os dados e envie manualmente.'}`}
              </div>
              <div className="mt-4 rounded-xl border border-default bg-surface-sunken p-4">
                <p className="text-xs font-semibold text-navy-3">{newCode.accountName}</p>
                <p className="text-xs text-navy-3">{newCode.email}</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-navy">
                  {newCode.code}
                </p>
                <p className="mt-2 text-xs text-navy-3">
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
      {confirmDialog}
    </section>
  );
}
