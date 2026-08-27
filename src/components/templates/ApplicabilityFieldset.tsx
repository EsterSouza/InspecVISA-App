// ============================================================
// src/components/templates/ApplicabilityFieldset.tsx
// COND-06 — "( ) Sempre aplicável · ( ) Aplicável sob condição" de um alvo.
//
// O construtor de condição da tela. Ele não decide nada: quais operadores cabem,
// como a regra se lê em português e o que é lista vêm todos de
// `domain/applicability/authoring.ts`. Se a tela oferecer um operador que o
// validador recusa, o erro é lá, não aqui.
//
// Uma regra por alvo (o validador acusa `duplicate_rule_target`): "Sempre
// aplicável" é a **ausência** de regra, não uma regra que diz sim.
// ============================================================

import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Checkbox, Radio } from '../ui/Checkbox';
import {
  CONTEXT_FIELDS,
  OPERATOR_LABELS,
  describeRule,
  operatorFitsSource,
  operatorTakesList,
  operatorTakesValue,
  operatorsForSource,
  valueTypeForSource,
} from '../../domain/applicability';
import type {
  ApplicabilityRule,
  Condition,
  ConditionOperator,
  ConditionValue,
  RoutingQuestion,
} from '../../domain/applicability';

export interface ApplicabilityFieldsetProps {
  target: { type: 'section' | 'item'; id: string };
  /** "esta seção" · "este item" — entra na frase da opção de rádio. */
  targetLabel: string;
  rule?: ApplicabilityRule;
  questions: RoutingQuestion[];
  onChange: (rule: ApplicabilityRule | null) => void;
  /** Gerador de id do editor — o mesmo que nomeia seção e item novos. */
  makeId: () => string;
}

const SEM_FONTE = '';

/** Chave composta porque fonte e campo viajam juntos num `<select>` só. */
function chaveDaFonte(condition: Condition): string {
  return condition.field ? `${condition.source}:${condition.field}` : SEM_FONTE;
}

function lerChave(chave: string): { source: 'context' | 'question'; field: string } | null {
  const corte = chave.indexOf(':');
  if (corte < 0) return null;
  const source = chave.slice(0, corte);
  if (source !== 'context' && source !== 'question') return null;
  return { source, field: chave.slice(corte + 1) };
}

function condicaoVazia(): Condition {
  return { source: 'question', field: '', operator: 'equals' };
}

function regraNova(target: ApplicabilityFieldsetProps['target'], id: string): ApplicabilityRule {
  return {
    id,
    target,
    expression: { combinator: 'all', conditions: [condicaoVazia()] },
    branch: 'if',
  };
}

export function ApplicabilityFieldset({
  target,
  targetLabel,
  rule,
  questions,
  onChange,
  makeId,
}: ApplicabilityFieldsetProps) {
  const fontes = { routingQuestions: questions };
  const condicional = Boolean(rule);
  const conditions = rule?.expression?.conditions ?? [];

  const trocarCondicoes = (proximas: Condition[]) => {
    if (!rule) return;
    onChange({ ...rule, expression: { ...rule.expression, conditions: proximas } });
  };

  const atualizarCondicao = (indice: number, mudanca: Partial<Condition>) => {
    trocarCondicoes(conditions.map((c, i) => (i === indice ? { ...c, ...mudanca } : c)));
  };

  /**
   * Trocar a fonte pode invalidar o operador escolhido (texto não tem "maior
   * que"). Em vez de deixar regra impossível na tela, cai no primeiro operador
   * compatível — e o valor antigo sai junto, porque era do tipo anterior.
   */
  const trocarFonte = (indice: number, chave: string) => {
    const fonte = lerChave(chave);
    if (!fonte) {
      atualizarCondicao(indice, { field: '', value: undefined });
      return;
    }
    const atual = conditions[indice];
    const compativel = operatorFitsSource(atual.operator, fonte.source, fonte.field, fontes);
    const operator = compativel
      ? atual.operator
      : operatorsForSource(fonte.source, fonte.field, fontes)[0] ?? 'equals';
    atualizarCondicao(indice, { source: fonte.source, field: fonte.field, operator, value: undefined });
  };

  const trocarOperador = (indice: number, operator: ConditionOperator) => {
    const perdeValor = !operatorTakesValue(operator);
    const mudaForma = operatorTakesList(operator) !== operatorTakesList(conditions[indice].operator);
    atualizarCondicao(indice, {
      operator,
      ...(perdeValor || mudaForma ? { value: undefined } : {}),
    });
  };

  return (
    <div className="rounded-xl border border-default bg-surface-sunken/60 p-4 space-y-4">
      <div>
        <Label>Aplicabilidade</Label>
        <div className="mt-2 space-y-1.5">
          <Radio
            name={`aplicabilidade-${target.type}-${target.id}`}
            checked={!condicional}
            onChange={() => onChange(null)}
            label={`Sempre aplicável — ${targetLabel} aparece em toda inspeção`}
          />
          <Radio
            name={`aplicabilidade-${target.type}-${target.id}`}
            checked={condicional}
            onChange={() => onChange(regraNova(target, makeId()))}
            label={`Aplicável sob condição — ${targetLabel} só aparece quando a regra abaixo for verdadeira`}
          />
        </div>
      </div>

      {rule && (
        <div className="space-y-3 border-t border-default pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              size="sm"
              wrapperClassName="w-auto"
              aria-label="Sentido da condição"
              value={rule.branch === 'else' ? 'else' : 'if'}
              onChange={(e) => onChange({ ...rule, branch: e.target.value as 'if' | 'else' })}
            >
              <option value="if">Exibida quando…</option>
              <option value="else">Exibida quando NÃO…</option>
            </Select>

            {conditions.length > 1 && (
              <Select
                size="sm"
                wrapperClassName="w-auto"
                aria-label="Como as condições se combinam"
                value={rule.expression.combinator}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    expression: { ...rule.expression, combinator: e.target.value as 'all' | 'any' },
                  })
                }
              >
                <option value="all">TODAS as condições</option>
                <option value="any">QUALQUER condição</option>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            {conditions.map((condition, indice) => (
              <LinhaDeCondicao
                key={indice}
                condition={condition}
                questions={questions}
                podeRemover={conditions.length > 1}
                onFonte={(chave) => trocarFonte(indice, chave)}
                onOperador={(operator) => trocarOperador(indice, operator)}
                onValor={(value) => atualizarCondicao(indice, { value })}
                onRemover={() => trocarCondicoes(conditions.filter((_, i) => i !== indice))}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="border border-dashed border-default"
            onClick={() => trocarCondicoes([...conditions, condicaoVazia()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Condição
          </Button>

          {/* O resumo em linguagem humana que o card pede. Lê a regra como a
              consultora leria — nunca id, nunca `value` cru. */}
          <p className="flex items-start gap-2 rounded-lg bg-primary-50 p-3 text-xs text-accent-ink">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="font-medium">{describeRule(rule, fontes)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

interface LinhaProps {
  condition: Condition;
  questions: RoutingQuestion[];
  podeRemover: boolean;
  onFonte: (chave: string) => void;
  onOperador: (operator: ConditionOperator) => void;
  onValor: (value: ConditionValue | undefined) => void;
  onRemover: () => void;
}

function LinhaDeCondicao({
  condition,
  questions,
  podeRemover,
  onFonte,
  onOperador,
  onValor,
  onRemover,
}: LinhaProps) {
  const fontes = { routingQuestions: questions };
  const operadores = operatorsForSource(condition.source, condition.field, fontes);

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-default bg-surface p-2">
      <Select
        size="sm"
        wrapperClassName="min-w-[180px] flex-1"
        aria-label="Fonte da condição"
        value={chaveDaFonte(condition)}
        onChange={(e) => onFonte(e.target.value)}
      >
        <option value={SEM_FONTE}>Escolha a fonte…</option>
        {questions.filter((q) => !q.retiredAt).length > 0 && (
          <optgroup label="Perguntas de roteamento">
            {questions
              .filter((q) => !q.retiredAt)
              .map((q) => (
                <option key={q.id} value={`question:${q.id}`}>
                  {q.text}
                </option>
              ))}
          </optgroup>
        )}
        <optgroup label="Contexto da inspeção">
          {CONTEXT_FIELDS.map((field) => (
            <option key={field.key} value={`context:${field.key}`}>
              {field.label}
            </option>
          ))}
        </optgroup>
      </Select>

      <Select
        size="sm"
        wrapperClassName="min-w-[150px]"
        aria-label="Operador"
        value={condition.operator}
        disabled={operadores.length === 0}
        onChange={(e) => onOperador(e.target.value as ConditionOperator)}
      >
        {operadores.length === 0 ? (
          <option value={condition.operator}>{OPERATOR_LABELS[condition.operator]}</option>
        ) : (
          operadores.map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))
        )}
      </Select>

      <EditorDeValor condition={condition} questions={questions} onValor={onValor} />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-navy-3 hover:text-danger hover:bg-danger-soft disabled:opacity-30"
        disabled={!podeRemover}
        title={podeRemover ? 'Remover condição' : 'A regra precisa de pelo menos uma condição'}
        onClick={onRemover}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface ValorProps {
  condition: Condition;
  questions: RoutingQuestion[];
  onValor: (value: ConditionValue | undefined) => void;
}

/** Vírgula é o separador de lista digitada à mão. Vazio não vira item da lista. */
function lerLista(texto: string): string[] {
  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function EditorDeValor({ condition, questions, onValor }: ValorProps) {
  const fontes = { routingQuestions: questions };
  if (!condition.field) return null;
  if (!operatorTakesValue(condition.operator)) return null;

  const tipo = valueTypeForSource(condition.source, condition.field, fontes);
  const pergunta =
    condition.source === 'question' ? questions.find((q) => q.id === condition.field) : undefined;
  const opcoes = pergunta?.options ?? [];
  const emLista = operatorTakesList(condition.operator);

  // Pergunta com opção nunca vira campo livre: o valor guardado é o id da opção,
  // e digitar à mão é como nasce `unknown_option`.
  if (opcoes.length > 0) {
    if (emLista || pergunta?.type === 'multi_choice') {
      const marcados = Array.isArray(condition.value) ? condition.value.map(String) : [];
      return (
        <div className="flex min-w-[180px] flex-1 flex-wrap gap-x-4 gap-y-1 px-1 py-1">
          {opcoes.map((option) => (
            <Checkbox
              key={option.value}
              className="text-xs"
              checked={marcados.includes(option.value)}
              onChange={(e) =>
                onValor(
                  e.target.checked
                    ? [...marcados, option.value]
                    : marcados.filter((v) => v !== option.value)
                )
              }
              label={option.label}
            />
          ))}
        </div>
      );
    }
    return (
      <Select
        size="sm"
        wrapperClassName="min-w-[150px] flex-1"
        aria-label="Valor"
        value={typeof condition.value === 'string' ? condition.value : ''}
        onChange={(e) => onValor(e.target.value || undefined)}
      >
        <option value="">Escolha…</option>
        {opcoes.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  if (tipo === 'boolean') {
    return (
      <Select
        size="sm"
        wrapperClassName="min-w-[110px]"
        aria-label="Valor"
        value={condition.value === true ? 'sim' : condition.value === false ? 'nao' : ''}
        onChange={(e) => onValor(e.target.value === '' ? undefined : e.target.value === 'sim')}
      >
        <option value="">Escolha…</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </Select>
    );
  }

  if (emLista) {
    const texto = Array.isArray(condition.value) ? condition.value.join(', ') : '';
    return (
      <Input
        size="sm"
        className="min-w-[180px] flex-1"
        aria-label="Valores separados por vírgula"
        placeholder="RJ, SP, MG"
        value={texto}
        onChange={(e) => onValor(lerLista(e.target.value))}
      />
    );
  }

  if (tipo === 'number') {
    return (
      <Input
        size="sm"
        type="number"
        className="min-w-[110px]"
        aria-label="Valor"
        value={typeof condition.value === 'number' ? String(condition.value) : ''}
        onChange={(e) => onValor(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    );
  }

  return (
    <Input
      size="sm"
      type={tipo === 'date' ? 'date' : 'text'}
      className="min-w-[150px] flex-1"
      aria-label="Valor"
      value={typeof condition.value === 'string' ? condition.value : ''}
      onChange={(e) => onValor(e.target.value || undefined)}
    />
  );
}
