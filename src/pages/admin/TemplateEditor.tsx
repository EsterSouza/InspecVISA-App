import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown,
  AlertTriangle, Copy, Loader2, Archive, RotateCcw, Info, ClipboardList,
  CheckCircle2, Upload, GitBranch,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Label } from '../../components/ui/Label';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageShell } from '../../components/ui/PageShell';
import { useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TemplateService } from '../../services/templateService';
import { cn } from '../../lib/utils';
import type { ClientCategory } from '../../types';
import { rawErrorMessage } from '../../utils/errors';
import type { RawImportItem } from '../../services/templateService';
import { useApplicabilityDraft } from '../../components/templates/useApplicabilityDraft';
import { ApplicabilityFieldset } from '../../components/templates/ApplicabilityFieldset';
import { RoutingQuestionsPanel } from '../../components/templates/RoutingQuestionsPanel';
import { ApplicabilitySimulator } from '../../components/templates/ApplicabilitySimulator';
import { cloneSectionForDuplicate, describeIssueLocation, rulesOrphanedBy } from '../../domain/applicability';
import type { ValidationIssue } from '../../domain/applicability';

interface EditingItem {
  id: string; // temp id (não-uuid) para item novo, nunca salvo
  description: string;
  legislation: string;
  legislationUrl: string;
  weight: number;
  isCritical: boolean;
  requirementType: 'legal' | 'good_practice';
  guidance: string;
  retiredAt: string | null;
  order: number;
  /** Undefined = item novo. Serve só para saber se a pergunta mudou desde o carregamento. */
  originalDescription?: string;
}

interface EditingSection {
  id: string;
  title: string;
  order: number;
  items: EditingItem[];
}

interface SelectedPath {
  sectionId: string;
  /** `null` = a seção inteira está selecionada. A seção também tem aplicabilidade (COND-06). */
  itemId: string | null;
}

// Mesma checagem de src/services/templateService.ts (_isUuid): item com id de verdade pode ter
// resposta gravada (responses.item_id sem FK) — por isso só ele ganha "Aposentar" em vez de
// "Excluir" (decisão 21, docs/HANDOFF-FRONTEND.md).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isPersistedId = (id: string) => UUID_RE.test(id);

function formatDateBR(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClientCategory>('estetica');
  const [version, setVersion] = useState('1');
  const [sections, setSections] = useState<EditingSection[]>([]);
  const [selected, setSelected] = useState<SelectedPath | null>(null);
  const [openResponseCounts, setOpenResponseCounts] = useState<Record<string, number>>({});
  const { confirm, confirmDialog } = useConfirmDialog();

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // COND-06 — as condições vivem numa revisão à parte do roteiro (`checklist_template_revisions`).
  // Roteiro novo ainda não tem id, e sem id não há o que versionar: o hook fica inerte até salvar.
  const condicoes = useApplicabilityDraft(id, sections);
  const [publishIssues, setPublishIssues] = useState<ValidationIssue[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishOk, setPublishOk] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // COND-07 — o simulador responde "o que apareceria numa inspeção nova?", e
  // inspeção nova nunca vê item aposentado (decisão 21, `getEffectiveTemplate`).
  // Simular com ele dentro faria o simulador mentir para mais.
  const arvoreParaSimular = useMemo(
    () => sections.map(section => ({ ...section, items: section.items.filter(item => !item.retiredAt) })),
    [sections]
  );

  useEffect(() => {
    if (isEditing && id) {
      loadTemplate(id);
    } else {
      setSections([{ id: generateId(), title: 'Nova Seção', order: 1, items: [] }]);
    }
  }, [id, isEditing]);

  const loadTemplate = async (templateId: string) => {
    try {
      setIsLoading(true);
      const tpl = await TemplateService.getFullTemplate(templateId);
      setName(tpl.name);
      setCategory(tpl.category);
      setVersion(tpl.version || '1');

      const loadedSections: EditingSection[] = tpl.sections.map((sec) => ({
        id: sec.id,
        title: sec.title,
        order: sec.order,
        items: (sec.items || []).map((it) => ({
          id: it.id,
          description: it.description,
          originalDescription: it.description,
          // Os `|| it.legislation_name` e companhia sairam com a tipagem: `getFullTemplate`
          // ja devolve `ChecklistTemplate`, sempre em camelCase — a grafia do banco nunca
          // chegava aqui. Era codigo morto que so o `any` deixava parecer necessario.
          legislation: it.legislation || '',
          legislationUrl: it.legislationUrl || '',
          weight: it.weight || 1,
          isCritical: it.isCritical || false,
          requirementType: it.requirementType || 'legal',
          guidance: it.guidance || '',
          retiredAt: it.retiredAt || null,
          order: it.order,
        })),
      }));
      setSections(loadedSections);

      const firstSectionWithItems = loadedSections.find(s => s.items.length > 0);
      if (firstSectionWithItems) {
        setSelected({ sectionId: firstSectionWithItems.id, itemId: firstSectionWithItems.items[0].id });
      }

      const persistedIds = loadedSections.flatMap(s => s.items).map(i => i.id).filter(isPersistedId);
      if (persistedIds.length > 0) {
        TemplateService.getOpenResponseCounts(persistedIds)
          .then(setOpenResponseCounts)
          .catch(err => console.warn('[TemplateEditor] Falha ao carregar respostas em andamento:', err));
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError(rawErrorMessage(err) || 'Erro ao carregar roteiro.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDescriptionChangesIfNeeded = async (): Promise<boolean> => {
    const changed = sections.flatMap(s => s.items).filter(it =>
      isPersistedId(it.id) &&
      it.originalDescription !== undefined &&
      it.originalDescription !== it.description &&
      (openResponseCounts[it.id] || 0) > 0
    );
    if (changed.length === 0) return true;
    return confirm({
      title: 'Pergunta alterada com respostas em andamento',
      description: 'Estas perguntas já têm resposta registrada em inspeção que ainda está em andamento — a resposta antiga vai passar a aparecer sob o texto novo. Se o sentido da pergunta mudou, cancele e aposente o item em vez de reescrevê-lo.',
      consequences: changed.map(it => {
        const original = it.originalDescription || '';
        const snippet = original.length > 70 ? `${original.slice(0, 70)}…` : original;
        const count = openResponseCounts[it.id] || 0;
        return `"${snippet}" — ${count} resposta${count === 1 ? '' : 's'} em andamento`;
      }),
      confirmLabel: 'Salvar mesmo assim',
      cancelLabel: 'Cancelar',
      tone: 'default',
    });
  };

  /**
   * Grava a árvore e, junto, o rascunho de condições. Os dois andam juntos de
   * propósito: publicar valida contra o que está **no banco**, e regra que mira
   * item ainda não salvo viraria referência órfã na hora de publicar.
   */
  const persistirRoteiroEditado = async () => {
    if (!id) return;
    const orderedSections = sections.map((sec, sIdx) => ({
      ...sec,
      order: sIdx + 1,
      items: sec.items.map((it, iIdx) => ({ ...it, order: iIdx + 1 })),
    }));
    await TemplateService.updateFullTemplate(id, { name, category, version }, orderedSections);
    await condicoes.salvar();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('O nome do roteiro é obrigatório.');
      return;
    }
    if (sections.length === 0) {
      setError('Adicione pelo menos uma seção ao roteiro.');
      return;
    }

    const proceed = await confirmDescriptionChangesIfNeeded();
    if (!proceed) return;

    try {
      setIsSaving(true);
      setError(null);

      const orderedSections = sections.map((sec, sIdx) => ({
        ...sec,
        order: sIdx + 1,
        items: sec.items.map((it, iIdx) => ({ ...it, order: iIdx + 1 })),
      }));

      if (isEditing && id) {
        await persistirRoteiroEditado();
      } else {
        const rawItems: RawImportItem[] = [];
        orderedSections.forEach(sec => {
          sec.items.forEach(it => {
            rawItems.push({
              section: sec.title,
              description: it.description,
              legislation: it.legislation,
              legislationUrl: it.legislationUrl,
              weight: it.weight,
              isCritical: it.isCritical,
              requirementType: it.requirementType,
              guidance: it.guidance.trim() || undefined,
            });
          });
        });
        await TemplateService.saveFullTemplate(name, category, rawItems);
      }

      await TemplateService.syncAllTemplatesToDexie();
      navigate('/templates');
    } catch (err) {
      console.error('Error saving template:', err);
      setError(rawErrorMessage(err) || 'Erro ao salvar o roteiro.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Publicar as condições. Rascunho inválido **pode ser salvo, nunca publicado**:
   * quem recusa é o serviço, e o que aparece aqui é o motivo, item a item.
   */
  const handlePublish = async () => {
    setPublishIssues([]);
    setPublishError(null);
    setPublishOk(false);

    const ok = await confirm({
      title: condicoes.temPublicada ? 'Publicar nova versão das condições?' : 'Publicar as condições?',
      description:
        'A partir daqui, toda inspeção nova deste roteiro nasce com estas regras congeladas. Inspeção em andamento continua com a versão de quando começou, e relatório concluído nunca muda.',
      confirmLabel: 'Publicar',
      cancelLabel: 'Cancelar',
      tone: 'default',
    });
    if (!ok) return;

    try {
      setIsPublishing(true);
      await persistirRoteiroEditado();
      const resultado = await condicoes.publicar();
      if (resultado.ok) {
        setPublishOk(true);
      } else {
        setPublishIssues(resultado.problemas);
        setPublishError(resultado.mensagem ?? null);
      }
    } catch (err) {
      setPublishError(rawErrorMessage(err) || 'Não foi possível publicar as condições.');
    } finally {
      setIsPublishing(false);
    }
  };

  // --- Section Actions ---
  const addSection = () => {
    setSections([...sections, { id: generateId(), title: 'Nova Seção', order: sections.length + 1, items: [] }]);
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, title } : s));
  };

  const sectionHasPersistedItem = (section: EditingSection) => section.items.some(it => isPersistedId(it.id));

  /**
   * As regras que caem junto ao remover uma seção ou item. O aceite do card é
   * "nenhuma operação do editor produz referência órfã **em silêncio**": aqui o
   * silêncio é quebrado antes, na confirmação, e a regra sai junto do alvo.
   */
  const regrasArrastadas = (removido: { sections?: string[]; items?: string[] }) =>
    rulesOrphanedBy({ rules: condicoes.rules }, removido);

  const descreverRegraArrastada = (regra: { target: { type: 'section' | 'item'; id: string } }) => {
    if (regra.target.type === 'section') {
      const secao = sections.find(s => s.id === regra.target.id);
      return `Condição da seção "${secao?.title || regra.target.id}"`;
    }
    const item = sections.flatMap(s => s.items).find(i => i.id === regra.target.id);
    const texto = item?.description || regra.target.id;
    return `Condição do item "${texto.length > 60 ? `${texto.slice(0, 60)}…` : texto}"`;
  };

  const soltarRegras = (regras: { id: string }[]) => {
    for (const regra of regras) {
      const alvo = condicoes.rules.find(r => r.id === regra.id)?.target;
      if (alvo) condicoes.definirRegra(alvo, null);
    }
  };

  const removeSection = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || sectionHasPersistedItem(section)) return;

    const arrastadas = regrasArrastadas({
      sections: [sectionId],
      items: section.items.map(i => i.id),
    });

    const ok = await confirm({
      title: 'Remover seção?',
      description: arrastadas.length > 0
        ? 'Remove a seção e todos os seus itens deste roteiro em edição. As condições ligadas a ela saem junto — sem isso ficariam apontando para um alvo que não existe mais.'
        : 'Remove a seção e todos os seus itens deste roteiro em edição.',
      consequences: arrastadas.map(descreverRegraArrastada),
      confirmLabel: 'Remover seção',
    });
    if (ok) {
      soltarRegras(arrastadas);
      setSections(sections.filter(s => s.id !== sectionId));
      if (selected?.sectionId === sectionId) setSelected(null);
    }
  };

  /**
   * Duplicar seção — a cópia **nunca** aponta para ids do original: seção, itens e
   * as condições que miram dentro dela ganham id novo, e as condições copiadas são
   * reescritas para os alvos da cópia.
   */
  const duplicateSection = (sectionId: string, index: number) => {
    const { section: copia, rules: regrasCopiadas } = cloneSectionForDuplicate(
      { sections, rules: condicoes.rules, routingQuestions: condicoes.routingQuestions },
      sectionId,
      () => generateId()
    );
    if (!copia) return;

    const comMarca: EditingSection = {
      ...copia,
      title: `${copia.title} (cópia)`,
      // A cópia é item novo: sem `originalDescription` e sem aposentadoria herdada.
      items: copia.items.map(item => ({ ...item, originalDescription: undefined, retiredAt: null })),
    };

    const proximas = [...sections];
    proximas.splice(index + 1, 0, comMarca);
    setSections(proximas);
    for (const regra of regrasCopiadas) condicoes.definirRegra(regra.target, regra);
    setSelected({ sectionId: comMarca.id, itemId: null });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sections.length - 1)) return;
    const newSections = [...sections];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]];
    setSections(newSections);
  };

  // --- Item Actions ---
  const addItem = (sectionId: string) => {
    const newItem: EditingItem = {
      id: generateId(),
      description: '',
      legislation: '',
      legislationUrl: '',
      weight: 1,
      isCritical: false,
      requirementType: 'legal',
      guidance: '',
      retiredAt: null,
      order: 0,
    };
    setSections(sections.map(s => s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s));
    setSelected({ sectionId, itemId: newItem.id });
  };

  function updateItem<K extends keyof EditingItem>(sectionId: string, itemId: string, field: K, value: EditingItem[K]) {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, items: s.items.map(i => i.id === itemId ? { ...i, [field]: value } : i) };
    }));
  }

  const removeItem = async (sectionId: string, itemId: string) => {
    const arrastadas = regrasArrastadas({ items: [itemId] });
    if (arrastadas.length > 0) {
      const ok = await confirm({
        title: 'Remover item com condição?',
        description: 'A condição deste item sai junto — sem isso ela ficaria apontando para um item que não existe mais.',
        consequences: arrastadas.map(descreverRegraArrastada),
        confirmLabel: 'Remover item',
        cancelLabel: 'Cancelar',
      });
      if (!ok) return;
      soltarRegras(arrastadas);
    }
    setSections(sections.map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s));
    if (selected?.itemId === itemId) setSelected(null);
  };

  const duplicateItem = (sectionId: string, item: EditingItem, index: number) => {
    const copy: EditingItem = { ...item, id: generateId(), originalDescription: undefined, retiredAt: null };
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      const newItems = [...s.items];
      newItems.splice(index + 1, 0, copy);
      return { ...s, items: newItems };
    }));

    // A cópia leva a condição do original, com id de regra novo e mirando a cópia.
    // Sem o id novo seriam duas regras com o mesmo id — `duplicate_id` no validador.
    const regraDoOriginal = condicoes.regraDe({ type: 'item', id: item.id });
    if (regraDoOriginal) {
      const alvo = { type: 'item' as const, id: copy.id };
      condicoes.definirRegra(alvo, { ...regraDoOriginal, id: generateId(), target: alvo });
    }

    setSelected({ sectionId, itemId: copy.id });
  };

  const moveItem = (sectionId: string, index: number, direction: 'up' | 'down') => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === s.items.length - 1)) return s;
      const newItems = [...s.items];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
      return { ...s, items: newItems };
    }));
  };

  const retireItem = async (sectionId: string, itemId: string) => {
    const ok = await confirm({
      title: 'Aposentar este item?',
      description: 'O item some das próximas inspeções. Inspeções já em andamento continuam vendo-o até terminar, e relatório concluído nunca muda — ele usa uma fotografia do roteiro da época em que foi feito. Dá para reativar depois.',
      confirmLabel: 'Aposentar item',
      cancelLabel: 'Cancelar',
      tone: 'default',
    });
    if (!ok) return;
    updateItem(sectionId, itemId, 'retiredAt', new Date().toISOString());
  };

  const reactivateItem = (sectionId: string, itemId: string) => {
    updateItem(sectionId, itemId, 'retiredAt', null);
  };

  const selectedSection = selected ? sections.find(s => s.id === selected.sectionId) : undefined;
  const selectedItem = selectedSection?.items.find(i => i.id === selected?.itemId);
  const selectedIndex = selectedSection?.items.findIndex(i => i.id === selected?.itemId) ?? -1;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-surface border-b border-default shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/templates')} className="rounded-xl shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-navy truncate">{isEditing ? 'Editar Roteiro' : 'Novo Roteiro'}</h1>
              {isEditing && <p className="text-xs text-navy-3 font-medium">Edita no lugar — não cria versão nova</p>}
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Roteiro
          </Button>
        </div>
      </div>

      <PageShell className="space-y-6">
        {error && (
          <div className="p-4 bg-danger-soft border border-danger-soft-border text-danger-soft-ink rounded-xl flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {isEditing && (
          <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-100 rounded-2xl text-sm text-accent-ink">
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              Relatório concluído usa uma <strong>fotografia do roteiro</strong> tirada na hora da
              conclusão — editar aqui não muda relatório já entregue. O que muda é a lista das
              próximas inspeções: quem já está em andamento termina com o roteiro de quando começou.
            </p>
          </div>
        )}

        {/* METADATA */}
        <Card className="p-6 overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Label>Nome do Roteiro</Label>
              <Input
                className="mt-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Checklist Estética 2025"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select className="mt-1.5" value={category} onChange={(e) => setCategory(e.target.value as ClientCategory)}>
                <option value="estetica">Estética</option>
                <option value="ilpi">ILPI</option>
                <option value="alimentos">Alimentos</option>
                <option value="saude">Saúde</option>
              </Select>
            </div>
          </div>
        </Card>

        {/* ── COND-06 · CONDIÇÕES ──────────────────────────── */}
        {isEditing && !condicoes.carregando && (
          <>
            {condicoes.erro && (
              <div className="p-4 bg-danger-soft border border-danger-soft-border text-danger-soft-ink rounded-xl flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold">{condicoes.erro}</span>
              </div>
            )}

            <RoutingQuestionsPanel
              questions={condicoes.routingQuestions}
              rules={condicoes.rules}
              sections={sections.map(s => ({ id: s.id, title: s.title }))}
              onChange={condicoes.definirPerguntas}
              podeAposentar={condicoes.podeAposentarPergunta}
              podeExcluirOpcao={condicoes.podeExcluirOpcao}
              makeId={generateId}
            />

            {/* ── COND-07 · testar antes de publicar ─────────── */}
            <ApplicabilitySimulator
              sections={arvoreParaSimular}
              rules={condicoes.rules}
              questions={condicoes.routingQuestions}
            />

            <Card className="p-6 space-y-4 overflow-visible">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-navy">Publicação das condições</h2>
                  <p className="mt-1 max-w-2xl text-xs text-navy-3 leading-relaxed">
                    O rascunho pode ficar pela metade — ele nunca chega em inspeção. Só a versão
                    publicada é congelada nas inspeções novas.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge variant="neutral">
                      {condicoes.temPublicada ? 'Há versão publicada' : 'Nunca publicado'}
                    </Badge>
                    <Badge variant="neutral">
                      {condicoes.rules.length} {condicoes.rules.length === 1 ? 'condição' : 'condições'}
                    </Badge>
                    {condicoes.sujo && (
                      <span className="font-semibold text-amber-strong">Alterações não salvas</span>
                    )}
                  </div>
                </div>
                {/* COND-07 — o gate desabilita antes de tentar, e diz por quê. */}
                <Button
                  variant="secondary"
                  onClick={handlePublish}
                  disabled={isPublishing || isSaving || !condicoes.gate.ready}
                  title={
                    condicoes.gate.ready
                      ? undefined
                      : `Publicação bloqueada: ${condicoes.gate.blockers.length} problema(s) nas condições.`
                  }
                  className="shrink-0"
                >
                  {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {condicoes.temPublicada ? 'Publicar nova versão' : 'Publicar condições'}
                </Button>
              </div>

              {publishOk && (
                <p className="flex items-center gap-2 rounded-xl bg-success-soft border border-success-soft-border p-3 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Condições publicadas. As próximas inspeções deste roteiro já nascem com elas.
                </p>
              )}

              {publishError && (
                <p className="flex items-center gap-2 rounded-xl bg-danger-soft border border-danger-soft-border p-3 text-sm font-semibold text-danger-soft-ink">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {publishError}
                </p>
              )}

              {publishIssues.length > 0 && (
                <div className="rounded-xl border border-danger-soft-border bg-danger-soft p-4">
                  <p className="text-sm font-bold text-danger-soft-ink">
                    A publicação foi recusada — {publishIssues.length}{' '}
                    {publishIssues.length === 1 ? 'problema impede' : 'problemas impedem'} congelar estas condições.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {publishIssues.map((issue, i) => (
                      <li key={`${issue.code}-${i}`} className="text-xs text-danger-soft-ink">
                        • {issue.message}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-danger-soft-ink">
                    O rascunho continua salvo — nada do que você escreveu se perdeu.
                  </p>
                </div>
              )}

              {/*
                COND-07 · o gate. Não é aviso: enquanto houver bloqueio, o botão está
                desabilitado. A lista vem agrupada por causa porque uma opção renomeada
                errado costuma render dez linhas iguais — e o que se conserta é a causa.
              */}
              {publishIssues.length === 0 && !condicoes.gate.ready && (
                <div className="rounded-xl border border-amber-soft-border bg-amber-soft p-4">
                  <p className="flex items-start gap-2 text-sm font-bold text-amber-soft-ink">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    Publicação bloqueada — {condicoes.gate.blockers.length}{' '}
                    {condicoes.gate.blockers.length === 1 ? 'problema impede' : 'problemas impedem'}{' '}
                    congelar estas condições.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {condicoes.gate.groups.map(grupo => (
                      <li key={grupo.code}>
                        <p className="text-xs font-bold text-amber-soft-ink">
                          {grupo.label} · {grupo.issues.length}
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {grupo.issues.map((problema, i) => {
                            const onde = describeIssueLocation(problema, {
                              sections,
                              routingQuestions: condicoes.routingQuestions,
                            });
                            return (
                              <li key={`${grupo.code}-${i}`} className="text-xs text-amber-soft-ink">
                                • {problema.message}
                                {onde && <span className="block pl-3 font-semibold">↳ {onde}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-soft-ink">
                    Dá para salvar o rascunho assim mesmo e resolver depois — o que não dá é publicar.
                  </p>
                </div>
              )}

              {/* Aviso não reprova nada: fica visível mesmo com o gate liberado. */}
              {condicoes.gate.warnings.length > 0 && (
                <div className="rounded-xl border border-default bg-surface-sunken p-4">
                  <p className="flex items-start gap-2 text-xs font-bold text-navy-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    {condicoes.gate.warnings.length}{' '}
                    {condicoes.gate.warnings.length === 1 ? 'observação' : 'observações'} — não impedem
                    publicar.
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {condicoes.gate.warnings.map((problema, i) => (
                      <li key={`aviso-${i}`} className="text-xs text-navy-3">• {problema.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </>
        )}

        {/* MASTER-DETAIL: índice à esquerda, item completo à direita */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ÍNDICE */}
          <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-24 space-y-4">
            {sections.map((section, sIdx) => {
              const blocked = sectionHasPersistedItem(section);
              const regraDaSecao = condicoes.regraDe({ type: 'section', id: section.id });
              const secaoSelecionada = selected?.sectionId === section.id && selected.itemId === null;
              return (
                <Card key={section.id} className="overflow-hidden">
                  <div className="bg-surface-sunken border-b border-default p-3 space-y-2">
                    <div className="flex items-center gap-2">
                    <div className="flex flex-col shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={sIdx === 0} onClick={() => moveSection(sIdx, 'up')}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={sIdx === sections.length - 1} onClick={() => moveSection(sIdx, 'down')}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      type="text"
                      aria-label="Nome da seção"
                      className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 font-bold text-navy focus-visible:ring-offset-1"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                      placeholder="Nome da Seção"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-navy-3"
                      title="Duplicar seção"
                      onClick={() => duplicateSection(section.id, sIdx)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-navy-3 hover:text-danger hover:bg-danger-soft disabled:opacity-30"
                      disabled={blocked}
                      title={blocked ? 'Aposente os itens desta seção antes de removê-la' : 'Remover seção'}
                      onClick={() => removeSection(section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    </div>

                    {/* A seção condicional se anuncia no índice (COND-06). Clicar abre a
                        aplicabilidade da seção inteira, não de um item. */}
                    <button
                      type="button"
                      onClick={() => setSelected({ sectionId: section.id, itemId: null })}
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[11px] transition-colors',
                        secaoSelecionada
                          ? 'bg-primary-50 font-semibold text-primary-800'
                          : 'text-navy-3 hover:bg-surface-hover'
                      )}
                    >
                      <span>{section.items.length} {section.items.length === 1 ? 'item' : 'itens'}</span>
                      {regraDaSecao && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-accent-ink">
                            <GitBranch className="h-3 w-3" /> Condicional
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {section.items.length > 0 && (
                    <div className="divide-y divide-surface-sunken">
                      {section.items.map((item, iIdx) => {
                        const isSelected = selected?.sectionId === section.id && selected.itemId === item.id;
                        const openCount = openResponseCounts[item.id] || 0;
                        return (
                          <div key={item.id} className={cn('flex items-center gap-1 px-1.5 py-1', isSelected && 'bg-primary-50')}>
                            <div className="flex flex-col shrink-0">
                              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={iIdx === 0} onClick={() => moveItem(section.id, iIdx, 'up')}>
                                <ArrowUp className="h-2.5 w-2.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={iIdx === section.items.length - 1} onClick={() => moveItem(section.id, iIdx, 'down')}>
                                <ArrowDown className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelected({ sectionId: section.id, itemId: item.id })}
                              className={cn(
                                'flex-1 min-w-0 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs',
                                isSelected ? 'font-semibold text-primary-800' : 'text-navy-2 hover:bg-surface-hover'
                              )}
                            >
                              <span className={cn(
                                'truncate',
                                item.retiredAt && 'text-navy-3 line-through',
                                !item.description && 'italic text-navy-3'
                              )}>
                                {item.description || 'Nova pergunta…'}
                              </span>
                              {item.isCritical && (
                                <span className="h-1.5 w-1.5 rounded-full bg-danger shrink-0" title="Item crítico" />
                              )}
                              {/* `lucide-react` marca o SVG como `aria-hidden` — o nome
                                  acessível tem que vir do invólucro, não do ícone. */}
                              {condicoes.regraDe({ type: 'item', id: item.id }) && (
                                <span
                                  role="img"
                                  aria-label="Item condicional"
                                  title="Item condicional"
                                  className="shrink-0 text-accent-ink"
                                >
                                  <GitBranch className="h-3 w-3" />
                                </span>
                              )}
                              {openCount > 0 && (
                                <span
                                  className="shrink-0 rounded-full bg-amber-soft px-1.5 text-[10px] font-bold text-amber-strong"
                                  title={`${openCount} resposta(s) em inspeção em andamento`}
                                >
                                  {openCount}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-2">
                    <Button variant="ghost" size="sm" className="w-full border border-dashed border-default" onClick={() => addItem(section.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Item
                    </Button>
                  </div>
                </Card>
              );
            })}

            <Button onClick={addSection} variant="secondary" fullWidth>
              <Plus className="h-4 w-4 mr-2" /> Nova Seção
            </Button>
          </div>

          {/* DETALHE DO ITEM */}
          <div className="flex-1 min-w-0">
            {selectedSection && selected?.itemId === null ? (
              /* SEÇÃO SELECIONADA — a seção inteira também tem aplicabilidade (COND-06) */
              <Card className="p-6 space-y-6 overflow-visible">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Seção</p>
                  <h2 className="mt-0.5 text-lg font-bold text-navy">{selectedSection.title}</h2>
                  <p className="mt-0.5 text-xs text-navy-3">
                    {selectedSection.items.length}{' '}
                    {selectedSection.items.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>

                {isEditing ? (
                  <ApplicabilityFieldset
                    target={{ type: 'section', id: selectedSection.id }}
                    targetLabel="esta seção"
                    rule={condicoes.regraDe({ type: 'section', id: selectedSection.id })}
                    questions={condicoes.routingQuestions}
                    onChange={(rule) => condicoes.definirRegra({ type: 'section', id: selectedSection.id }, rule)}
                    makeId={generateId}
                  />
                ) : (
                  <p className="rounded-xl border border-default bg-surface-sunken p-4 text-xs text-navy-2">
                    Salve o roteiro para poder definir condições. Elas vivem numa versão à parte,
                    e um roteiro que ainda não existe não tem o que versionar.
                  </p>
                )}
              </Card>
            ) : !selectedItem || !selectedSection ? (
              <Card>
                <EmptyState
                  icon={<ClipboardList className="h-8 w-8" />}
                  title="Selecione um item"
                  description="Escolha um item na lista à esquerda para ver e editar a pergunta completa."
                />
              </Card>
            ) : (
              <Card className="p-6 space-y-6 overflow-visible">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">{selectedSection.title}</p>
                    <p className="text-xs text-navy-3 mt-0.5">Item {selectedIndex + 1} de {selectedSection.items.length}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => duplicateItem(selectedSection.id, selectedItem, selectedIndex)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicar
                    </Button>
                    {!isPersistedId(selectedItem.id) ? (
                      <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => removeItem(selectedSection.id, selectedItem.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
                      </Button>
                    ) : selectedItem.retiredAt ? (
                      <Button variant="outline" size="sm" onClick={() => reactivateItem(selectedSection.id, selectedItem.id)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reativar item
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-strong border-amber-soft-border hover:bg-amber-soft"
                        onClick={() => retireItem(selectedSection.id, selectedItem.id)}
                      >
                        <Archive className="h-3.5 w-3.5 mr-1.5" /> Aposentar item
                      </Button>
                    )}
                  </div>
                </div>

                {selectedItem.retiredAt && (
                  <div className="flex items-start gap-3 p-3 bg-surface-sunken border border-default rounded-xl text-xs text-navy-2">
                    <Archive className="h-4 w-4 shrink-0 mt-0.5 text-navy-3" />
                    <p>
                      Aposentado em {formatDateBR(selectedItem.retiredAt)}.
                      <Badge variant="neutral" className="ml-2 align-middle">Aposentado</Badge>
                    </p>
                  </div>
                )}

                <div>
                  <Label>Pergunta do item</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={3}
                    value={selectedItem.description}
                    onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'description', e.target.value)}
                    placeholder="Descrição do item de inspeção..."
                  />
                  {isPersistedId(selectedItem.id) &&
                    selectedItem.originalDescription !== undefined &&
                    selectedItem.originalDescription !== selectedItem.description &&
                    (openResponseCounts[selectedItem.id] || 0) > 0 && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-strong">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {openResponseCounts[selectedItem.id]} resposta(s) em inspeção em andamento vão
                        aparecer sob esta pergunta nova. Ao salvar, você confirma a mudança.
                      </p>
                    )}
                </div>

                <div>
                  <Label htmlFor="campo-orientacao">Orientação de campo</Label>
                  <Textarea
                    id="campo-orientacao"
                    className="mt-1.5"
                    rows={4}
                    value={selectedItem.guidance}
                    onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'guidance', e.target.value)}
                    placeholder="Ex: Consultório indiferenciado: 7,5 m² com dimensão mínima de 2,2 m (RDC 50/2002, Parte II, item 3, Unidade Funcional 1)."
                  />
                  <p className="mt-1.5 text-xs text-navy-3">
                    O que a consultora precisa saber para responder: números de dimensionamento,
                    endereço exato na norma, enquadramentos aplicáveis. Aparece recolhida na
                    execução e vira <b>Critério da norma</b> no relatório. Mudar aqui não altera a
                    pergunta nem o sentido de resposta já gravada.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Legislação</Label>
                    <Input
                      className="mt-1.5"
                      value={selectedItem.legislation}
                      onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'legislation', e.target.value)}
                      placeholder="Ex: RDC 216/2004, art. 4º"
                    />
                  </div>
                  <div>
                    <Label>Link da legislação</Label>
                    <Input
                      className="mt-1.5"
                      type="url"
                      value={selectedItem.legislationUrl}
                      onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'legislationUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Peso</Label>
                    <Select
                      className="mt-1.5"
                      value={selectedItem.weight}
                      onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'weight', Number(e.target.value))}
                    >
                      <option value={1}>1 — Sugerido</option>
                      <option value={2}>2 — Recomendado</option>
                      <option value={5}>5 — Necessário</option>
                      <option value={10}>10 — Imprescindível</option>
                    </Select>
                  </div>
                  <div>
                    <Label>&nbsp;</Label>
                    <Checkbox
                      checked={selectedItem.isCritical}
                      onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'isCritical', e.target.checked)}
                      className="h-10 items-center font-medium text-navy-2"
                      boxClassName="mt-0 accent-danger"
                      label="Item crítico"
                    />
                  </div>
                  <div>
                    <Label>Tipo de exigência</Label>
                    <Select
                      className="mt-1.5"
                      value={selectedItem.requirementType}
                      onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'requirementType', e.target.value as 'legal' | 'good_practice')}
                    >
                      <option value="legal">Legal (norma vigente)</option>
                      <option value="good_practice">Boa prática (sem base legal)</option>
                    </Select>
                    <p className="mt-1 text-[11px] text-navy-3 leading-snug">
                      Não entra no cálculo da nota — só muda o rótulo da legislação e a página de
                      referências do PDF.
                    </p>
                  </div>
                </div>

                {isEditing && (
                  <ApplicabilityFieldset
                    target={{ type: 'item', id: selectedItem.id }}
                    targetLabel="este item"
                    rule={condicoes.regraDe({ type: 'item', id: selectedItem.id })}
                    questions={condicoes.routingQuestions}
                    onChange={(rule) => condicoes.definirRegra({ type: 'item', id: selectedItem.id }, rule)}
                    makeId={generateId}
                  />
                )}
              </Card>
            )}
          </div>
        </div>
      </PageShell>
      {confirmDialog}
    </div>
  );
}
