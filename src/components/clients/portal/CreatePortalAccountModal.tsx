import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Client } from '../../../types';
import { AppointmentAdminService } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, errorMessage, generateAccessCode } from './shared';

interface CreatePortalAccountModalProps {
  clients: Client[];
  onClose: () => void;
  onCreated: (email: string, code: string, accountName: string, unitCount: number) => void | Promise<void>;
}

export function CreatePortalAccountModal({ clients, onClose, onCreated }: CreatePortalAccountModalProps) {
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
      <Card role="dialog" aria-modal="true" aria-labelledby="create-portal-account-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 id="create-portal-account-title" className="mb-1 text-xl font-bold text-navy">Criar acesso do cliente</h3>
          <p className="mb-5 text-sm text-navy-3">
            Ideal para franquias e redes: um login acompanha várias unidades.
          </p>

          <div className="space-y-4">
            <label htmlFor="create-portal-name" className="sr-only">Nome do acesso</label>
            <input
              id="create-portal-name"
              type="text"
              placeholder="Nome do acesso (ex.: Rede Sênior — Matriz)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={TEXT_INPUT}
            />
            <label htmlFor="create-portal-email" className="sr-only">E-mail de login do cliente</label>
            <input
              id="create-portal-email"
              type="email"
              placeholder="E-mail de login do cliente"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={TEXT_INPUT}
            />

            <div className="space-y-2">
              <label htmlFor="create-portal-unit-search" className="text-sm font-medium text-navy-2">
                Unidades vinculadas ({selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'})
              </label>
              <input
                id="create-portal-unit-search"
                type="text"
                placeholder="Filtrar unidades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={TEXT_INPUT.replace('p-3', 'p-2.5')}
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-default p-2">
                {filtered.length === 0 ? (
                  <p className="p-2 text-sm text-navy-3">Nenhuma unidade encontrada.</p>
                ) : (
                  filtered.map((client) => (
                    <label
                      key={client.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={() => toggle(client.id)}
                        className="h-4 w-4 rounded border-control text-primary-600"
                      />
                      <span className="min-w-0 flex-1 truncate text-navy">{client.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
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
