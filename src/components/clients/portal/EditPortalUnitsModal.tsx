import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Client } from '../../../types';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { errorMessage } from './shared';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Checkbox } from '../../ui/Checkbox';

interface EditPortalUnitsModalProps {
  account: ClientPortalAccountRow;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditPortalUnitsModal({ account, clients, onClose, onSaved }: EditPortalUnitsModalProps) {
  const [email, setEmail] = useState(account.email);
  const [username, setUsername] = useState(account.username || '');
  const [mainDriveFolderUrl, setMainDriveFolderUrl] = useState(account.main_drive_folder_url || '');
  const [tutorialPdfUrl, setTutorialPdfUrl] = useState(account.tutorial_pdf_url || '');
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
        tutorialPdfUrl,
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
      <Card role="dialog" aria-modal="true" aria-labelledby="edit-portal-units-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 id="edit-portal-units-title" className="mb-1 text-xl font-bold text-navy">Editar acesso</h3>
          <p className="mb-5 text-sm text-navy-3">
            {account.name} — {selectedIds.size} unidade{selectedIds.size === 1 ? '' : 's'} vinculada
            {selectedIds.size === 1 ? '' : 's'}
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="E-mail de acesso" htmlFor="edit-portal-email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Nome de usuario" htmlFor="edit-portal-username">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario sem espacos"
              />
            </Field>
          </div>

          <Field
            label="Pasta Principal Completa da conta"
            htmlFor="edit-portal-drive-folder"
            hint="Pasta raiz única desta conta. Não altera as Pastas Sanitárias Personalizadas de cada unidade."
            className="mb-4"
          >
            <Input
              type="url"
              value={mainDriveFolderUrl}
              onChange={(e) => setMainDriveFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </Field>

          <Field
            label="Tutorial do portal desta conta"
            htmlFor="edit-portal-tutorial"
            hint="PDF que este cliente vê nos acessos rápidos. Em branco, ele recebe o tutorial padrão configurado em Configurações do portal."
            className="mb-4"
          >
            <Input
              type="url"
              value={tutorialPdfUrl}
              onChange={(e) => setTutorialPdfUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </Field>

          <Input
            id="edit-portal-unit-search"
            type="search"
            aria-label="Filtrar unidades"
            placeholder="Filtrar unidades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-default p-2">
            {filtered.length === 0 ? (
              <p className="p-2 text-sm text-navy-3">Nenhuma unidade encontrada.</p>
            ) : (
              filtered.map((client) => (
                <Checkbox
                  key={client.id}
                  checked={selectedIds.has(client.id)}
                  onChange={() => toggle(client.id)}
                  className="items-center rounded-lg px-2 py-1.5 hover:bg-surface-hover"
                  boxClassName="mt-0"
                  label={<span className="block min-w-0 truncate">{client.name}</span>}
                />
              ))
            )}
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
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
