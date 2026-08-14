import React, { useState, useEffect } from 'react';
import { LegislationService, type Legislation, type LegislationSegment, type LegislationStatus } from '../../services/legislationService';
import { UF_OPTIONS, toUF } from '../../utils/state';
import { Plus, Trash2, ExternalLink, Search, BookOpen, AlertCircle, Loader2, Edit2, Check, X, Link } from 'lucide-react';
import { Button } from '../../components/ui/Button';

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
}

const EMPTY_FORM: LegForm = {
  name: '', summary: '', url: '', authority: '', uf: '', segments: [],
  status: 'vigente', replacedBy: '',
};

const STATUS_OPTIONS: { value: LegislationStatus; label: string }[] = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'vigente_com_alteracoes', label: 'Vigente com alterações' },
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
  };
}

export function LegislationsManager() {
  const [legislations, setLegislations] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newLeg, setNewLeg] = useState<LegForm>(EMPTY_FORM);
  const [isSeeding, setIsSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LegForm>(EMPTY_FORM);
  const [savingId, setSavingId] = useState<string | null>(null);

  const toggleSegment = (
    setter: React.Dispatch<React.SetStateAction<LegForm>>,
    segment: LegislationSegment
  ) => {
    setter(prev => ({
      ...prev,
      segments: prev.segments.includes(segment)
        ? prev.segments.filter(s => s !== segment)
        : [...prev.segments, segment],
    }));
  };

  useEffect(() => {
    loadLegislations();
  }, []);

  async function loadLegislations() {
    try {
      setLoading(true);
      const data = await LegislationService.listLegislations();
      setLegislations(data);
    } catch (err) {
      console.error('Failed to load legislations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    if (!confirm('Deseja importar automaticamente as principais legislações sanitárias brasileiras para sua biblioteca?')) return;
    try {
      setIsSeeding(true);
      await LegislationService.seedStandardLegislations();
      await loadLegislations();
    } catch {
      alert('Erro ao importar legislações sugeridas');
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleAdd() {
    if (!newLeg.name || !newLeg.summary) {
      alert('Nome e Resumo são obrigatórios para registrar uma norma técnica.');
      return;
    }
    try {
      await LegislationService.saveLegislation(toPayload(newLeg));
      setNewLeg(EMPTY_FORM);
      setIsAdding(false);
      loadLegislations();
    } catch {
      alert('Erro ao salvar legislação');
    }
  }

  function startEdit(leg: Legislation) {
    setEditingId(leg.id);
    setEditForm({
      name: leg.name,
      summary: leg.summary || '',
      url: leg.url || '',
      authority: leg.authority || '',
      uf: leg.uf || '',
      segments: leg.segments || [],
      status: leg.status || 'vigente',
      replacedBy: leg.replaced_by || '',
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name || !editForm.summary) {
      alert('A legislação deve possuir nome e resumo preenchidos.');
      return;
    }
    try {
      setSavingId(id);
      await LegislationService.updateLegislation(id, toPayload(editForm));
      setEditingId(null);
      loadLegislations();
    } catch {
      alert('Erro ao salvar alterações');
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta legislação?')) return;
    try {
      await LegislationService.deleteLegislation(id);
      loadLegislations();
    } catch {
      alert('Erro ao excluir');
    }
  }

  const isDefaultEntry = (id: string) => id.startsWith('default-');

  const filtered = legislations.filter(l => {
    const hasRequiredFields = l.name && l.summary;
    if (!hasRequiredFields) return false;

    const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Legislação</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as leis vinculadas aos itens de inspeção nos relatórios.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleSeed} 
            disabled={isSeeding}
            className="gap-2 border-primary-200 text-primary-700 hover:bg-primary-50"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Importar Base Padrão
          </Button>
          <Button onClick={() => setIsAdding(true)} className="gap-2 shadow-lg shadow-primary-100">
            <Plus className="h-4 w-4" /> Nova Legislação
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar legislação..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isAdding && (
        <div className="mb-8 p-6 bg-white rounded-2xl border border-primary-100 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary-600" /> Adicionar Nova Legislação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              placeholder="Nome (Ex: RDC nº 63/2011)*"
              className="p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-400 outline-none"
              value={newLeg.name}
              onChange={(e) => setNewLeg({ ...newLeg, name: e.target.value })}
            />
            <input
              placeholder="URL do documento oficial (opcional)"
              className="p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-400 outline-none"
              value={newLeg.url}
              onChange={(e) => setNewLeg({ ...newLeg, url: e.target.value })}
            />
            <textarea
              placeholder="Resumo ou ementa da legislação"
              className="p-3 rounded-lg border border-gray-200 md:col-span-2 h-24 focus:ring-2 focus:ring-primary-400 outline-none resize-none"
              value={newLeg.summary}
              onChange={(e) => setNewLeg({ ...newLeg, summary: e.target.value })}
            />
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Autoria (entra na citação do relatório)
              </label>
              <input
                placeholder="Ex: BRASIL. Ministério da Saúde — ou RIO DE JANEIRO (Município)"
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-400 outline-none"
                value={newLeg.authority}
                onChange={(e) => setNewLeg({ ...newLeg, authority: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Sem autoria a norma é citada só pelo nome. O relatório nunca deduz o órgão.
              </p>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">UF (estadual/municipal)</label>
                <select
                  className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-400 outline-none bg-white"
                  value={toUF(newLeg.uf)}
                  onChange={(e) => setNewLeg({ ...newLeg, uf: e.target.value })}
                >
                  <option value="">Federal / nacional</option>
                  {UF_OPTIONS.map(({ uf, name }) => (
                    <option key={uf} value={uf}>{uf} — {name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Segmentos aplicáveis (vazio = todos)</label>
                <div className="flex flex-wrap gap-2">
                  {SEGMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSegment(setNewLeg, opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        newLeg.segments.includes(opt.value)
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Situação</label>
                <select
                  className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-400 outline-none bg-white"
                  value={newLeg.status}
                  onChange={(e) => setNewLeg({ ...newLeg, status: e.target.value as LegislationStatus })}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {newLeg.status === 'revogada' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Substituída por</label>
                  <input
                    placeholder="Ex: RDC Anvisa nº 222/2018"
                    className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-400 outline-none"
                    value={newLeg.replacedBy}
                    onChange={(e) => setNewLeg({ ...newLeg, replacedBy: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsAdding(false); setNewLeg(EMPTY_FORM); }}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!newLeg.name}>
              <Check className="h-4 w-4 mr-2" /> Salvar Legislação
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma legislação encontrada.</p>
          <p className="text-gray-400 text-sm mt-1">Use o botão "Importar Base Padrão" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((leg) => (
            <div key={leg.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              {editingId === leg.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <input
                    className="w-full p-2 rounded-lg border border-primary-200 text-sm font-semibold focus:ring-2 focus:ring-primary-400 outline-none"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  <textarea
                    className="w-full p-2 rounded-lg border border-gray-200 text-sm h-20 resize-none focus:ring-2 focus:ring-primary-400 outline-none"
                    value={editForm.summary}
                    onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                    placeholder="Resumo ou ementa..."
                  />
                  <input
                    className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                    value={editForm.url}
                    onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                    placeholder="URL do documento (opcional)"
                  />
                  <input
                    className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                    value={editForm.authority}
                    onChange={(e) => setEditForm({ ...editForm, authority: e.target.value })}
                    placeholder="Autoria — ex: BRASIL. Ministério da Saúde"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="w-40 p-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-primary-400 outline-none"
                      value={toUF(editForm.uf)}
                      onChange={(e) => setEditForm({ ...editForm, uf: e.target.value })}
                      aria-label="UF de abrangência"
                    >
                      <option value="">Federal</option>
                      {UF_OPTIONS.map(({ uf }) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                    <select
                      className="w-44 p-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-primary-400 outline-none"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as LegislationStatus })}
                      aria-label="Situação de vigência"
                    >
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-1.5">
                      {SEGMENT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleSegment(setEditForm, opt.value)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                            editForm.segments.includes(opt.value)
                              ? 'bg-primary-50 border-primary-300 text-primary-700'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {editForm.status === 'revogada' && (
                    <input
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                      value={editForm.replacedBy}
                      onChange={(e) => setEditForm({ ...editForm, replacedBy: e.target.value })}
                      placeholder="Substituída por — ex: RDC Anvisa nº 222/2018"
                    />
                  )}
                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" disabled={savingId === leg.id} onClick={() => handleSaveEdit(leg.id)}>
                      {savingId === leg.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base text-gray-900 truncate">{leg.name}</h4>
                      {isDefaultEntry(leg.id) && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                          PADRÃO (não persistido)
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {leg.url && (
                        <a 
                          href={leg.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                          title="Abrir documento"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {!isDefaultEntry(leg.id) && (
                        <>
                          <button 
                            onClick={() => startEdit(leg)} 
                            className="p-1.5 hover:bg-primary-50 text-primary-500 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(leg.id)} 
                            className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-3">
                    {leg.summary || 'Sem resumo disponível.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                      {leg.status === 'revogada' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                          Revogada{leg.replaced_by ? ` → ${leg.replaced_by}` : ''}
                        </span>
                      )}
                      {!leg.authority && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          Sem autoria
                        </span>
                      )}
                      {leg.uf && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          {leg.uf}
                        </span>
                      )}
                      {(leg.segments || []).map(seg => (
                        <span key={seg} className="text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          {SEGMENT_OPTIONS.find(o => o.value === seg)?.label || seg}
                        </span>
                      ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      {!isDefaultEntry(leg.id) && `Adicionado em: ${new Date(leg.created_at).toLocaleDateString('pt-BR')}`}
                    </div>
                    {leg.url ? (
                      <div className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                        <Link className="h-3 w-3" /> Link disponível
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-300 font-semibold">Sem link</div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
