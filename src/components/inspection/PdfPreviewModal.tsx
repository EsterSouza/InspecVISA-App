import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Trash2, FileDown, Loader2, CheckSquare, Square, Plus, Link2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { extractBaseLegislation, canonicalLegislationKey } from '../../utils/legislationRefs';
import { isLegislationApplicable, type Legislation } from '../../services/legislationService';
import type { ChecklistTemplate, InspectionResponse, Inspection, ReferenceSource } from '../../types';

type LegTag = 'roteiro' | 'uf' | 'segmento';

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  template: ChecklistTemplate;
  responses: InspectionResponse[];
  inspection: Inspection;
  legislationLibrary?: Legislation[];
  onGenerate: (opts: { selectedLegislations: string[]; referenceSources: ReferenceSource[]; signatureDataUrl: string | undefined }) => Promise<void>;
  isGenerating: boolean;
  progressLabel?: string;
}

export function PdfPreviewModal({
  open, onClose, template, responses, inspection, legislationLibrary, onGenerate, isGenerating, progressLabel
}: PdfPreviewModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [legislations, setLegislations] = useState<string[]>([]);
  const [legTags, setLegTags] = useState<Map<string, LegTag>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<ReferenceSource[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [sourceUrlError, setSourceUrlError] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [skipSignature, setSkipSignature] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Extract unique base legislations on open
  useEffect(() => {
    if (!open) return;
    // Opening is the modal lifecycle boundary; reset its transient workflow state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1);
    setHasSignature(false);
    setSkipSignature(false);
    setSources(inspection.referenceSources || []);
    setSourceUrl('');
    setSourceTitle('');
    setSourceNote('');
    setSourceUrlError(null);

    // 1. Legislações CITADAS nos itens avaliados (comportamento original).
    const evaluatedIds = new Set(responses.map(r => r.itemId));
    const citedBases = new Set<string>();
    template.sections.forEach(sec =>
      sec.items.forEach(item => {
        if (!evaluatedIds.has(item.id)) return;
        if (!item.legislation) return;
        extractBaseLegislation(item.legislation).forEach(b => citedBases.add(b));
      })
    );

    // 2. Legislações APLICÁVEIS da biblioteca (estaduais/municipais da UF + federais
    //    curadas para o segmento), mesmo que não citadas em nenhum item.
    const library = legislationLibrary || [];
    const matchLib = (s: string) =>
      library.find(l =>
        l.name.toUpperCase().includes(s.toUpperCase()) || s.toUpperCase().includes(l.name.toUpperCase())
      );

    // Dedup por chave canônica: "RDC 502/2021" e "RDC ANVISA nº 502/2021" viram um só.
    // Preferimos o nome oficial da biblioteca como rótulo quando disponível.
    const byKey = new Map<string, { label: string; tag: LegTag; fromLib: boolean }>();
    const addEntry = (label: string, tag: LegTag, fromLib: boolean) => {
      const key = canonicalLegislationKey(label);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { label, tag, fromLib });
      } else if (fromLib && !existing.fromLib) {
        // Substitui o rótulo curto da citação pelo nome oficial da biblioteca.
        byKey.set(key, { label, tag, fromLib });
      }
    };

    // Citadas nos itens (sempre relevantes), canonicalizadas para o nome da biblioteca.
    citedBases.forEach(base => {
      const lib = matchLib(base);
      addEntry(lib?.name || base, lib?.uf ? 'uf' : 'roteiro', !!lib);
    });

    // Aplicáveis da biblioteca (UF + segmento), sem duplicar as já citadas.
    library.forEach(leg => {
      if (!isLegislationApplicable(leg, inspection.state, inspection.clientCategory)) return;
      addEntry(leg.name, leg.uf ? 'uf' : 'segmento', true);
    });

    const entries = Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
    const tags = new Map<string, LegTag>();
    entries.forEach(e => tags.set(e.label, e.tag));
    const sorted = entries.map(e => e.label);
    setLegislations(sorted);
    setLegTags(tags);
    setSelected(new Set(sorted)); // all selected by default
  }, [open, template, responses, legislationLibrary, inspection]);

  // Canvas drawing helpers
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  }, []);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  const toggleLeg = (leg: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(leg)) next.delete(leg);
      else next.add(leg);
      return next;
    });
  };

  const addSource = () => {
    const url = sourceUrl.trim();
    if (!url) {
      setSourceUrlError('Informe o link da fonte.');
      return;
    }
    if (!isValidHttpUrl(url)) {
      setSourceUrlError('Link inválido. Use um endereço começando com http:// ou https://');
      return;
    }
    setSources(prev => [...prev, {
      id: crypto.randomUUID(),
      url,
      title: sourceTitle.trim() || undefined,
      note: sourceNote.trim() || undefined,
    }]);
    setSourceUrl('');
    setSourceTitle('');
    setSourceNote('');
    setSourceUrlError(null);
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const handleGenerate = async () => {
    let signatureDataUrl: string | undefined;
    if (!skipSignature && canvasRef.current && hasSignature) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }
    await onGenerate({ selectedLegislations: Array.from(selected), referenceSources: sources, signatureDataUrl });
    onClose();
  };

  if (!open) return null;

  const canProceed = step !== 3 || skipSignature || hasSignature;
  const stepTitle = step === 1 ? 'Referências Legislativas' : step === 2 ? 'Fontes Consultadas' : 'Assinatura Digital';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs font-bold text-primary-600 uppercase tracking-widest">
              Passo {step} de 3
            </p>
            <h2 className="text-lg font-extrabold text-gray-900">
              {stepTitle}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 px-5 pt-3 pb-1 shrink-0">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= s ? 'bg-primary-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Selecione as legislações que devem aparecer na última página do PDF. Já incluímos as citadas no roteiro e as estaduais/municipais e federais aplicáveis a este estabelecimento e UF. Todas estão marcadas — desmarque as que não quiser incluir.
              </p>
              {legislations.length === 0 ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
                  Nenhuma legislação encontrada nos itens avaliados. O PDF será gerado sem a seção de referências.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {legislations.map(leg => (
                    <button
                      key={leg}
                      onClick={() => toggleLeg(leg)}
                      className={`w-full flex items-start gap-3 text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        selected.has(leg)
                          ? 'bg-primary-50 border border-primary-200 text-primary-900'
                          : 'bg-gray-50 border border-gray-200 text-gray-400 line-through'
                      }`}
                    >
                      {selected.has(leg)
                        ? <CheckSquare className="h-4 w-4 shrink-0 text-primary-500 mt-0.5" />
                        : <Square className="h-4 w-4 shrink-0 text-gray-300 mt-0.5" />
                      }
                      <span className="flex-1">{leg}</span>
                      {legTags.get(leg) === 'uf' && (
                        <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          Estadual/Municipal
                        </span>
                      )}
                      {legTags.get(leg) === 'segmento' && (
                        <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                          Aplicável
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 text-right">{selected.size} de {legislations.length} selecionadas</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Anexe links de fontes consultadas além das legislações do roteiro — laudos, notas técnicas, páginas oficiais. Elas entram no PDF numa seção própria, após as referências legislativas.
              </p>

              {sources.length > 0 && (
                <div className="space-y-1.5">
                  {sources.map(source => (
                    <div key={source.id} className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                      <Link2 className="h-4 w-4 shrink-0 text-primary-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{source.title || source.url}</p>
                        <p className="text-xs text-gray-500 truncate">{source.url}</p>
                        {source.note && <p className="text-xs text-gray-400 mt-0.5">{source.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSource(source.id)}
                        className="shrink-0 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`Remover fonte ${source.title || source.url}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div>
                  <label htmlFor="source-url" className="text-xs font-medium text-gray-700">Link <span className="text-red-500">*</span></label>
                  <input
                    id="source-url"
                    type="url"
                    value={sourceUrl}
                    onChange={e => { setSourceUrl(e.target.value); setSourceUrlError(null); }}
                    placeholder="https://..."
                    className="mt-1 w-full min-h-10 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  {sourceUrlError && <p role="alert" className="mt-1 text-xs text-red-600">{sourceUrlError}</p>}
                </div>
                <div>
                  <label htmlFor="source-title" className="text-xs font-medium text-gray-700">Título</label>
                  <input
                    id="source-title"
                    value={sourceTitle}
                    onChange={e => setSourceTitle(e.target.value)}
                    placeholder="Ex.: Nota técnica ANVISA sobre..."
                    className="mt-1 w-full min-h-10 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                <div>
                  <label htmlFor="source-note" className="text-xs font-medium text-gray-700">Nota (opcional)</label>
                  <input
                    id="source-note"
                    value={sourceNote}
                    onChange={e => setSourceNote(e.target.value)}
                    placeholder="Ex.: consultado em 05/08/2026"
                    className="mt-1 w-full min-h-10 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={addSource}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 text-sm font-semibold text-primary-800 hover:bg-primary-100"
                >
                  <Plus className="h-4 w-4" /> Adicionar fonte
                </button>
              </div>

              {sources.length === 0 && (
                <p className="text-xs text-gray-400">Nenhuma fonte adicionada. O relatório sai sem essa seção, sem problema.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Assine abaixo com o dedo (celular/tablet) ou mouse. A assinatura será impressa na página de encerramento do PDF.
              </p>

              {/* Canvas */}
              <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={160}
                  className="w-full"
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                {!hasSignature && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                    Assine aqui...
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={clearCanvas}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Limpar
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipSignature}
                    onChange={e => setSkipSignature(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  Pular assinatura
                </label>
              </div>

              {!skipSignature && !hasSignature && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                  ⚠️ Assine acima ou marque "Pular assinatura" para continuar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex justify-between gap-3">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep(prev => (prev + 1) as 1 | 2 | 3)}
              className="flex items-center gap-1 ml-auto"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !canProceed}
              className="flex items-center gap-2 ml-auto"
            >
              {isGenerating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {progressLabel || 'Gerando...'}</>
                : <><FileDown className="h-4 w-4" /> Gerar PDF</>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
