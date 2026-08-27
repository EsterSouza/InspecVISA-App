// ============================================================
// src/components/inspection/RoutingQuestionsBlock.tsx
// COND-08 — as perguntas que definem o roteiro, respondidas em campo.
//
// Elas não são requisito sanitário e não podem parecer um (contrato § 3): sem
// conforme/não conforme, sem peso, sem foto, sem plano de ação. O bloco tem
// vocabulário próprio — "define o roteiro" — e mora acima dos requisitos que
// libera, nunca no meio deles.
//
// A saída obrigatória do campo é "não foi possível determinar" (contrato § 6.4):
// a consultora saiu do local sem conseguir apurar, e isso é resposta legítima —
// o que depende da pergunta fica **pendente e visível**, nunca sumido.
// ============================================================

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { RoutingQuestionField } from './RoutingQuestionField';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { isUndeterminedAnswer } from '../../domain/applicability';
import type { ExecutionQuestion, RoutingAnswer } from '../../domain/applicability';

export interface RoutingQuestionsBlockProps {
  questions: ExecutionQuestion[];
  onAnswer: (questionId: string, answer: RoutingAnswer | null) => void;
  /** Título do bloco. Dentro da seção ele é mais discreto do que no topo. */
  title?: string;
  disabled?: boolean;
  errors?: Record<string, string>;
}

function stampLabel(stamp?: { at: string; by?: string }): string | null {
  if (!stamp?.at) return null;
  const quando = new Date(stamp.at);
  if (Number.isNaN(quando.getTime())) return null;
  const texto = quando.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return stamp.by ? `${stamp.by} · ${texto}` : texto;
}

function controlsLabel(controls: { sections: number; items: number }): string | null {
  const partes: string[] = [];
  if (controls.sections > 0) partes.push(`${controls.sections} seção(ões)`);
  if (controls.items > 0) partes.push(`${controls.items} exigência(s)`);
  return partes.length > 0 ? `Define ${partes.join(' e ')}` : null;
}

export function RoutingQuestionsBlock({
  questions,
  onAnswer,
  title = 'Perguntas que definem o roteiro',
  disabled,
  errors,
}: RoutingQuestionsBlockProps) {
  // Qual pergunta está com a caixa de justificativa aberta. Uma por vez: a
  // justificativa é exceção, não campo de rotina.
  const [justifying, setJustifying] = useState<string | null>(null);
  const [justification, setJustification] = useState('');

  if (questions.length === 0) return null;

  const emAberto = questions.filter((entry) => entry.blocking).length;

  return (
    <section
      aria-labelledby="roteamento-titulo"
      className="mx-3 mb-3 rounded-md border border-default bg-surface p-4 lg:mx-0 lg:mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="roteamento-titulo" className="flex items-center gap-2 text-sm font-semibold text-navy">
          <HelpCircle className="h-4 w-4 text-navy-3" aria-hidden="true" />
          {title}
        </h2>
        {emAberto > 0 && <Badge variant="warning">{emAberto} obrigatória(s) em aberto</Badge>}
      </div>
      <p className="mt-1 text-xs text-navy-2">
        Não entram na nota nem no plano de ação. Servem para o roteiro mostrar só o que se aplica a esta unidade.
      </p>

      <div className="mt-4 space-y-5">
        {questions.map((entry) => {
          const indeterminada = isUndeterminedAnswer(entry.answer);
          const carimbo = stampLabel(entry.stamp);
          const controla = controlsLabel(entry.controls);
          const abrindo = justifying === entry.question.id;

          return (
            <div key={entry.question.id} className="border-t border-default pt-4 first:border-t-0 first:pt-0">
              <RoutingQuestionField
                question={entry.question}
                answer={indeterminada ? null : entry.answer}
                disabled={disabled}
                error={errors?.[entry.question.id]}
                onChange={(answer) => onAnswer(entry.question.id, answer)}
              />

              {indeterminada && (
                <p className="mt-2 rounded-md bg-amber-soft px-3 py-2 text-xs font-semibold text-amber-soft-ink">
                  Não foi possível determinar
                  {isUndeterminedAnswer(entry.answer) && entry.answer.justification
                    ? ` — ${entry.answer.justification}`
                    : ''}
                  . O que depende desta pergunta fica pendente e aparece no relatório.
                </p>
              )}

              {abrindo ? (
                <div className="mt-3 rounded-md border border-default bg-surface-sunken p-3">
                  <Label htmlFor={`justificativa-${entry.question.id}`} className="mb-1.5">
                    Por que não foi possível determinar?
                  </Label>
                  <Input
                    id={`justificativa-${entry.question.id}`}
                    className="h-11"
                    autoFocus
                    placeholder="Ex.: sala fechada, responsável ausente"
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const texto = justification.trim();
                        onAnswer(entry.question.id, texto ? { undetermined: true, justification: texto } : { undetermined: true });
                        setJustifying(null);
                        setJustification('');
                      }}
                    >
                      Registrar
                    </Button>
                    <Button variant="ghost" onClick={() => { setJustifying(null); setJustification(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {!indeterminada && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setJustification('');
                        setJustifying(entry.question.id);
                      }}
                      className="text-xs font-semibold text-primary-800 underline underline-offset-2 hover:text-primary-900 disabled:text-navy-3"
                    >
                      Não foi possível determinar
                    </button>
                  )}
                  {controla && <span className="text-xs text-navy-3">{controla}</span>}
                  {carimbo && <span className="text-xs text-navy-3">Respondida por {carimbo}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
