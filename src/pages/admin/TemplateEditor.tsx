import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown,
  AlertTriangle, GripVertical, Copy, Loader2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TemplateService } from '../../services/templateService';
import type { ClientCategory } from '../../types';

interface EditingItem {
  id: string; // temp id for UI if new
  description: string;
  legislation: string;
  weight: number;
  isCritical: boolean;
  order: number;
}

interface EditingSection {
  id: string; // temp id for UI if new
  title: string;
  order: number;
  items: EditingItem[];
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

  useEffect(() => {
    if (isEditing && id) {
      loadTemplate(id);
    } else {
      // Default empty section
      setSections([{ id: generateId(), title: 'Nova Seção', order: 1, items: [] }]);
    }
  }, [id]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const loadTemplate = async (templateId: string) => {
    try {
      setIsLoading(true);
      const tpl = await TemplateService.getFullTemplate(templateId);
      setName(tpl.name);
      setCategory(tpl.category);
      setVersion(tpl.version || '1');
      
      const loadedSections = tpl.sections.map((sec: any) => ({
        id: sec.id,
        title: sec.title,
        order: sec.order,
        items: (sec.items || []).map((it: any) => ({
          id: it.id,
          description: it.description,
          legislation: it.legislation || it.legislation_name || '',
          weight: it.weight || 1,
          isCritical: it.isCritical || it.is_critical || false,
          order: it.order
        }))
      }));
      setSections(loadedSections);
    } catch (err: any) {
      console.error('Error loading template:', err);
      setError(err.message || 'Erro ao carregar roteiro.');
    } finally {
      setIsLoading(false);
    }
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

    try {
      setIsSaving(true);
      setError(null);

      // Fix order before saving
      const orderedSections = sections.map((sec, sIdx) => ({
        ...sec,
        order: sIdx + 1,
        items: sec.items.map((it, iIdx) => ({ ...it, order: iIdx + 1 }))
      }));

      if (isEditing && id) {
        await TemplateService.updateFullTemplate(id, { name, category, version }, orderedSections);
      } else {
        // We use saveFullTemplate logic, but we can't use RawImportItem directly without mapping
        // We map it to the raw format saveFullTemplate expects
        const rawItems: any[] = [];
        orderedSections.forEach(sec => {
          sec.items.forEach(it => {
            rawItems.push({
              section: sec.title,
              description: it.description,
              legislation: it.legislation,
              weight: it.weight,
              isCritical: it.isCritical
            });
          });
        });
        await TemplateService.saveFullTemplate(name, category, rawItems);
      }

      // Re-fetch all to Dexie
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

  const removeSection = (sectionId: string) => {
    if (confirm('Tem certeza que deseja remover esta seção e todos os seus itens?')) {
      setSections(sections.filter(s => s.id !== sectionId));
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
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          items: [...s.items, { id: generateId(), description: '', legislation: '', weight: 1, isCritical: false, order: s.items.length + 1 }]
        };
      }
      return s;
    }));
  };

  const updateItem = (sectionId: string, itemId: string, field: keyof EditingItem, value: any) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          items: s.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
        };
      }
      return s;
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, items: s.items.filter(i => i.id !== itemId) };
      }
      return s;
    }));
  };

  const duplicateItem = (sectionId: string, item: EditingItem, index: number) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        const newItems = [...s.items];
        newItems.splice(index + 1, 0, { ...item, id: generateId() });
        return { ...s, items: newItems };
      }
      return s;
    }));
  };

  const moveItem = (sectionId: string, index: number, direction: 'up' | 'down') => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === s.items.length - 1)) return s;
        const newItems = [...s.items];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
        return { ...s, items: newItems };
      }
      return s;
    }));
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/templates')} className="rounded-xl shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{isEditing ? 'Editar Roteiro' : 'Novo Roteiro'}</h1>
              {isEditing && <p className="text-xs text-gray-500 font-medium">Edições podem criar uma nova versão (Histórico Protegido)</p>}
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Roteiro
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* METADATA */}
        <Card className="p-6 overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome do Roteiro</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Checklist Estética 2025"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoria</label>
              <select
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                value={category}
                onChange={(e) => setCategory(e.target.value as ClientCategory)}
              >
                <option value="estetica">Estética</option>
                <option value="ilpi">ILPI</option>
                <option value="alimentos">Alimentos</option>
                <option value="saude">Saúde</option>
              </select>
            </div>
          </div>
        </Card>

        {/* SECTIONS */}
        <div className="space-y-8">
          {sections.map((section, sIdx) => (
            <Card key={section.id} className="overflow-hidden border-2 border-gray-100 hover:border-gray-200 transition-colors shadow-sm">
              <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveSection(sIdx, 'up')} disabled={sIdx === 0} className="p-1 hover:bg-gray-200 rounded text-gray-400 disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => moveSection(sIdx, 'down')} disabled={sIdx === sections.length - 1} className="p-1 hover:bg-gray-200 rounded text-gray-400 disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    className="w-full bg-transparent font-bold text-lg text-gray-900 border-none p-0 focus:ring-0 placeholder-gray-400"
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                    placeholder="Nome da Seção (Ex: Recepção)"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeSection(section.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-4 space-y-4">
                {section.items.map((item, iIdx) => (
                  <div key={item.id} className="flex gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm group">
                    <div className="flex flex-col gap-1 shrink-0 mt-1">
                      <button onClick={() => moveItem(section.id, iIdx, 'up')} disabled={iIdx === 0} className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => moveItem(section.id, iIdx, 'down')} disabled={iIdx === section.items.length - 1} className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-12">
                        <textarea
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                          rows={2}
                          value={item.description}
                          onChange={(e) => updateItem(section.id, item.id, 'description', e.target.value)}
                          placeholder="Descrição do item de inspeção..."
                        />
                      </div>
                      <div className="md:col-span-6">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                          value={item.legislation}
                          onChange={(e) => updateItem(section.id, item.id, 'legislation', e.target.value)}
                          placeholder="Legislação (Opcional)"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <select
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                          value={item.weight}
                          onChange={(e) => updateItem(section.id, item.id, 'weight', Number(e.target.value))}
                        >
                          <option value={1}>Peso 1 (Sugerido)</option>
                          <option value={2}>Peso 2 (Recomendado)</option>
                          <option value={5}>Peso 5 (Necessário)</option>
                          <option value={10}>Peso 10 (Imprescindível)</option>
                        </select>
                      </div>
                      <div className="md:col-span-3 flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4 cursor-pointer"
                            checked={item.isCritical}
                            onChange={(e) => updateItem(section.id, item.id, 'isCritical', e.target.checked)}
                          />
                          Item Crítico?
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => duplicateItem(section.id, item, iIdx)} className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Duplicar">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(section.id, item.id)} className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50" title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={() => addItem(section.id)} className="w-full border-dashed">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Item à {section.title || 'Seção'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center pt-4">
          <Button onClick={addSection} variant="secondary" className="px-8 shadow-sm">
            <Plus className="h-5 w-5 mr-2" /> Nova Seção
          </Button>
        </div>

      </div>
    </div>
  );
}
