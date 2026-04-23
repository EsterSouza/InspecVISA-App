import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Trash2, FileDown, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import { extractBaseLegislation } from '../../utils/pdfGenerator';
import type { ChecklistTemplate, InspectionResponse } from '../../types';

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  template: ChecklistTemplate;
  responses: InspectionResponse[];
  onGenerate: (opts: { selectedLegislations: string[]; signatureDataUrl: string | undefined }) => Promise<void>;
  isGenerating: boolean;
}

export function PdfPreviewModal({
  open, onClose, template, responses, onGenerate, isGenerating
}: PdfPreviewModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [legislations, setLegislations] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasSignature, setHasSignature] = useState(false);
  const [skipSignature, setSkipSignature] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Extract unique base legislations on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setHasSignature(false);
    setSkipSignature(false);

    const evaluatedIds = new Set(responses.map(r => r.itemId));
    const mentionedSet = new Set<string>();
    template.sections.forEach(sec =>
      sec.items.forEach(item => {
        if (!evaluatedIds.has(item.id)) return;
        if (!item.legislation) return;
        extractBaseLegislation(item.legislation).forEach(b => mentionedSet.add(b));
      })
    );
    const sorted = Array.from(mentionedSet).sort();
    setLegislations(sorted);
    setSelected(new Set(sorted)); // all selected by default
  }, [open, template, responses]);

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
      next.has(leg) ? next.delete(leg) : next.add(leg);
      return next;
    });
  };

  const handleGenerate = async () => {
    let signatureDataUrl: string | undefined;
    if (!skipSignature && canvasRef.current && hasSignature) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }
    await onGenerate({ selectedLegislations: Array.from(selected), signatureDataUrl });
    onClose();
  };

  if (!open) return null;

  const canProceed = step === 1 || skipSignature || hasSignature;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs font-bold text-primary-600 uppercase tracking-widest">
              Passo {step} de 2
            </p>
            <h2 className="text-lg font-extrabold text-gray-900">
              {step === 1 ? 'Referências Legislativas' : 'Assinatura Digital'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 px-5 pt-3 pb-1 shrink-0">
          {[1, 2].map(s => (
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
                Selecione as legislações que devem aparecer na última página do PDF. Todas já estão marcadas — desmarque as que não quiser incluir.
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
                      {leg}
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
          {step === 2 ? (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <div />
          )}

          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
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
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                : <><FileDown className="h-4 w-4" /> Gerar PDF</>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
