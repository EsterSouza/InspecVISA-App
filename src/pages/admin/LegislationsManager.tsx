import React, { useState, useEffect } from 'react';
import { LegislationService, type Legislation } from '../../services/legislationService';
import { Plus, Trash2, ExternalLink, Search, BookOpen, AlertCircle, Loader2, Edit2, Check, X, Link } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function LegislationsManager() {
  const [legislations, setLegislations] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newLeg, setNewLeg] = useState({ name: '', summary: '', url: '' });
  const [isSeeding, setIsSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', summary: '', url: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

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
    } catch (err) {
      alert('Erro ao importar legislações sugeridas');
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleAdd() {
    if (!newLeg.name) return;
    try {
      await LegislationService.saveLegislation(newLeg);
      setNewLeg({ name: '', summary: '', url: '' });
      setIsAdding(false);
      loadLegislations();
    } catch (err) {
      alert('Erro ao salvar legislação');
    }
  }

  function startEdit(leg: Legislation) {
    setEditingId(leg.id);
    setEditForm({ name: leg.name, summary: leg.summary || '', url: leg.url || '' });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name) return;
    try {
      setSavingId(id);
      await LegislationService.updateLegislation(id, editForm);
      setEditingId(null);
      loadLegislations();
    } catch (err) {
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
    } catch (err) {
      alert('Erro ao excluir');
    }
  }

  const isDefaultEntry = (id: string) => id.startsWith('default-');

  const filtered = legislations.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsAdding(false); setNewLeg({ name: '', summary: '', url: '' }); }}>
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
