import React, { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { NO_DEADLINE } from '../../utils/clientActionPlan';
import type { ChecklistTemplate, InspectionResponse } from '../../types';

type Filtro = 'todas' | 'criticas' | 'reincidentes' | 'imediato';

/**
 * Ações corretivas do relatório concluído, em tabela densa em vez de uma pilha
 * de cartões — com 18 não conformidades a pilha é a rolagem que este redesenho
 * existe para acabar.
 *
 * "Sem prazo" é estado próprio, com selo (decisão 33): ausência de data não pode
 * se parecer com esquecimento.
 */
export function CorrectiveActionsTable({ responses, template, recurringItemIds }: {
  responses: InspectionResponse[];
  template: ChecklistTemplate;
  recurringItemIds: Set<string>;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const itemById = useMemo(
    () => new Map(template.sections.flatMap(s => s.items).map(i => [i.id, i])),
    [template],
  );

  const linhas = useMemo(() => responses.map((nc) => {
    const item = itemById.get(nc.itemId);
    const prazo = (nc.deadline || '').trim();
    return {
      response: nc,
      titulo: item?.description || nc.customDescription || 'Item sem descrição',
      critica: !!item?.isCritical,
      reincidente: recurringItemIds.has(nc.itemId),
      imediato: prazo.toLowerCase() === 'imediato',
      semPrazo: !prazo || prazo === NO_DEADLINE,
      prazo,
    };
  }), [responses, itemById, recurringItemIds]);

  const contagens = {
    todas: linhas.length,
    criticas: linhas.filter(l => l.critica).length,
    reincidentes: linhas.filter(l => l.reincidente).length,
    imediato: linhas.filter(l => l.imediato).length,
  };

  const visiveis = linhas.filter((l) => {
    if (filtro === 'criticas') return l.critica;
    if (filtro === 'reincidentes') return l.reincidente;
    if (filtro === 'imediato') return l.imediato;
    return true;
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy">Ações corretivas — {linhas.length}</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por gravidade">
          {([
            ['todas', 'Todas'],
            ['criticas', 'Críticas'],
            ['reincidentes', 'Reincidentes'],
            ['imediato', 'Prazo imediato'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filtro === value}
              onClick={() => setFiltro(value)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-navy-2 hover:bg-gray-50 aria-[pressed=true]:border-primary-700 aria-[pressed=true]:bg-primary-50 aria-[pressed=true]:font-semibold aria-[pressed=true]:text-primary-800"
              style={{ minHeight: 44 }}
            >
              {label}
              <span className="tabular-nums text-navy-3">{contagens[value]}</span>
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-navy-2">
            {linhas.length === 0
              ? 'Nenhuma não conformidade registrada.'
              : 'Nenhuma não conformidade neste filtro.'}
          </p>
          {linhas.length > 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setFiltro('todas')}>
              Ver todas
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-navy-3">
                <th scope="col" className="px-5 py-2 font-semibold">Requisito</th>
                <th scope="col" className="px-3 py-2 font-semibold">Situação encontrada</th>
                <th scope="col" className="px-3 py-2 font-semibold">O que precisa ser feito</th>
                <th scope="col" className="px-3 py-2 font-semibold">Responsável</th>
                <th scope="col" className="px-5 py-2 font-semibold">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.response.id} className="border-b border-gray-100 align-top last:border-b-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy">{l.titulo}</p>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {l.critica && <Badge variant="danger">crítico</Badge>}
                      {l.reincidente && <Badge variant="warning">reincidência</Badge>}
                      {(l.response.photos?.length ?? 0) > 0 && (
                        <Badge variant="neutral">
                          {l.response.photos!.length} {l.response.photos!.length === 1 ? 'foto' : 'fotos'}
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-navy-2">
                    {l.response.situationDescription || <span className="text-danger-soft-ink">não escrita</span>}
                  </td>
                  <td className="px-3 py-3 text-navy-2">
                    {l.response.correctiveAction || <span className="text-danger-soft-ink">não escrita</span>}
                  </td>
                  <td className="px-3 py-3 text-navy-2">{l.response.responsible || '—'}</td>
                  <td className="px-5 py-3">
                    {l.semPrazo
                      ? <Badge variant="outline">sem prazo</Badge>
                      : <span className="text-navy-2">{l.prazo}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-gray-200 px-5 py-3">
        <p className="text-xs text-navy-3">
          <strong>Sem prazo</strong> aparece no portal do cliente, mas nunca conta como vencida — é
          uma escolha, não uma data esquecida.
        </p>
      </div>
    </Card>
  );
}
