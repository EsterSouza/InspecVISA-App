import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Activity, CheckCircle, Trash2, Edit, RotateCcw, AlertTriangle, ClipboardList, FilterX } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import type { Inspection, Client } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { PAGE_SIZE, usePagedList } from '../components/schedules/appointmentRequestsShared';
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

  // A ordem é a do `loadInspections` (em andamento primeiro, depois data decrescente) — a tabela
  // pagina, não reordena: quem está em campo precisa ver o que está aberto no topo.
  const { page, totalPages, items: pagedInspections, setPage } = usePagedList(inspections);

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
        <Input
          type="search"
          icon={<Search />}
          placeholder="Buscar por cliente, consultor..."
          aria-label="Buscar inspeção"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="col-span-1 sm:col-span-2"
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          aria-label="Filtrar por status"
        >
          <option value="all">Todos os Status</option>
          <option value="in_progress">Em Andamento</option>
          <option value="completed">Concluídas</option>
        </Select>
      </div>

      <div className="space-y-4">
        {showTrash && (
          <div className="rounded-xl border border-amber-soft-border bg-amber-soft p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-amber-soft-ink">
                  <Trash2 className="h-4 w-4" />
                  Lixeira de relatórios
                </h2>
                <p className="text-xs text-amber-soft-ink">Relatórios permanecem aqui até serem restaurados ou excluídos definitivamente por você.</p>
              </div>
              <Badge variant="outline" className="border-amber-soft-border bg-surface text-amber-soft-ink">{deletedInspections.length}</Badge>
            </div>
            {deletedInspections.length === 0 ? (
              <p className="rounded-lg border border-amber-soft-border bg-surface p-4 text-center text-sm text-navy-3">A Lixeira está vazia.</p>
            ) : <div className="space-y-2">
              {deletedInspections.map(insp => (
                <div key={insp.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-soft-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{insp.clientName || 'Cliente'}</p>
                    <p className="text-xs text-navy-3">{formatDateTime(insp.inspectionDate)} • excluída em {insp.deletedAt ? formatDateTime(insp.deletedAt) : '-'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => handleRestore(e, insp.id)} className="border-amber-soft-border text-amber-soft-ink hover:bg-amber-soft">
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
          <div className="rounded-lg border border-default bg-surface">
            <EmptyState
              role="alert"
              icon={<AlertTriangle className="h-8 w-8 text-danger" />}
              title="Não deu para carregar as inspeções"
              description={loadError}
              action={
                <Button size="sm" onClick={() => void loadInspections()}>
                  Tentar de novo
                </Button>
              }
            />
          </div>
        ) : (
          <TableContainer>
            <Table aria-busy={loading || undefined} aria-label="Inspeções">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="hidden md:table-cell">Conclusão</TableHead>
                  <TableHead align="right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell align="right"><Skeleton className="ml-auto h-4 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : pagedInspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-auto py-0">
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
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedInspections.map((insp) => {
                    const target = insp.status === 'in_progress' ? '/execute' : '/summary';
                    const open = () => navigate(target, { state: { inspectionId: insp.id } });
                    return (
                      <TableRow
                        key={insp.id}
                        onClick={open}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            open();
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <TableCell primary className="max-w-[320px]">
                          <p className="truncate">{insp.clientName}</p>
                          {insp.clientCategory && (
                            <p className="truncate text-xs font-normal uppercase tracking-wide text-navy-3">
                              {insp.clientCategory}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {insp.status === 'in_progress' ? (
                            <Badge variant="warning"><Activity className="mr-1 h-3 w-3" /> Em Andamento</Badge>
                          ) : (
                            <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Concluída</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(insp.createdAt)}</TableCell>
                        <TableCell className="hidden whitespace-nowrap md:table-cell">
                          {insp.completedAt ? formatDateTime(insp.completedAt) : <span className="text-navy-3">—</span>}
                        </TableCell>
                        <TableCell align="right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); open(); }}
                            >
                              {insp.status === 'in_progress' ? 'Continuar' : 'Ver Relatório'}
                            </Button>
                            {insp.status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Editar a inspeção de ${insp.clientName}`}
                                title="Editar inspeção"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/execute', { state: { inspectionId: insp.id } });
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Excluir a inspeção de ${insp.clientName}`}
                              title="Excluir inspeção"
                              className="text-danger hover:bg-danger-soft hover:text-danger"
                              onClick={(e) => handleDelete(e, insp.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              pageCount={totalPages}
              onPageChange={setPage}
              totalItems={inspections.length}
              pageSize={PAGE_SIZE}
            />
          </TableContainer>
        )}
      </div>

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
      {confirmDialog}
    </PageShell>
  );
}
