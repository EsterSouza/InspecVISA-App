import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Lock, AlertTriangle, FilterX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageShell } from '../../components/ui/PageShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { TemplateService } from '../../services/templateService';
import { getTemplates } from '../../data/templates';

function formatDateBR(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** FE-17 — a lista de cards virou tabela densa. "Em uso" é o aviso que antecede o clique de
 * editar: não há campo de rascunho/arquivado no modelo de dados (arquivado é só um prefixo
 * `[ARQUIVADO]` no nome, já filtrado abaixo), então não existe segmentado aqui. */
export function AdminTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  // `TemplateService.listTemplates()` traz só metadados (sem seções/itens) — o merge final da
  // tela usa essa lista para poder distinguir remoto de estático, então "Itens"/"Críticos" têm
  // que vir de outro lugar: o snapshot do Dexie, que tem o roteiro completo.
  const [sectionsById, setSectionsById] = useState<Record<string, any[]>>({});
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    TemplateService.getUsageCounts()
      .then(setUsageCounts)
      .catch((err) => console.warn('[AdminTemplates] Falha ao carregar contagem de uso:', err));
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      // Load from Dexie first for instant display
      const { db } = await import('../../db/database');
      const localTemplates = await db.templates.toArray();
      const staticTemplates = getTemplates().map(t => ({
        ...t,
        isStatic: true,
        updated_at: new Date().toISOString(),
      }));
      setTemplates(localTemplates.length > 0 ? localTemplates : staticTemplates);
      setSectionsById((prev) => ({ ...prev, ...Object.fromEntries(localTemplates.map((t: any) => [t.id, t.sections])) }));
      setIsLoading(false);

      // Fetch remote templates (editable, Supabase)
      let remoteData: any[] = [];
      try {
        remoteData = await TemplateService.listTemplates();
      } catch (remoteErr) {
        console.warn('[AdminTemplates] Could not fetch remote templates:', remoteErr);
      }

      // Build set of names that remote already covers
      const remoteNames = new Set(remoteData.map((t: any) => t.name));

      // Static templates only shown if their name is NOT in remote
      const staticData = getTemplates()
        .filter(t => !remoteNames.has(t.name))
        .map(t => ({
          ...t,
          isStatic: true,
          updated_at: new Date().toISOString(),
        }));

      // Merge: remote (editable) first, then unique statics (read-only)
      const merged = [...remoteData, ...staticData];
      setTemplates(merged);

      // Update Dexie in background
      if (remoteData.length > 0) {
        await TemplateService.syncAllTemplatesToDexie();
        // initializeDatabase will handle the merge with statics inside
        const synced = await db.templates.toArray();
        setSectionsById((prev) => ({ ...prev, ...Object.fromEntries(synced.map((t: any) => [t.id, t.sections])) }));
      }
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setLoadError(err?.message || 'Erro ao carregar roteiros.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeTemplates = templates.filter(t => !t.name.includes('[ARQUIVADO]'));

  const filtered = activeTemplates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageShell>
      <div className="space-y-6">
      <PageHeader
        title="Roteiros de Inspeção"
        description="Gerencie e importe novos modelos (ROIs) para as consultoras."
        actions={
          <div className="flex space-x-3 w-full sm:w-auto">
            <Button onClick={() => navigate('/templates/import')} variant="outline">
              Importar ROI
            </Button>
            <Button onClick={() => navigate('/templates/new')}>
              <Plus className="h-4 w-4 mr-2" /> Novo Roteiro
            </Button>
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Pesquisar roteiros por nome ou categoria..."
          className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EmptyState
            role="alert"
            icon={<AlertTriangle className="h-8 w-8 text-red-500" />}
            title="Não deu para carregar os roteiros"
            description={loadError}
            action={
              <Button size="sm" onClick={() => loadTemplates()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : isLoading ? (
        <TableContainer>
          <Table aria-busy="true" aria-label="Carregando roteiros">
            <TableHeader>
              <TableRow>
                <TableHead>Roteiro</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead align="right">Itens</TableHead>
                <TableHead align="right">Críticos</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell align="right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                  <TableCell align="right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roteiro</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead align="right">Itens</TableHead>
                <TableHead align="right">Críticos</TableHead>
                <TableHead align="right">Em uso</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-auto py-0">
                    {searchTerm ? (
                      <EmptyState
                        icon={<FilterX className="h-8 w-8" />}
                        title="Nada com este filtro"
                        description="Nenhum resultado para essa busca."
                        action={
                          <Button size="sm" variant="outline" onClick={() => setSearchTerm('')}>Limpar busca</Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={<FileText className="h-8 w-8" />}
                        title="Nenhum roteiro personalizado ainda"
                        description="Comece importando um novo arquivo ou criando um do zero."
                        action={
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => navigate('/templates/import')}>Importar Agora</Button>
                            <Button size="sm" onClick={() => navigate('/templates/new')}>Novo Roteiro</Button>
                          </div>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((template) => {
                  const sections = template.sections || sectionsById[template.id] || [];
                  // Aposentado (decisão 21, FE-17b) não entra em inspeção nova — "Itens"/"Críticos"
                  // aqui reflete o que a próxima inspeção realmente vai perguntar.
                  const items = sections.flatMap((s: any) => s.items || []).filter((i: any) => !i.retiredAt);
                  const criticalCount = items.filter((i: any) => i.isCritical).length;
                  const inUse = usageCounts[template.id] || 0;
                  return (
                    <TableRow
                      key={template.id}
                      onClick={() => navigate(`/templates/${template.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/templates/${template.id}`);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell primary>{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="uppercase text-[10px]">{template.category}</Badge>
                      </TableCell>
                      <TableCell align="right">{items.length}</TableCell>
                      <TableCell align="right">{criticalCount}</TableCell>
                      <TableCell align="right">
                        {inUse > 0 ? (
                          <span className="font-semibold text-amber-strong">{inUse}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateBR(template.updated_at)}</TableCell>
                      <TableCell>
                        {template.isStatic ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                            <Lock className="h-3 w-3" /> Padrão
                          </span>
                        ) : (
                          <Badge variant="success">Personalizado</Badge>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {template.isStatic ? (
                          <span className="text-xs italic text-gray-400">somente leitura</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); navigate(`/templates/${template.id}/edit`); }}
                          >
                            Editar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      </div>
    </PageShell>
  );
}
