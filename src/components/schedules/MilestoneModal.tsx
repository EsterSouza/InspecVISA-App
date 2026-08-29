import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, RotateCcw, Trash2, User } from 'lucide-react';
import type { Client } from '../../types';
import type { ClientMilestone } from '../../services/clientMilestoneService';
import { ClientMilestoneService } from '../../services/clientMilestoneService';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { toDateKey } from '../../utils/date';
import { getLocalActor } from '../../utils/localActor';
import { errorMessage } from '../../utils/errors';
import { toast } from '../../store/useToastStore';

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `undefined`/`null` = criar um marco novo; presente = editar este. */
  milestone?: ClientMilestone | null;
  clients: Client[];
  defaultClientId?: string;
  defaultDate?: Date;
  /** A agenda recarrega a lista de marcos depois de qualquer alteração. */
  onSaved: () => void;
}

/**
 * AGD-02 — "outros pontos" da agenda: modal leve de criar/editar um marco avulso por unidade
 * (sem recorrência, sem categoria). Concluir/reabrir e excluir vivem aqui, não numa tela à
 * parte — é um lembrete pontual, não um registro com histórico a preservar.
 */
export function MilestoneModal({
  isOpen,
  onClose,
  milestone,
  clients,
  defaultClientId,
  defaultDate,
  onSaved,
}: MilestoneModalProps) {
  const isEditing = !!milestone;
  const { confirm, confirmDialog } = useConfirmDialog();

  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [title, setTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (milestone) {
      setClientId(milestone.clientId);
      setClientSearch(clients.find((c) => c.id === milestone.clientId)?.name || '');
      setTitle(milestone.title);
      setMilestoneDate(milestone.milestoneDate);
      setNote(milestone.note || '');
    } else {
      const preselected = defaultClientId ? clients.find((c) => c.id === defaultClientId) : undefined;
      setClientId(preselected?.id || '');
      setClientSearch(preselected?.name || '');
      setTitle('');
      setMilestoneDate(defaultDate ? toDateKey(defaultDate) : '');
      setNote('');
    }
  }, [isOpen, milestone, defaultClientId, defaultDate, clients]);

  const filteredClients = clientSearch
    ? clients.filter((client) => client.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;
  const selectedClient = clients.find((client) => client.id === clientId);

  const selectClient = (client: Client) => {
    setClientId(client.id);
    setClientSearch(client.name);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientId || !title.trim() || !milestoneDate) return;
    setSaving(true);
    try {
      if (isEditing) {
        await ClientMilestoneService.update(milestone.id, {
          title: title.trim(),
          milestoneDate,
          note: note.trim() || null,
        });
        toast.success('Marco atualizado.');
      } else {
        await ClientMilestoneService.create({
          clientId,
          title: title.trim(),
          milestoneDate,
          note: note.trim() || null,
          createdBy: getLocalActor().name,
        });
        toast.success('Marco criado.');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar marco', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async () => {
    if (!milestone) return;
    setSaving(true);
    try {
      await ClientMilestoneService.setDone(milestone.id, !milestone.doneAt);
      toast.success(milestone.doneAt ? 'Marco reaberto.' : 'Marco concluído.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Erro ao atualizar marco', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!milestone) return;
    const ok = await confirm({ title: 'Excluir este marco?', confirmLabel: 'Excluir marco' });
    if (!ok) return;
    setSaving(true);
    try {
      await ClientMilestoneService.remove(milestone.id);
      toast.success('Marco excluído.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Erro ao excluir marco', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar marco' : 'Novo marco'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="milestone-client-search" className="flex items-center text-sm font-medium text-navy-2">
              <User className="mr-2 h-4 w-4 text-navy-3" aria-hidden="true" /> Cliente
            </label>
            <Input
              id="milestone-client-search"
              type="search"
              aria-label="Buscar cliente"
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientId('');
              }}
            />
            <div className="max-h-40 overflow-y-auto rounded-xl border border-default bg-surface">
              {filteredClients.length > 0 ? (
                filteredClients.slice(0, 8).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-default px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50 ${
                      clientId === client.id ? 'bg-primary-50 text-primary-700' : 'text-navy-2'
                    }`}
                  >
                    <span className="font-medium">{client.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-navy-3">Nenhum cliente encontrado.</div>
              )}
            </div>
            {selectedClient && (
              <div className="rounded-xl border border-pink-soft-border bg-pink-soft px-3 py-2 text-sm text-pink-soft-ink">
                Marco vinculado a: <strong>{selectedClient.name}</strong>
              </div>
            )}
          </div>

          <Field label="Título" htmlFor="milestone-title">
            <Input
              id="milestone-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Renovar alvará sanitário"
            />
          </Field>

          <Field label="Data" htmlFor="milestone-date">
            <Input
              id="milestone-date"
              type="date"
              required
              icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              value={milestoneDate}
              onChange={(e) => setMilestoneDate(e.target.value)}
            />
          </Field>

          <Field label="Nota" htmlFor="milestone-note" optional>
            <Textarea
              id="milestone-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Detalhe do que precisa acontecer nesta data..."
            />
          </Field>

          {isEditing && milestone.doneAt && (
            <p className="text-xs font-semibold text-success">
              Concluído em {new Date(milestone.doneAt).toLocaleDateString('pt-BR')}.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {isEditing && (
              <Button type="button" variant="outline" disabled={saving} onClick={handleToggleDone}>
                {milestone.doneAt ? (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir
                  </>
                )}
              </Button>
            )}
            {isEditing && (
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={handleDelete}
                className="text-danger hover:bg-danger-soft"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !clientId || !title.trim() || !milestoneDate}>
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </Modal>
      {confirmDialog}
    </>
  );
}
