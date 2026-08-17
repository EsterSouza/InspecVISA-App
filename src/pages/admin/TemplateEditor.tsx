import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown,
  AlertTriangle, Copy, Loader2, Archive, RotateCcw, Info, ClipboardList,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Label } from '../../components/ui/Label';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageShell } from '../../components/ui/PageShell';
import { useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TemplateService } from '../../services/templateService';
import { cn } from '../../lib/utils';
import type { ClientCategory } from '../../types';

interface EditingItem {
  id: string; // temp id (não-uuid) para item novo, nunca salvo
  description: string;
  legislation: string;
  legislationUrl: string;
  weight: number;
  isCritical: boolean;
  requirementType: 'legal' | 'good_practice';
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
  itemId: string;
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

  useEffect(() => {
    if (isEditing && id) {
      loadTemplate(id);
    } else {
      setSections([{ id: generateId(), title: 'Nova Seção', order: 1, items: [] }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing]);

  const loadTemplate = async (templateId: string) => {
    try {
      setIsLoading(true);
      const tpl = await TemplateService.getFullTemplate(templateId);
      setName(tpl.name);
      setCategory(tpl.category);
      setVersion(tpl.version || '1');

      const loadedSections: EditingSection[] = tpl.sections.map((sec: any) => ({
        id: sec.id,
        title: sec.title,
        order: sec.order,
        items: (sec.items || []).map((it: any) => ({
          id: it.id,
          description: it.description,
          originalDescription: it.description,
          legislation: it.legislation || it.legislation_name || '',
          legislationUrl: it.legislationUrl || it.legislation_url || '',
          weight: it.weight || 1,
          isCritical: it.isCritical || it.is_critical || false,
          requirementType: it.requirementType || it.requirement_type || 'legal',
          retiredAt: it.retiredAt || it.retired_at || null,
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
    } catch (err: any) {
      console.error('Error loading template:', err);
      setError(err.message || 'Erro ao carregar roteiro.');
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
        await TemplateService.updateFullTemplate(id, { name, category, version }, orderedSections);
      } else {
        const rawItems: any[] = [];
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
            });
          });
        });
        await TemplateService.saveFullTemplate(name, category, rawItems);
      }

      await TemplateService.syncAllTemplatesToDexie();
      navigate('/templates');
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.message || 'Erro ao salvar o roteiro.');
    } finally {
      setIsSaving(false);
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

  const removeSection = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || sectionHasPersistedItem(section)) return;
    const ok = await confirm({
      title: 'Remover seção?',
      description: 'Remove a seção e todos os seus itens deste roteiro em edição.',
      confirmLabel: 'Remover seção',
    });
    if (ok) {
      setSections(sections.filter(s => s.id !== sectionId));
      if (selected?.sectionId === sectionId) setSelected(null);
    }
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

  const removeItem = (sectionId: string, itemId: string) => {
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
    <div className="min-h-screen bg-surface-sunken pb-24">
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
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {isEditing && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
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

        {/* MASTER-DETAIL: índice à esquerda, item completo à direita */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ÍNDICE */}
          <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-24 space-y-4">
            {sections.map((section, sIdx) => {
              const blocked = sectionHasPersistedItem(section);
              return (
                <Card key={section.id} className="overflow-hidden">
                  <div className="bg-surface-sunken border-b border-default p-3 flex items-center gap-2">
                    <div className="flex flex-col shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={sIdx === 0} onClick={() => moveSection(sIdx, 'up')}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={sIdx === sections.length - 1} onClick={() => moveSection(sIdx, 'down')}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <input
                      type="text"
                      className="flex-1 min-w-0 bg-transparent font-bold text-sm text-navy border-none p-0 focus:ring-0 placeholder-navy-3"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                      placeholder="Nome da Seção"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-navy-3 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"
                      disabled={blocked}
                      title={blocked ? 'Aposente os itens desta seção antes de removê-la' : 'Remover seção'}
                      onClick={() => removeSection(section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Item crítico" />
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
            {!selectedItem || !selectedSection ? (
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
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeItem(selectedSection.id, selectedItem.id)}>
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
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-navy-2 h-10">
                      <input
                        type="checkbox"
                        className="rounded border-control text-red-600 focus:ring-red-500 h-4 w-4 cursor-pointer"
                        checked={selectedItem.isCritical}
                        onChange={(e) => updateItem(selectedSection.id, selectedItem.id, 'isCritical', e.target.checked)}
                      />
                      Item crítico
                    </label>
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
              </Card>
            )}
          </div>
        </div>
      </PageShell>
      {confirmDialog}
    </div>
  );
}
