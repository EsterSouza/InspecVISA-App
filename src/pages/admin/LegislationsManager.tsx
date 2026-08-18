import React, { useEffect, useMemo, useState } from 'react';
import { LegislationService, type Legislation, type LegislationSegment, type LegislationStatus } from '../../services/legislationService';
import { UF_OPTIONS, toUF } from '../../utils/state';
import { canonicalLegislationKey, extractBaseLegislation } from '../../utils/legislationRefs';
import { getTemplates } from '../../data/templates';
import { supplementRegistry } from '../../data/supplementRegistry';
import { Plus, Trash2, ExternalLink, Search, BookOpen, Loader2, Edit2, Link as LinkIcon, AlertTriangle, FilterX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Drawer } from '../../components/ui/Drawer';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageShell } from '../../components/ui/PageShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { usePagedList } from '../../components/schedules/appointmentRequestsShared';
import { useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../store/useToastStore';
import { rawErrorMessage } from '../../utils/errors';

const SEGMENT_OPTIONS: { value: LegislationSegment; label: string }[] = [
  { value: 'ilpi', label: 'ILPI' },
  { value: 'saude', label: 'Saúde' },
  { value: 'estetica', label: 'Estética' },
  { value: 'alimentos', label: 'Alimentos' },
];

interface LegForm {
  name: string;
  summary: string;
  url: string;
  authority: string;
  uf: string;
  segments: LegislationSegment[];
  status: LegislationStatus;
  replacedBy: string;
  researchNotes: string;
}

const EMPTY_FORM: LegForm = {
  name: '', summary: '', url: '', authority: '', uf: '', segments: [],
  status: 'vigente', replacedBy: '', researchNotes: '',
};

const STATUS_OPTIONS: { value: LegislationStatus; label: string }[] = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'vigente_com_alteracoes', label: 'Vigente com alterações' },
  { value: 'nao_verificado', label: 'Vigência não verificada' },
  { value: 'revogada', label: 'Revogada' },
];

function toPayload(form: LegForm): Omit<Legislation, 'id' | 'created_at'> {
  return {
    name: form.name,
    summary: form.summary,
    url: form.url,
    authority: form.authority.trim() || null,
    uf: toUF(form.uf) || null,
    segments: form.segments.length > 0 ? form.segments : null,
    status: form.status,
    replaced_by: form.status === 'revogada' ? (form.replacedBy.trim() || null) : null,
    research_notes: form.researchNotes.trim() || null,
  };
}

function isDefaultEntry(id: string): boolean {
  return id.startsWith('default-');
}

// REF-07 (scripts/ref07-lacunas.ts) faz a mesma varredura para achar lacunas em CI; aqui é a
// versão ao vivo, cruzada contra a biblioteca carregada (não só o LEGISLATION_LIBRARY estático),
// porque a curadoria pode ter cadastrado verbete novo que o arquivo estático ainda não tem.
interface Citation { label: string; count: number; templates: Set<string>; }

function buildCitationMap(): Map<string, Citation> {
  const sources = [
    ...getTemplates().map(t => ({
      name: t.name,
      items: t.sections.flatMap(s => s.items),
    })),
    // Suplementos regionais anexam item em seção existente (sectionAdditions) ou trazem
    // seção nova inteira (newSections) — não têm `.sections` como um roteiro comum.
    ...supplementRegistry.map(entry => ({
      name: `${entry.supplement.name}${entry.nameSuffix}`,
      items: [
        ...entry.supplement.sectionAdditions.flatMap(sa => sa.items),
        ...(entry.supplement.newSections ?? []).flatMap(s => s.items),
      ],
    })),
  ];
  const map = new Map<string, Citation>();
  for (const source of sources) {
    for (const item of source.items) {
      if (!item.legislation) continue;
      for (const base of extractBaseLegislation(item.legislation)) {
        const key = canonicalLegislationKey(base);
        const entry = map.get(key) || { label: base, count: 0, templates: new Set<string>() };
        entry.count++;
        entry.templates.add(source.name);
        map.set(key, entry);
      }
    }
  }
  return map;
}

/** Compara município ignorando acento e caixa: "Marabá" e "maraba" são a mesma cidade. */
function normalizaMunicipio(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

type Segment = 'vigentes' | 'revogadas' | 'pendentes' | 'sem_verbete';

const SEGMENT_LABELS: Record<Segment, string> = {
  vigentes: 'Vigentes',
  revogadas: 'Revogadas',
  pendentes: 'A verificar',
  sem_verbete: 'Sem verbete',
};

interface GapRow {
  key: string;
  name: string;
  count: number;
  templateNames: string[];
}

export function LegislationsManager() {
  const [legislations, setLegislations] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [esfera, setEsfera] = useState('');
  const [orgao, setOrgao] = useState('');
  const [aplicaA, setAplicaA] = useState<LegislationSegment | ''>('');
  const [municipio, setMunicipio] = useState('');
  const [segment, setSegment] = useState<Segment>('vigentes');
  const [isSeeding, setIsSeeding] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LegForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    loadLegislations();
  }, []);

  async function loadLegislations() {
    try {
      setLoading(true);
      const data = await LegislationService.listLegislations();
      setLegislations(data);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load legislations:', err);
      setLoadError(rawErrorMessage(err) || 'Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const citationMap = useMemo(() => buildCitationMap(), []);

  const validEntries = useMemo(
    () => legislations.filter(l => l.name && l.summary),
    [legislations]
  );

  const cataloguedKeys = useMemo(
    () => new Set(validEntries.map(l => canonicalLegislationKey(l.name))),
    [validEntries]
  );

  const linkedCount = (leg: Legislation) => citationMap.get(canonicalLegislationKey(leg.name))?.count || 0;

  const gaps: GapRow[] = useMemo(() => {
    const rows: GapRow[] = [];
    for (const [key, info] of citationMap.entries()) {
      if (cataloguedKeys.has(key)) continue;
      rows.push({ key, name: info.label, count: info.count, templateNames: [...info.templates] });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [citationMap, cataloguedKeys]);

  const ufOptions = useMemo(
    () => Array.from(new Set(validEntries.map(l => l.uf).filter((v): v is string => !!v))).sort(),
    [validEntries]
  );
  const authorityOptions = useMemo(
    () => Array.from(new Set(validEntries.map(l => l.authority).filter((v): v is string => !!v))).sort(),
    [validEntries]
  );

  const counts = useMemo(() => ({
    vigentes: validEntries.filter(l => l.status !== 'revogada').length,
    revogadas: validEntries.filter(l => l.status === 'revogada').length,
    pendentes: validEntries.filter(l => !l.status || l.status === 'nao_verificado').length,
    sem_verbete: gaps.length,
  }), [validEntries, gaps]);

  const query = search.trim().toLowerCase();
  const municipioQuery = normalizaMunicipio(municipio);

  const filteredEntries = useMemo(() => {
    return validEntries.filter(l => {
      if (segment === 'vigentes' && l.status === 'revogada') return false;
      if (segment === 'revogadas' && l.status !== 'revogada') return false;
      if (segment === 'pendentes' && l.status && l.status !== 'nao_verificado') return false;
      if (esfera === 'federal' && l.uf) return false;
      if (esfera && esfera !== 'federal' && l.uf !== esfera) return false;
      if (orgao && l.authority !== orgao) return false;
      if (aplicaA && !(l.segments || []).includes(aplicaA)) return false;
      // Município filtra o alcance municipal: a norma sem município alcança a UF
      // inteira e continua valendo; a de outra cidade sai.
      if (municipioQuery && l.municipio && normalizaMunicipio(l.municipio) !== municipioQuery) return false;
      if (!query) return true;
      return (
        l.name.toLowerCase().includes(query) ||
        (l.summary || '').toLowerCase().includes(query) ||
        (l.abnt || '').toLowerCase().includes(query) ||
        (l.authority || '').toLowerCase().includes(query)
      );
    });
  }, [validEntries, segment, esfera, orgao, aplicaA, municipioQuery, query]);

  const filteredGaps = useMemo(() => {
    if (segment !== 'sem_verbete') return [];
    if (!query) return gaps;
    return gaps.filter(g => g.name.toLowerCase().includes(query));
  }, [gaps, segment, query]);

  const { page, totalPages, items: pagedEntries, setPage } = usePagedList(filteredEntries);
  const { page: gapPage, totalPages: gapTotalPages, items: pagedGaps, setPage: setGapPage } = usePagedList(filteredGaps);

  const detailEntry = detailId ? legislations.find(l => l.id === detailId) || null : null;

  function openCreate(prefillName?: string) {
    setForm({ ...EMPTY_FORM, name: prefillName || '' });
    setFormMode('create');
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(leg: Legislation) {
    setForm({
      name: leg.name,
      summary: leg.summary || '',
      url: leg.url || '',
      authority: leg.authority || '',
      uf: leg.uf || '',
      segments: leg.segments || [],
      status: leg.status || 'vigente',
      replacedBy: leg.replaced_by || '',
      researchNotes: leg.research_notes || '',
    });
    setFormMode('edit');
    setEditingId(leg.id);
    setDetailId(null);
    setFormOpen(true);
  }

  function toggleSegment(segmentValue: LegislationSegment) {
    setForm(prev => ({
      ...prev,
      segments: prev.segments.includes(segmentValue)
        ? prev.segments.filter(s => s !== segmentValue)
        : [...prev.segments, segmentValue],
    }));
  }

  async function handleSeed() {
    const ok = await confirm({
      title: 'Importar legislações sugeridas?',
      description: 'Importa automaticamente as principais legislações sanitárias brasileiras para sua biblioteca.',
      confirmLabel: 'Importar legislações',
      tone: 'default',
    });
    if (!ok) return;
    try {
      setIsSeeding(true);
      await LegislationService.seedStandardLegislations();
      await loadLegislations();
    } catch {
      toast.error('Erro ao importar legislações sugeridas');
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.summary) {
      toast.error('Nome e Resumo são obrigatórios para registrar uma norma técnica.');
      return;
    }
    setSaving(true);
    try {
      if (formMode === 'edit' && editingId) {
        await LegislationService.updateLegislation(editingId, toPayload(form));
      } else {
        await LegislationService.saveLegislation(toPayload(form));
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      loadLegislations();
    } catch {
      toast.error(formMode === 'edit' ? 'Erro ao salvar alterações' : 'Erro ao salvar legislação');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(leg: Legislation) {
    const ok = await confirm({
      title: `Excluir "${leg.name}"?`,
      confirmLabel: 'Excluir legislação',
    });
    if (!ok) return;
    try {
      await LegislationService.deleteLegislation(leg.id);
      setDetailId(null);
      loadLegislations();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  const rowsAreGaps = segment === 'sem_verbete';

  return (
    <PageShell>
      <PageHeader
        title="Biblioteca de Legislação"
        description="A curadoria daqui é o que o relatório consegue citar. Sem verbete, a norma não é citada em lugar nenhum."
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleSeed}
              disabled={isSeeding}
            >
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
              Importar Base Padrão
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" /> Novo verbete
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          icon={<Search />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número, órgão ou assunto"
          aria-label="Buscar legislação"
          wrapperClassName="flex-1 sm:max-w-xs"
        />
        <Select
          value={esfera}
          onChange={(e) => setEsfera(e.target.value)}
          aria-label="Esfera"
          disabled={rowsAreGaps}
          className="w-auto"
        >
          <option value="">Todas as esferas</option>
          <option value="federal">Federal</option>
          {ufOptions.map((uf) => (
            <option key={uf} value={uf}>Estadual — {uf}</option>
          ))}
        </Select>
        <Select
          value={orgao}
          onChange={(e) => setOrgao(e.target.value)}
          aria-label="Órgão"
          disabled={rowsAreGaps}
          className="w-auto"
        >
          <option value="">Todos os órgãos</option>
          {authorityOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
        <Select
          value={aplicaA}
          onChange={(e) => setAplicaA(e.target.value as LegislationSegment | '')}
          aria-label="Segmento do estabelecimento"
          disabled={rowsAreGaps}
          className="w-auto"
        >
          <option value="">Todos os segmentos</option>
          {SEGMENT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Input
          type="search"
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
          placeholder="Município"
          aria-label="Município"
          disabled={rowsAreGaps}
          wrapperClassName="sm:max-w-[10rem]"
        />
        <div className="inline-flex gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5">
          {(Object.keys(SEGMENT_LABELS) as Segment[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={segment === key}
              onClick={() => setSegment(key)}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                segment === key ? 'bg-surface text-primary-700 shadow-sm' : 'text-navy-3 hover:text-navy'
              }`}
            >
              {SEGMENT_LABELS[key]} <span className="tabular-nums">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {segment === 'pendentes' && (
        <p className="mb-4 rounded-md border border-amber-soft-border bg-amber-soft p-3 text-sm text-amber-soft-ink">
          São {counts.pendentes} normas que entraram na base sem checagem de vigência — a maioria veio do PastaVISA na unificação. Continuam sendo sugeridas, porque são normas reais, mas ninguém apurou se seguem valendo. Verificar e datar tira a norma desta fila.
        </p>
      )}

      {segment === 'sem_verbete' && (
        <p className="mb-4 rounded-md border border-amber-soft-border bg-amber-soft p-3 text-sm text-amber-soft-ink">
          São {gaps.length} normas citadas por item de roteiro que ainda não têm verbete na biblioteca — nenhuma delas é citada no relatório do cliente. Esta é a fila de trabalho da curadoria.
        </p>
      )}

      {loadError ? (
        <div className="rounded-md border border-default bg-surface">
          <EmptyState
            role="alert"
            icon={<AlertTriangle className="h-8 w-8 text-danger" />}
            title="Não deu para carregar a biblioteca"
            description={loadError}
            action={
              <Button size="sm" onClick={() => void loadLegislations()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <TableContainer>
          <Table aria-busy="true" aria-label="Carregando legislações">
            <TableHeader>
              <TableRow>
                <TableHead>Norma</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Esfera</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead align="right">Itens ligados</TableHead>
                <TableHead>Vigência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                  <TableCell align="right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
                <TableHead>Norma</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Esfera</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead align="right">Itens ligados</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsAreGaps ? (
                pagedGaps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-auto py-0">
                      {query ? (
                        <EmptyState
                          icon={<FilterX className="h-8 w-8" />}
                          title="Nada com este filtro"
                          description="Nenhum resultado para essa busca."
                          action={<Button size="sm" variant="outline" onClick={() => setSearch('')}>Limpar busca</Button>}
                        />
                      ) : (
                        <EmptyState
                          icon={<BookOpen className="h-8 w-8" />}
                          title="Nenhuma lacuna encontrada"
                          description="Toda norma citada pelos roteiros já tem verbete na biblioteca."
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedGaps.map((gap) => (
                    <TableRow key={gap.key}>
                      <TableCell primary>{gap.name}</TableCell>
                      <TableCell><span className="text-navy-3">—</span></TableCell>
                      <TableCell><span className="text-navy-3">—</span></TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="truncate text-xs text-navy-3">{gap.templateNames.join(' · ')}</p>
                      </TableCell>
                      <TableCell align="right">{gap.count}</TableCell>
                      <TableCell>
                        <Badge variant="warning">sem verbete</Badge>
                      </TableCell>
                      <TableCell align="right">
                        <Button variant="outline" size="sm" onClick={() => openCreate(gap.name)}>
                          Escrever verbete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : pagedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-auto py-0">
                    {query || esfera || orgao ? (
                      <EmptyState
                        icon={<FilterX className="h-8 w-8" />}
                        title="Nada com este filtro"
                        description="Nenhum resultado para os filtros atuais. A norma pode existir, só está escondida."
                        action={
                          <Button size="sm" variant="outline" onClick={() => { setSearch(''); setEsfera(''); setOrgao(''); setAplicaA(''); setMunicipio(''); }}>
                            Limpar filtros
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={<BookOpen className="h-8 w-8" />}
                        title={`Nenhuma legislação ${SEGMENT_LABELS[segment].toLowerCase()}`}
                        description='Use "Importar Base Padrão" para começar.'
                        action={<Button size="sm" onClick={handleSeed} disabled={isSeeding}>Importar Base Padrão</Button>}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                pagedEntries.map((leg) => (
                  <TableRow
                    key={leg.id}
                    onClick={() => setDetailId(leg.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailId(leg.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell primary className="max-w-[280px]">
                      <p className="truncate">{leg.name}</p>
                      {isDefaultEntry(leg.id) && (
                        <p className="text-[10px] font-bold text-amber-strong">PADRÃO (não persistido)</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {leg.authority ? leg.authority : <span className="text-xs font-semibold text-amber-strong">sem autoria</span>}
                    </TableCell>
                    <TableCell>{leg.uf ? `Estadual — ${leg.uf}` : 'Federal'}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate text-navy-2">{leg.summary || '—'}</p>
                    </TableCell>
                    <TableCell align="right">{linkedCount(leg)}</TableCell>
                    <TableCell>
                      {leg.status === 'revogada' ? (
                        <Badge variant="danger">revogado{leg.replaced_by ? ` → ${leg.replaced_by}` : ''}</Badge>
                      ) : (
                        <Badge variant="success">vigente</Badge>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <span className="inline-flex items-center gap-1">
                        {leg.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); window.open(leg.url, '_blank', 'noopener,noreferrer'); }}
                            aria-label={`Abrir ${leg.name}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {!isDefaultEntry(leg.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openEdit(leg); }}
                            aria-label={`Editar ${leg.name}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {rowsAreGaps ? (
            <Pagination page={gapPage} pageCount={gapTotalPages} onPageChange={setGapPage} totalItems={filteredGaps.length} pageSize={10} />
          ) : (
            <Pagination page={page} pageCount={totalPages} onPageChange={setPage} totalItems={filteredEntries.length} pageSize={10} />
          )}
        </TableContainer>
      )}

      {/* ─── Detalhe ─── */}
      <Drawer
        isOpen={!!detailEntry}
        onClose={() => setDetailId(null)}
        title={detailEntry?.name}
        footer={
          detailEntry && !isDefaultEntry(detailEntry.id) && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleDelete(detailEntry)} className="text-danger hover:bg-danger-soft">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
              <Button size="sm" onClick={() => openEdit(detailEntry)}>
                <Edit2 className="mr-2 h-4 w-4" /> Editar
              </Button>
            </div>
          )
        }
      >
        {detailEntry && (
          <div className="space-y-4 text-sm">
            {isDefaultEntry(detailEntry.id) && (
              <p className="rounded-md bg-amber-soft p-2 text-xs font-bold text-amber-soft-ink">PADRÃO (não persistido)</p>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Resumo</p>
              <p className="mt-1 text-navy">{detailEntry.summary || 'Sem resumo disponível.'}</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Autoria</p>
                <p className="mt-1 text-navy">{detailEntry.authority || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Esfera</p>
                <p className="mt-1 text-navy">{detailEntry.uf ? `Estadual — ${detailEntry.uf}` : 'Federal'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Vigência</p>
                <p className="mt-1 text-navy">
                  {detailEntry.status === 'revogada' ? 'Revogada' : detailEntry.status === 'vigente_com_alteracoes' ? 'Vigente com alterações' : !detailEntry.status || detailEntry.status === 'nao_verificado' ? 'Vigência não verificada' : 'Vigente'}
                </p>
              </div>
            </div>
            {detailEntry.status === 'revogada' && (
              <p className="rounded-md border border-danger-soft-border bg-danger-soft p-2.5 text-xs text-danger-soft-ink">
                {detailEntry.replaced_by
                  ? <>Substituída por <span className="font-semibold">{detailEntry.replaced_by}</span>.</>
                  : 'Revogada sem substituto — reapontar mecanicamente produz citação errada em relatório assinado.'}
              </p>
            )}
            {detailEntry.segments && detailEntry.segments.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Segmentos</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {detailEntry.segments.map(seg => (
                    <Badge key={seg} variant="neutral">{SEGMENT_OPTIONS.find(o => o.value === seg)?.label || seg}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Itens ligados</p>
              <p className="mt-1 text-navy">{linkedCount(detailEntry)} item(ns) de roteiro citam esta norma.</p>
            </div>
            {detailEntry.url && (
              <a
                href={detailEntry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900"
              >
                <LinkIcon className="h-3.5 w-3.5" /> Abrir documento oficial
              </a>
            )}
            {detailEntry.research_notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Notas de pesquisa</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-default bg-surface-sunken p-3 text-xs text-navy-2">
                  {detailEntry.research_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ─── Formulário (novo / editar) ─── */}
      <Drawer
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === 'edit' ? 'Editar legislação' : 'Nova legislação'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving || !form.name || !form.summary}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Nome (Ex: RDC nº 63/2011)" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Resumo ou ementa" required>
            <Textarea
              className="h-24 resize-none"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </Field>
          <Field label="URL do documento oficial">
            <Input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          <Field
            label="Autoria (entra na citação do relatório)"
            hint="Sem autoria a norma é citada só pelo nome. O relatório nunca deduz o órgão."
          >
            <Input
              value={form.authority}
              onChange={(e) => setForm({ ...form, authority: e.target.value })}
              placeholder="Ex: BRASIL. Ministério da Saúde"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="UF (estadual/municipal)">
              <Select value={toUF(form.uf)} onChange={(e) => setForm({ ...form, uf: e.target.value })}>
                <option value="">Federal / nacional</option>
                {UF_OPTIONS.map(({ uf, name }) => (
                  <option key={uf} value={uf}>{uf} — {name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Situação">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LegislationStatus })}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          </div>
          {form.status === 'revogada' && (
            <Field label="Substituída por">
              <Input
                value={form.replacedBy}
                onChange={(e) => setForm({ ...form, replacedBy: e.target.value })}
                placeholder="Ex: RDC Anvisa nº 222/2018 — deixe em branco se não houver substituto"
              />
            </Field>
          )}
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-navy">Segmentos aplicáveis (vazio = todos)</legend>
            <div className="flex flex-wrap gap-2">
              {SEGMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleSegment(opt.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.segments.includes(opt.value)
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-default bg-surface-sunken text-navy-3'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Field
            label="Notas de pesquisa (artigos consultados, trechos, decisões)"
            hint="Cache de pesquisa: guarde aqui o que já foi lido dessa norma para não pesquisar de novo depois."
          >
            <Textarea
              className="h-28"
              value={form.researchNotes}
              onChange={(e) => setForm({ ...form, researchNotes: e.target.value })}
              placeholder="Ex.: Art. 25 trata de circulações internas — largura mínima 1,00m..."
            />
          </Field>
        </div>
      </Drawer>

      {confirmDialog}
    </PageShell>
  );
}
