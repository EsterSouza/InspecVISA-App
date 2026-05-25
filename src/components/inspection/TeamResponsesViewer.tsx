import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Eye, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type { ChecklistItem, ChecklistTemplate, InspectionResponse, ResponseResult } from '../../types';
import { InspectionService, type RemoteInspectionSnapshot } from '../../services/inspectionService';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface TeamResponsesViewerProps {
  inspectionId: string;
  isOpen: boolean;
  onClose: () => void;
  template: ChecklistTemplate | null;
}

const RESULT_LABELS: Record<ResponseResult, string> = {
  complies: 'Cumpre',
  not_complies: 'Nao cumpre',
  not_applicable: 'Nao aplicavel',
  not_observed: 'Nao observado',
  not_evaluated: 'Nao avaliado',
};

const RESULT_STYLES: Record<ResponseResult, string> = {
  complies: 'border-green-200 bg-green-50 text-green-700',
  not_complies: 'border-red-200 bg-red-50 text-red-700',
  not_applicable: 'border-gray-200 bg-gray-100 text-gray-700',
  not_observed: 'border-slate-200 bg-slate-50 text-slate-700',
  not_evaluated: 'border-amber-200 bg-amber-50 text-amber-700',
};

function ResponseCard({ item, response }: { item?: ChecklistItem; response: InspectionResponse }) {
  const title = response.customDescription || item?.description || 'Item recuperado do preenchimento sincronizado';
  const details = [
    { label: 'Situacao encontrada', value: response.situationDescription },
    { label: 'Acao corretiva', value: response.correctiveAction },
    { label: 'Responsavel', value: response.responsible },
    { label: 'Prazo', value: response.deadline },
  ].filter(detail => Boolean(detail.value));

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Item {item.order}</p>}
          <p className="text-sm font-medium leading-relaxed text-gray-900">{title}</p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', RESULT_STYLES[response.result])}>
          {RESULT_LABELS[response.result]}
        </span>
      </div>

      {details.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {details.map(detail => (
            <p key={detail.label}>
              <span className="font-semibold text-gray-900">{detail.label}: </span>
              {detail.value}
            </p>
          ))}
        </div>
      )}

      {(response.photos?.length || 0) > 0 && (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-500">
            <Camera className="h-3.5 w-3.5" />
            {response.photos?.length} foto(s) sincronizada(s)
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {response.photos?.map(photo => (
              photo.dataUrl.startsWith('data:image/') ? (
                <img
                  key={photo.id}
                  src={photo.dataUrl}
                  alt={photo.caption || 'Foto sincronizada do item'}
                  className="aspect-square rounded-lg border border-gray-200 object-cover"
                />
              ) : (
                <div key={photo.id} className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                  <Camera className="h-5 w-5 text-gray-400" />
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function TeamResponsesViewer({ inspectionId, isOpen, onClose, template }: TeamResponsesViewerProps) {
  const [snapshot, setSnapshot] = useState<RemoteInspectionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await InspectionService.getRemoteInspectionSnapshot(inspectionId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel consultar o preenchimento sincronizado.');
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    if (!isOpen) return;
    setSnapshot(null);
    void loadSnapshot();
  }, [isOpen, loadSnapshot]);

  const responsesByItem = useMemo(
    () => new Map((snapshot?.responses || []).map(response => [response.itemId, response])),
    [snapshot]
  );
  const representedItemIds = useMemo(
    () => new Set((template?.sections || []).flatMap(section => section.items.map(item => item.id))),
    [template]
  );
  const extraResponses = (snapshot?.responses || []).filter(response => !representedItemIds.has(response.itemId));
  const answeredCount = snapshot?.responses.length || 0;
  const notCompliantCount = (snapshot?.responses || []).filter(response => response.result === 'not_complies').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-5xl"
      title={(
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary-600" />
          <span>Preenchimento sincronizado da equipe</span>
          <Badge variant="outline" className="border-primary-200 bg-primary-50 text-primary-700">Somente leitura</Badge>
        </div>
      )}
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => void loadSnapshot()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <p className="rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-primary-900">
          Esta visualizacao consulta o que ja foi sincronizado na nuvem pela equipe. Nenhuma resposta ou foto pode ser alterada aqui.
        </p>

        {loading && !snapshot && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Consultando preenchimento sincronizado...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-semibold">
              <WifiOff className="h-4 w-4" />
              Nao foi possivel carregar a visualizacao
            </p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {snapshot && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-2xl font-bold text-gray-900">{answeredCount}</p>
                <p className="text-xs font-semibold uppercase text-gray-500">Itens respondidos</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-700">{notCompliantCount}</p>
                <p className="text-xs font-semibold uppercase text-red-600">Nao conformes</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-2xl font-bold text-gray-900">{snapshot.photos.length}</p>
                <p className="text-xs font-semibold uppercase text-gray-500">Fotos</p>
              </div>
            </div>

            {answeredCount === 0 && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
                Ainda nao existem respostas sincronizadas para esta inspecao.
              </p>
            )}

            {template?.sections.map(section => {
              const sectionItems = section.items.filter(item => responsesByItem.has(item.id));
              if (sectionItems.length === 0) return null;

              return (
                <section key={section.id} className="space-y-3">
                  <h3 className="border-b border-gray-100 pb-2 text-sm font-bold text-gray-800">{section.title}</h3>
                  {sectionItems.map(item => (
                    <ResponseCard key={item.id} item={item} response={responsesByItem.get(item.id)!} />
                  ))}
                </section>
              );
            })}

            {extraResponses.length > 0 && (
              <section className="space-y-3">
                <h3 className="border-b border-gray-100 pb-2 text-sm font-bold text-gray-800">Itens adicionais preenchidos</h3>
                {extraResponses.map(response => <ResponseCard key={response.id} response={response} />)}
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
