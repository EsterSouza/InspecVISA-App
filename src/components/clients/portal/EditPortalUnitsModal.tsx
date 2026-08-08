import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Client } from '../../../types';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, errorMessage } from './shared';

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
          <h3 id="edit-portal-units-title" className="mb-1 text-xl font-bold text-gray-900">Editar acesso</h3>
          <p className="mb-5 text-sm text-gray-500">
            {account.name} — {selectedIds.size} unidade{selectedIds.size === 1 ? '' : 's'} vinculada
            {selectedIds.size === 1 ? '' : 's'}
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 text-sm font-medium text-gray-700">
              <label htmlFor="edit-portal-email">E-mail de acesso</label>
              <input
                id="edit-portal-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${TEXT_INPUT} font-normal`}
              />
            </div>
            <div className="space-y-1.5 text-sm font-medium text-gray-700">
              <label htmlFor="edit-portal-username">Nome de usuario</label>
              <input
                id="edit-portal-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario sem espacos"
                className={`${TEXT_INPUT} font-normal`}
              />
            </div>
          </div>

          <div className="mb-4 space-y-1.5 text-sm font-medium text-gray-700">
            <label htmlFor="edit-portal-drive-folder">Pasta Principal Completa da conta</label>
            <input
              id="edit-portal-drive-folder"
              type="url"
              value={mainDriveFolderUrl}
              onChange={(e) => setMainDriveFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className={`${TEXT_INPUT} font-normal`}
            />
            <span className="block text-xs font-normal text-gray-500">
              Pasta raiz única desta conta. Não altera as Pastas Sanitárias Personalizadas de cada unidade.
            </span>
          </div>

          <div className="mb-4 space-y-1.5 text-sm font-medium text-gray-700">
            <label htmlFor="edit-portal-tutorial">Tutorial do portal desta conta</label>
            <input
              id="edit-portal-tutorial"
              type="url"
              value={tutorialPdfUrl}
              onChange={(e) => setTutorialPdfUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className={`${TEXT_INPUT} font-normal`}
            />
            <span className="block text-xs font-normal text-gray-500">
              PDF que este cliente vê nos acessos rápidos. Em branco, ele recebe o tutorial padrão
              configurado em Configurações do portal.
            </span>
          </div>

          <label htmlFor="edit-portal-unit-search" className="sr-only">Filtrar unidades</label>
          <input
            id="edit-portal-unit-search"
            type="text"
            placeholder="Filtrar unidades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`mb-2 ${TEXT_INPUT} p-2.5`}
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
            {filtered.length === 0 ? (
              <p className="p-2 text-sm text-gray-500">Nenhuma unidade encontrada.</p>
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
            <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
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
