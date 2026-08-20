// ============================================================
// src/components/inspection/RoutingQuestionField.tsx
// COND-05 — como uma pergunta de roteamento aparece na tela.
//
// Um componente só para os dois lugares onde ela pode ser respondida: o wizard
// de criação (`askAt: 'wizard'`) e a execução em campo (`askAt: 'execution'`,
// COND-08). Duas telas desenhando a mesma pergunta de jeitos diferentes é como
// vocabulário diverge.
//
// Ela NUNCA se parece com um requisito sanitário: sem conforme/não conforme, sem
// peso, sem foto, sem plano de ação (contrato § 3). É pergunta de navegação, e
// tem que ser lida como tal.
// ============================================================

import React from 'react';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Checkbox, Radio } from '../ui/Checkbox';
import { parseRoutingAnswer } from '../../domain/applicability';
import type { RoutingAnswer, RoutingQuestion } from '../../domain/applicability';

export interface RoutingQuestionFieldProps {
  question: RoutingQuestion;
  answer: RoutingAnswer | null | undefined;
  /** Recebe a resposta já normalizada pelo domínio, ou `null` para limpar. */
  onChange: (answer: RoutingAnswer | null, error?: string) => void;
  error?: string;
  disabled?: boolean;
}

/** Prefixo de id estável por pergunta — o id da pergunta já é estável por contrato. */
function controlId(question: RoutingQuestion, suffix?: string): string {
  return `roteamento-${question.id}${suffix ? `-${suffix}` : ''}`;
}

export function RoutingQuestionField({ question, answer, onChange, error, disabled }: RoutingQuestionFieldProps) {
  const emit = (raw: unknown) => {
    const parsed = parseRoutingAnswer(question, raw);
    onChange(parsed.answer, parsed.error);
  };

  // Número é o único tipo com campo livre — e por isso o único com rótulo
  // apontando para um controle. Os outros são grupo de opções, e grupo pede
  // fieldset/legend, não label solto.
  if (question.type === 'number') {
    return (
      <Field
        label={question.text}
        htmlFor={controlId(question)}
        hint={question.helpText}
        error={error}
        required={question.required}
        optional={!question.required}
      >
        <Input
          id={controlId(question)}
          type="number"
          inputMode="decimal"
          className="h-11 max-w-[220px]"
          disabled={disabled}
          value={typeof answer === 'number' ? String(answer) : ''}
          onChange={(event) => emit(event.target.value)}
        />
      </Field>
    );
  }

  const opcoes =
    question.type === 'boolean'
      ? [
          { value: 'true', label: 'Sim' },
          { value: 'false', label: 'Não' },
        ]
      : question.options || [];

  const marcada = (value: string): boolean => {
    if (question.type === 'boolean') return typeof answer === 'boolean' && String(answer) === value;
    if (question.type === 'multi_choice') return Array.isArray(answer) && answer.some((entry) => String(entry) === value);
    return typeof answer === 'string' && answer === value;
  };

  const alternar = (value: string) => {
    if (question.type !== 'multi_choice') {
      emit(question.type === 'boolean' ? value === 'true' : value);
      return;
    }
    const atuais = Array.isArray(answer) ? answer.map(String) : [];
    emit(atuais.includes(value) ? atuais.filter((entry) => entry !== value) : [...atuais, value]);
  };

  const Controle = question.type === 'multi_choice' ? Checkbox : Radio;

  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold text-navy">
        {question.text}
        {question.required && <span className="ml-1 text-danger-soft-ink" aria-hidden="true">*</span>}
        {!question.required && <span className="ml-1.5 text-xs font-normal text-navy-3">(opcional)</span>}
      </legend>
      {question.helpText && <p className="mt-1 text-xs text-navy-2">{question.helpText}</p>}
      {opcoes.length === 0 ? (
        <p className="mt-2 text-sm text-navy-2">Esta pergunta ainda não tem opções configuradas.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {opcoes.map((option) => (
            <Controle
              key={option.value}
              name={controlId(question)}
              value={option.value}
              checked={marcada(option.value)}
              onChange={() => alternar(option.value)}
              label={option.label}
            />
          ))}
        </div>
      )}
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-danger-soft-ink">{error}</p>
      )}
    </fieldset>
  );
}
