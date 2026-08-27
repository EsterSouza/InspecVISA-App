// ============================================================
// src/components/inspection/ExcludedByRulePanel.tsx
// COND-08 — o que saiu do roteiro por condição.
//
// A feature existe para a consultora não responder o que não se aplica. Mas
// **nada some em silêncio** (contrato § 6.1 e regra inegociável 1): o que saiu
// fica aqui, com o motivo que o próprio motor escreveu, e a resposta já dada
// continua guardada — fora do resultado enquanto a condição valer, de volta se a
// condição voltar.
//
// Nasce fechado: no dia a dia isto é rodapé, não trabalho.
// ============================================================

import React, { useState } from 'react';
import { ChevronDown, EyeOff } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import type { ExcludedTarget } from '../../domain/applicability';

export interface ExcludedByRulePanelProps {
  excluded: ExcludedTarget[];
  /** Quantos dos itens fora da árvore têm resposta gravada. */
  answeredCount: number;
}

export function ExcludedByRulePanel({ excluded, answeredCount }: ExcludedByRulePanelProps) {
  const [open, setOpen] = useState(false);
  if (excluded.length === 0) return null;

  const secoes = excluded.filter((alvo) => alvo.type === 'section');
  const itens = excluded.filter((alvo) => alvo.type === 'item');

  return (
    <section className="mx-3 mt-3 rounded-md border border-default bg-surface lg:mx-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((atual) => !atual)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface-hover"
        style={{ minHeight: 44 }}
      >
        <EyeOff className="h-4 w-4 shrink-0 text-navy-3" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-navy">
            Fora do roteiro por condição ({secoes.length + itens.length})
          </span>
          <span className="mt-0.5 block text-xs text-navy-2">
            {answeredCount > 0
              ? `${answeredCount} com resposta preservada, fora do resultado enquanto a condição valer.`
              : 'Não entram na nota, no relatório nem no plano de ação desta visita.'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-navy-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="border-t border-default">
          {secoes.map((alvo) => (
            <div key={`sec-${alvo.id}`} className="border-b border-default px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-navy">{alvo.label}</span>
                <Badge variant="neutral">Seção</Badge>
                {alvo.answered && <Badge variant="warning">Tem resposta guardada</Badge>}
              </div>
              <p className="mt-1 text-xs text-navy-2">{alvo.decision.explanation}</p>
            </div>
          ))}
          {itens.map((alvo) => (
            <div key={`item-${alvo.id}`} className="border-b border-default px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-navy">{alvo.label}</span>
                {alvo.answered && <Badge variant="warning">Resposta preservada</Badge>}
              </div>
              <p className="mt-1 text-xs text-navy-2">
                {alvo.sectionTitle ? `${alvo.sectionTitle} · ` : ''}
                {alvo.decision.explanation}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
