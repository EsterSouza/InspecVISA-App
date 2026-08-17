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
  not_complies: 'Não cumpre',
  not_applicable: 'Não aplicável',
  not_observed: 'Não observado',
  not_evaluated: 'Não avaliado',
};

const RESULT_STYLES: Record<ResponseResult, string> = {
  complies: 'border-green-200 bg-green-50 text-green-700',
  not_complies: 'border-danger-soft-border bg-danger-soft text-danger-soft-ink',
  not_applicable: 'border-default bg-surface-sunken text-navy-2',
  not_observed: 'border-default bg-surface-sunken text-navy-2',
  not_evaluated: 'border-amber-200 bg-amber-50 text-amber-700',
};

function ResponseCard({ item, response }: { item?: ChecklistItem; response?: InspectionResponse }) {
  const title = response?.customDescription || item?.description || 'Item recuperado do preenchimento sincronizado';
  const details = [
    { label: 'Situação encontrada', value: response?.situationDescription },
    { label: 'Ação corretiva', value: response?.correctiveAction },
    { label: 'Responsável', value: response?.responsible },
    { label: 'Prazo', value: response?.deadline },
  ].filter(detail => Boolean(detail.value));

  return (
    <article className="rounded-xl border border-default bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-navy-3">Item {item.order}</p>}
          <p className="text-sm font-medium leading-relaxed text-navy">{title}</p>
        </div>
        {response ? (
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', RESULT_STYLES[response.result])}>
            {RESULT_LABELS[response.result]}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-control bg-surface px-2.5 py-1 text-xs font-semibold text-navy-3">
            Não preenchido
          </span>
        )}
      </div>

      {details.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg bg-surface-sunken p-3 text-sm text-navy-2">
          {details.map(detail => (
            <p key={detail.label}>
              <span className="font-semibold text-navy">{detail.label}: </span>
              {detail.value}
            </p>
          ))}
        </div>
      )}

      {(response?.photos?.length || 0) > 0 && (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-navy-3">
            <Camera className="h-3.5 w-3.5" />
            {response?.photos?.length} foto(s) sincronizada(s)
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {response?.photos?.map(photo => (
              photo.dataUrl.startsWith('data:image/') ? (
                <img
                  key={photo.id}
                  src={photo.dataUrl}
                  alt={photo.caption || 'Foto sincronizada do item'}
                  className="aspect-square rounded-lg border border-default object-cover"
                />
              ) : (
                <div key={photo.id} className="flex aspect-square items-center justify-center rounded-lg border border-default bg-surface-sunken">
                  <Camera className="h-5 w-5 text-navy-3" />
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
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o preenchimento sincronizado.');
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
  const totalTemplateItems = (template?.sections || []).reduce((total, section) => total + section.items.length, 0);
  const answeredTemplateItems = Array.from(representedItemIds).filter(itemId => responsesByItem.has(itemId)).length;
  const pendingCount = Math.max(totalTemplateItems - answeredTemplateItems, 0);

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
          Esta visualização consulta o que já foi sincronizado na nuvem pela equipe. Nenhuma resposta ou foto pode ser alterada aqui.
        </p>

        {loading && !snapshot && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-navy-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            Consultando preenchimento sincronizado...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-semibold">
              <WifiOff className="h-4 w-4" />
              Não foi possível carregar a visualização
            </p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {snapshot && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-default bg-surface-sunken p-3">
                <p className="text-2xl font-bold text-navy">{answeredCount}</p>
                <p className="text-xs font-semibold uppercase text-navy-3">Itens respondidos</p>
              </div>
              <div className="rounded-xl border border-danger-soft-border bg-danger-soft p-3">
                <p className="text-2xl font-bold text-danger-soft-ink">{notCompliantCount}</p>
                <p className="text-xs font-semibold uppercase text-danger">Não conformes</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
                <p className="text-xs font-semibold uppercase text-amber-600">Não preenchidos</p>
              </div>
              <div className="rounded-xl border border-default bg-surface-sunken p-3">
                <p className="text-2xl font-bold text-navy">{snapshot.photos.length}</p>
                <p className="text-xs font-semibold uppercase text-navy-3">Fotos</p>
              </div>
            </div>

            {answeredCount === 0 && (
              <p className="rounded-lg border border-default bg-surface-sunken p-5 text-center text-sm text-navy-3">
                Ainda não existem respostas sincronizadas para esta inspeção.
              </p>
            )}

            {template?.sections.map(section => {
              return (
                <section key={section.id} className="space-y-3">
                  <h3 className="border-b border-default pb-2 text-sm font-bold text-navy">{section.title}</h3>
                  {section.items.map(item => (
                    <ResponseCard key={item.id} item={item} response={responsesByItem.get(item.id)} />
                  ))}
                </section>
              );
            })}

            {extraResponses.length > 0 && (
              <section className="space-y-3">
                <h3 className="border-b border-default pb-2 text-sm font-bold text-navy">Itens adicionais preenchidos</h3>
                {extraResponses.map(response => <ResponseCard key={response.id} response={response} />)}
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
