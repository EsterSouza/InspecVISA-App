import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, Activity, CheckCircle, Trash2, Edit, RotateCcw, AlertTriangle, ClipboardList, FilterX } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import type { Inspection, Client } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDateTime } from '../utils/imageUtils';
import { ProfileModal } from '../components/profile/ProfileModal';
import { useSettingsStore } from '../store/useSettingsStore';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';

function attachClientData(list: Inspection[], clients: Client[]) {
  const clientMap = new Map<string, Client>(clients.map(client => [client.id, client]));
  return list.map(inspection => {
    const client = clientMap.get(inspection.clientId);
    return {
      ...inspection,
      clientName: client?.name || inspection.clientName || 'Cliente',
      clientCategory: client?.category || inspection.clientCategory,
    };
  });
}

export function Inspections() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [deletedInspections, setDeletedInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [showTrash, setShowTrash] = useState(false);
  const settings = useSettingsStore((s) => s.settings);
  const [showProfileModal, setShowProfileModal] = useState(!settings.name);
  const trashRefreshPromise = useRef<Promise<void> | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadInspections = useCallback(async () => {
    try {
      setLoading(true);
      let list = await InspectionService.getAllInspections();
      
      // Join client data
      const clients = await ClientService.getClients();
      list = attachClientData(list, clients);

      if (filterStatus !== 'all') {
        list = list.filter(i => i.status === filterStatus);
      }
      if (search) {
        list = list.filter(i =>
          i.clientName?.toLowerCase().includes(search.toLowerCase()) ||
          i.consultantName.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Em aberto (em andamento) sempre primeiro; depois por data decrescente.
      list = [...list].sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === 'in_progress') return -1;
          if (b.status === 'in_progress') return 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setInspections(list);

      const deleted = attachClientData(await InspectionService.getDeletedInspections(), clients);
      setDeletedInspections(deleted);
      setLoadError(null);
    } catch (err: any) {
      console.error('Error loading inspections:', err);
      setLoadError(err?.message || 'Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  const refreshTrashInBackground = useCallback(async () => {
    if (trashRefreshPromise.current) return trashRefreshPromise.current;

    const refresh = (async () => {
      try {
        const clients = await ClientService.getClients();
        const deleted = await InspectionService.refreshDeletedInspectionsFromRemote();
        setDeletedInspections(attachClientData(deleted, clients));
      } catch (err) {
        console.warn('[Inspections] Background trash refresh failed:', err);
      } finally {
        trashRefreshPromise.current = null;
      }
    })();

    trashRefreshPromise.current = refresh;
    return refresh;
  }, []);

  useEffect(() => { void loadInspections(); }, [loadInspections]);

  useEffect(() => { void refreshTrashInBackground(); }, [refreshTrashInBackground]);

  useEffect(() => {
    return InspectionService.subscribeToInspectionChanges(loadInspections);
  }, [loadInspections]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Mover esta inspeção para a Lixeira?',
      description: 'Ela permanecerá disponível para restauração até uma exclusão definitiva manual.',
      confirmLabel: 'Mover para a Lixeira',
    });
    if (!ok) return;
    // Optimistic update: remove from UI immediately
    setInspections(prev => prev.filter(i => i.id !== id));

    InspectionService.deleteInspection(id).then(() => {
      setShowTrash(true);
      void loadInspections();
    }).catch(err => {
      console.error('[Delete] Failed:', err);
      void loadInspections();
      toast.warning('A inspeção foi movida localmente para a Lixeira.', 'Ainda precisa sincronizar na nuvem.');
    });
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Restaurar esta inspeção excluída?',
      description: 'Restaura com respostas e fotos locais.',
      confirmLabel: 'Restaurar inspeção',
      tone: 'default',
    });
    if (!ok) return;
    try {
      await InspectionService.restoreInspection(id);
      await loadInspections();
      toast.success('Inspeção restaurada.', 'Abra a inspeção e confira os dados antes de sincronizar.');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao restaurar inspeção.');
    }
  };

  const handlePermanentDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Excluir definitivamente este relatório?',
      description: 'Remove o relatório, suas respostas e fotos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir definitivamente',
      confirmWord: 'EXCLUIR',
    });
    if (!ok) return;
    try {
      await InspectionService.permanentlyDeleteInspection(id);
      await loadInspections();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir definitivamente o relatório.');
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Inspeções"
        description="Histórico e andamento de avaliações."
        actions={
          <Button onClick={() => navigate('/new')} className="w-full sm:w-auto shadow-md">
            <Plus className="mr-2 h-5 w-5" />
            Nova Inspeção
          </Button>
        }
      />

      <div className="mb-6 flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setShowTrash(value => !value);
            if (!showTrash) void refreshTrashInBackground();
          }}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Lixeira
          {deletedInspections.length > 0 && (
            <Badge variant="warning" className="ml-1">{deletedInspections.length}</Badge>
          )}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, consultor..."
            className="h-10 w-full rounded-md border border-gray-300 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="all">Todos os Status</option>
          <option value="in_progress">Em Andamento</option>
          <option value="completed">Concluídas</option>
        </select>
      </div>

      <div className="space-y-4">
        {showTrash && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <Trash2 className="h-4 w-4" />
                  Lixeira de relatórios
                </h2>
                <p className="text-xs text-amber-700">Relatórios permanecem aqui até serem restaurados ou excluídos definitivamente por você.</p>
              </div>
              <Badge variant="outline" className="border-amber-300 bg-white text-amber-700">{deletedInspections.length}</Badge>
            </div>
            {deletedInspections.length === 0 ? (
              <p className="rounded-lg border border-amber-100 bg-white p-4 text-center text-sm text-gray-500">A Lixeira está vazia.</p>
            ) : <div className="space-y-2">
              {deletedInspections.map(insp => (
                <div key={insp.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{insp.clientName || 'Cliente'}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(insp.inspectionDate)} • excluída em {insp.deletedAt ? formatDateTime(insp.deletedAt) : '-'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => handleRestore(e, insp.id)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restaurar
                    </Button>
                    <Button size="sm" variant="danger" onClick={(e) => handlePermanentDelete(e, insp.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir agora
                    </Button>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )}

        {loadError ? (
          <div className="rounded-xl border border-gray-200 bg-white">
            <EmptyState
              role="alert"
              icon={<AlertTriangle className="h-8 w-8 text-red-500" />}
              title="Não deu para carregar as inspeções"
              description={loadError}
              action={
                <Button size="sm" onClick={() => void loadInspections()}>
                  Tentar de novo
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Carregando inspeções">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-10 w-32" />
                </div>
              </Card>
            ))}
          </div>
        ) : inspections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50">
            {search || filterStatus !== 'all' ? (
              <EmptyState
                icon={<FilterX className="h-8 w-8" />}
                title="Nada com este filtro"
                description="Nenhuma inspeção encontrada para a busca ou status atual."
                action={
                  <Button size="sm" variant="outline" onClick={() => { setSearch(''); setFilterStatus('all'); }}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" />}
                title="Nenhuma inspeção ainda"
                description="Quando você iniciar uma inspeção, ela aparece aqui."
                action={
                  <Button size="sm" onClick={() => navigate('/new')}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Inspeção
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          inspections.map(insp => (
            <Card 
              key={insp.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${insp.status === 'in_progress' ? 'border-primary-200 bg-primary-50/10' : ''}`}
              onClick={() => navigate(insp.status === 'in_progress' ? '/execute' : '/summary', { state: { inspectionId: insp.id }})}
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-bold text-gray-900">{insp.clientName}</h3>
                      {insp.status === 'in_progress' ? (
                        <Badge variant="warning" className="animate-pulse"><Activity className="mr-1 h-3 w-3" /> Em Andamento</Badge>
                      ) : (
                        <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Concluída</Badge>
                      )}
                    </div>
                    
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-gray-400" /> 
                        Início: {formatDateTime(insp.createdAt)}
                      </div>
                      {insp.completedAt && (
                        <div className="flex items-center">
                          <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> 
                          Fim: {formatDateTime(insp.completedAt)}
                        </div>
                      )}
                      {insp.clientCategory && (
                        <div className="col-span-1 sm:col-span-2 text-xs font-semibold text-gray-500 tracking-wider font-mono">
                          CATEGORIA: {insp.clientCategory.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      className="bg-white"
                      onClick={(e) => {
                         e.stopPropagation();
                         navigate(insp.status === 'in_progress' ? '/execute' : '/summary', { state: { inspectionId: insp.id }});
                      }}
                    >
                      {insp.status === 'in_progress' ? 'Continuar' : 'Ver Relatório'}
                    </Button>
                    
                    {insp.status === 'completed' && (
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-10 w-10 text-primary-600 border-primary-100 hover:bg-primary-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/execute', { state: { inspectionId: insp.id }});
                        }}
                        title="Editar Inspeção"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}

                    <Button 
                      variant="ghost" 
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 px-3"
                      onClick={(e) => handleDelete(e, insp.id)}
                      title="Excluir Inspeção"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
      {confirmDialog}
    </PageShell>
  );
}
