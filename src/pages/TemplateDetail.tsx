import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, ChevronDown, ChevronRight,
  AlertTriangle, BookOpen, Scale, Loader2, ClipboardList,
  CheckCircle2, Info,
} from 'lucide-react';
import { getTemplateById } from '../data/templates';
import { TemplateService } from '../services/templateService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface TemplateItem {
  id: string;
  description: string;
  legislation?: string;
  weight?: number;
  isCritical?: boolean;
  order?: number;
}

interface TemplateSection {
  id: string;
  title: string;
  order?: number;
  items: TemplateItem[];
}

interface FullTemplate {
  id: string;
  name: string;
  category: string;
  version?: string;
  sections: TemplateSection[];
  isStatic?: boolean;
}

const WEIGHT_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  10: { label: 'Imprescindível', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  5:  { label: 'Necessário',     color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  2:  { label: 'Recomendado',    color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  1:  { label: 'Sugerido',       color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
};

function getWeightInfo(weight?: number) {
  if (!weight) return WEIGHT_LABELS[1];
  return WEIGHT_LABELS[weight] || WEIGHT_LABELS[1];
}

const CATEGORY_LABELS: Record<string, string> = {
  ilpi: 'ILPI',
  alimentos: 'Alimentos',
  estetica: 'Estética',
  saude: 'Saúde',
};

export function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<FullTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const isStatic = id?.startsWith('tpl-');

  useEffect(() => {
    if (!id) { navigate('/templates'); return; }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isStatic) {
          // Load from static built-in templates
          const tpl = getTemplateById(id);
          if (!tpl) throw new Error('Roteiro não encontrado.');
          setTemplate({ ...tpl, isStatic: true });
          // Expand first section by default
          if (tpl.sections.length > 0) {
            setExpandedSections(new Set([tpl.sections[0].id]));
          }
        } else {
          // Load full template from Supabase
          const tpl = await TemplateService.getFullTemplate(id);
          setTemplate({ ...tpl, isStatic: false });
          // Expand first section by default
          const sections = (tpl as any).sections || [];
          if (sections.length > 0) {
            setExpandedSections(new Set([sections[0].id]));
          }
        }
      } catch (err: any) {
        console.error('[TemplateDetail] load error:', err);
        setError(err?.message || 'Erro ao carregar roteiro.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const expandAll = () => {
    if (!template) return;
    setExpandedSections(new Set(template.sections.map(s => s.id)));
  };

  const collapseAll = () => setExpandedSections(new Set());

  const stats = useMemo(() => {
    if (!template) return null;
    const allItems = template.sections.flatMap(s => s.items);
    return {
      total: allItems.length,
      critical: allItems.filter(i => i.isCritical).length,
      sections: template.sections.length,
      withLegislation: allItems.filter(i => i.legislation).length,
    };
  }, [template]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <p className="text-red-600 font-semibold">{error || 'Roteiro não encontrado.'}</p>
        <Button onClick={() => navigate('/templates')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos Roteiros
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/templates')} className="rounded-xl shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900 truncate">{template.name}</h1>
                {template.isStatic && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-semibold shrink-0">
                    <Lock className="h-3 w-3" /> Padrão — somente leitura
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="neutral" className="uppercase text-[10px]">
                  {CATEGORY_LABELS[template.category] || template.category}
                </Badge>
                {template.version && (
                  <span className="text-[10px] text-gray-400 font-semibold">v{template.version}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={expandAll}
              className="text-xs text-primary-600 hover:text-primary-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
            >
              Expandir tudo
            </button>
            <button
              onClick={collapseAll}
              className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Recolher tudo
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── STATS CARDS ───────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: ClipboardList, label: 'Seções', value: stats.sections, color: 'text-primary-600', bg: 'bg-primary-50' },
              { icon: CheckCircle2, label: 'Itens Totais', value: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: AlertTriangle, label: 'Itens Críticos', value: stats.critical, color: 'text-red-600', bg: 'bg-red-50' },
              { icon: BookOpen, label: 'Com Legislação', value: stats.withLegislation, color: 'text-green-600', bg: 'bg-green-50' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
                <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── LEGEND ────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Legenda de peso:</span>
          {Object.entries(WEIGHT_LABELS).map(([w, info]) => (
            <span key={w} className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${info.color} ${info.bg}`}>
              {info.label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
            <AlertTriangle className="h-3 w-3" /> Crítico
          </span>
        </div>

        {/* ── SECTIONS ──────────────────────────────────────── */}
        <div className="space-y-3">
          {template.sections.map((section, idx) => {
            const isExpanded = expandedSections.has(section.id);
            const items = section.items || [];
            const criticalCount = items.filter(i => i.isCritical).length;

            return (
              <div
                key={section.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all"
              >
                {/* Section header */}
                <button
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary-600">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm truncate">{section.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400">{items.length} itens</span>
                        {criticalCount > 0 && (
                          <span className="text-[11px] text-red-600 font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> {criticalCount} críticos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 ml-4">
                    {isExpanded
                      ? <ChevronDown className="h-5 w-5 text-gray-400" />
                      : <ChevronRight className="h-5 w-5 text-gray-400" />
                    }
                  </div>
                </button>

                {/* Items list */}
                {isExpanded && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {items.length === 0 ? (
                      <div className="px-6 py-6 text-center text-sm text-gray-400 italic">
                        Nenhum item nesta seção.
                      </div>
                    ) : (
                      items.map((item, itemIdx) => {
                        const weightInfo = getWeightInfo(item.weight);
                        return (
                          <div
                            key={item.id}
                            className={`px-5 py-4 flex gap-4 hover:bg-gray-50/70 transition-colors ${item.isCritical ? 'border-l-2 border-red-400' : ''}`}
                          >
                            {/* Item number */}
                            <div className="shrink-0 w-7 pt-0.5 text-right">
                              <span className="text-xs font-bold text-gray-300">{itemIdx + 1}</span>
                            </div>

                            {/* Item content */}
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="text-sm text-gray-800 leading-relaxed">{item.description}</p>

                              <div className="flex flex-wrap gap-2 items-center">
                                {/* Weight badge */}
                                <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${weightInfo.color} ${weightInfo.bg}`}>
                                  {weightInfo.label}
                                </span>

                                {/* Critical badge */}
                                {item.isCritical && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5" /> CRÍTICO
                                  </span>
                                )}

                                {/* Legislation */}
                                {item.legislation && (
                                  <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                                    <Scale className="h-3 w-3 text-gray-400 shrink-0" />
                                    <span className="truncate max-w-[300px]">{item.legislation}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── FOOTER NOTE ───────────────────────────────────── */}
        {template.isStatic && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              Este é um <strong>roteiro padrão</strong> do InspecVISA. Seu conteúdo é gerenciado pela equipe C&C Consultoria.
              Para criar um roteiro personalizado, use a opção <strong>"Importar ROI"</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
