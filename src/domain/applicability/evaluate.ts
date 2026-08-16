// ============================================================
// src/domain/applicability/evaluate.ts
// COND-02 — o motor. Entrada (roteiro, contexto, respostas de roteamento),
// saída (aplicabilidade por seção, aplicabilidade por item, explicação, estado
// de validação).
//
// Determinístico: mesma entrada, mesma saída. Sem relógio, sem rede, sem random,
// sem estado global. A explicação não é extra — é o que responde "por que este
// item apareceu?" (contrato § 5 e § 6.7).
// ============================================================

import { CONTEXT_FIELDS, OPERATOR_LABELS, QUESTION_VALUE_TYPE, VALUELESS_OPERATORS, isAbsent, isUndeterminedAnswer } from './schema';
import type {
  ApplicabilityRule,
  ApplicabilityState,
  Condition,
  ConditionValue,
  ConditionalTemplate,
  ContextField,
  InspectionContext,
  RoutingAnswers,
  RoutingQuestion,
  Truth,
  ValueType,
} from './schema';
import { validateTemplateRules } from './validate';
import type { ValidationIssue } from './validate';
import { asArray, compareScalar, describeValue, equalScalar, normalizeText } from './values';

export type DecisionReason =
  | 'no_rule'
  | 'rule_satisfied'
  | 'rule_not_satisfied'
  | 'awaiting_answer'
  | 'declared_undetermined'
  | 'inherited'
  | 'rule_error';

export interface ConditionTrace {
  condition: Condition;
  truth: Truth;
  /** O que o motor leu do contexto ou da resposta, para a explicação. */
  observed: ConditionValue | null;
  text: string;
}

export interface ApplicabilityDecision {
  state: ApplicabilityState;
  reason: DecisionReason;
  /** Frase em pt-BR, pronta para a tela e para o relatório. */
  explanation: string;
  ruleId?: string;
  /** Id da seção de quem o item herdou o estado (contrato § 5.4). */
  inheritedFrom?: string;
  conditions: ConditionTrace[];
  /** Justificativas de "não foi possível determinar" (contrato § 6.4). */
  justifications?: string[];
}

export interface ApplicabilityResult {
  sections: Record<string, ApplicabilityDecision>;
  items: Record<string, ApplicabilityDecision>;
  validation: ValidationIssue[];
}

export interface ApplicabilityInput {
  template: ConditionalTemplate;
  /** Contexto congelado da inspeção. Nunca cadastro vivo (contrato § 4). */
  context?: InspectionContext;
  answers?: RoutingAnswers;
  /** Catálogo de campos de contexto. COND-05 estende sem tocar no motor. */
  contextFields?: ContextField[];
}

/** Sem regra = sempre aplicável (handoff, § Compatibilidade). */
function alwaysApplicable(): ApplicabilityDecision {
  return {
    state: 'aplicavel',
    reason: 'no_rule',
    explanation: 'Sempre aplicável: nenhuma condição configurada.',
    conditions: [],
  };
}

export function evaluateApplicability(input: ApplicabilityInput): ApplicabilityResult {
  const { template } = input;
  const context = input.context || {};
  const answers = input.answers || {};
  const contextFields = input.contextFields || CONTEXT_FIELDS;

  const validation = validateTemplateRules(template, contextFields);
  const brokenRuleIds = new Set<string>();
  const brokenTargetIds = new Set<string>();
  const brokenMessages = new Map<string, string>();
  for (const problem of validation) {
    if (!problem.disablesRule) continue;
    if (problem.ruleId) {
      brokenRuleIds.add(problem.ruleId);
      if (!brokenMessages.has(problem.ruleId)) brokenMessages.set(problem.ruleId, problem.message);
    }
    if (problem.targetId) {
      brokenTargetIds.add(problem.targetId);
      if (!brokenMessages.has(problem.targetId)) brokenMessages.set(problem.targetId, problem.message);
    }
  }

  const questionById = new Map((template.routingQuestions || []).map((q) => [q.id, q]));
  const fieldByKey = new Map(contextFields.map((f) => [f.key, f]));
  const ruleByTarget = new Map<string, ApplicabilityRule>();
  for (const rule of template.rules || []) {
    if (rule.target?.id) ruleByTarget.set(`${rule.target.type}:${rule.target.id}`, rule);
  }

  const decide = (targetType: 'section' | 'item', targetId: string): ApplicabilityDecision => {
    const rule = ruleByTarget.get(`${targetType}:${targetId}`);
    if (!rule) return alwaysApplicable();

    if (brokenRuleIds.has(rule.id) || brokenTargetIds.has(targetId)) {
      const detail = brokenMessages.get(rule.id) || brokenMessages.get(targetId) || 'regra inválida';
      // Contrato § 6.7 / regra inegociável 10: erro do motor nunca esconde
      // requisito. O alvo fica pendente e visível, com o erro na explicação.
      return {
        state: 'pendente_de_condicao',
        reason: 'rule_error',
        explanation: `Indeterminado: a regra tem erro de configuração — ${detail} O requisito continua visível.`,
        ruleId: rule.id,
        conditions: [],
      };
    }

    return decideByRule(rule, { context, answers, questionById, fieldByKey });
  };

  const sections: Record<string, ApplicabilityDecision> = {};
  const items: Record<string, ApplicabilityDecision> = {};

  for (const section of template.sections || []) {
    const sectionDecision = decide('section', section.id);
    sections[section.id] = sectionDecision;

    for (const item of section.items) {
      items[item.id] =
        sectionDecision.state === 'aplicavel'
          ? decide('item', item.id)
          : inherit(sectionDecision, section.id, section.title);
    }
  }

  return { sections, items, validation };
}

/**
 * Herança (contrato § 5.4): seção não aplicável arrasta seus itens, seção
 * pendente deixa seus itens pendentes — a regra própria do item nem chega a ser
 * consultada.
 */
function inherit(sectionDecision: ApplicabilityDecision, sectionId: string, title?: string): ApplicabilityDecision {
  const name = title ? `«${title}»` : `"${sectionId}"`;
  return {
    state: sectionDecision.state,
    reason: 'inherited',
    explanation:
      sectionDecision.state === 'nao_aplicavel_por_regra'
        ? `Não aplicável porque a seção ${name} não é aplicável. ${sectionDecision.explanation}`
        : `Pendente porque a seção ${name} está pendente. ${sectionDecision.explanation}`,
    ruleId: sectionDecision.ruleId,
    inheritedFrom: sectionId,
    conditions: sectionDecision.conditions,
    justifications: sectionDecision.justifications,
  };
}

interface EvaluationScope {
  context: InspectionContext;
  answers: RoutingAnswers;
  questionById: Map<string, RoutingQuestion>;
  fieldByKey: Map<string, ContextField>;
}

function decideByRule(rule: ApplicabilityRule, scope: EvaluationScope): ApplicabilityDecision {
  const traces = rule.expression.conditions.map((condition) => evaluateCondition(condition, scope));
  const combinator = rule.expression.combinator;

  // Curto-circuito resolve; a dúvida só sobrevive quando faz diferença
  // (contrato § 5.2).
  let truth: Truth;
  if (combinator === 'all') {
    truth = traces.some((t) => t.truth === 'false') ? 'false' : traces.some((t) => t.truth === 'unknown') ? 'unknown' : 'true';
  } else {
    truth = traces.some((t) => t.truth === 'true') ? 'true' : traces.some((t) => t.truth === 'unknown') ? 'unknown' : 'false';
  }

  const isElse = rule.branch === 'else';
  // O ramo alternativo é a condição complementar — e negar indeterminado
  // continua indeterminado, por isso "nem A nem B" enquanto a fonte não vier
  // (contrato § 5.3).
  const finalTruth: Truth = isElse && truth !== 'unknown' ? (truth === 'true' ? 'false' : 'true') : truth;

  const undetermined = traces.filter((t) => t.truth === 'unknown');
  const justifications = undetermined.map((t) => t.justification).filter((j): j is string => Boolean(j));
  const awaiting = undetermined.some((t) => !t.declared);

  const decision: ApplicabilityDecision = {
    state: stateOf(finalTruth),
    reason:
      finalTruth === 'unknown'
        ? awaiting
          ? 'awaiting_answer'
          : 'declared_undetermined'
        : finalTruth === 'true'
          ? 'rule_satisfied'
          : 'rule_not_satisfied',
    explanation: explain(finalTruth, truth, isElse, combinator, traces, awaiting, justifications),
    ruleId: rule.id,
    conditions: traces.map(({ condition, truth: conditionTruth, observed, text }) => ({ condition, truth: conditionTruth, observed, text })),
  };
  if (justifications.length > 0) decision.justifications = justifications;
  return decision;
}

function stateOf(truth: Truth): ApplicabilityState {
  if (truth === 'true') return 'aplicavel';
  if (truth === 'false') return 'nao_aplicavel_por_regra';
  return 'pendente_de_condicao';
}

interface InternalTrace extends ConditionTrace {
  declared: boolean;
  justification?: string;
}

function evaluateCondition(condition: Condition, scope: EvaluationScope): InternalTrace {
  const question = condition.source === 'question' ? scope.questionById.get(condition.field) : undefined;
  const field = condition.source === 'context' ? scope.fieldByKey.get(condition.field) : undefined;
  const type: ValueType | null = question ? QUESTION_VALUE_TYPE[question.type] : (field?.type ?? null);
  const label = question ? `«${question.text}»` : (field?.label ?? condition.field);

  const raw = condition.source === 'question' ? scope.answers[condition.field] : scope.context[condition.field];
  const declared = isUndeterminedAnswer(raw);
  const justification = declared ? raw.justification : undefined;
  const observed = (declared ? null : (raw as ConditionValue | null | undefined)) ?? null;

  const finish = (truth: Truth, note: string): InternalTrace => ({
    condition,
    truth,
    observed,
    text: `${label} ${OPERATOR_LABELS[condition.operator]}${VALUELESS_OPERATORS.includes(condition.operator) ? '' : ` ${describeValue(condition.value)}`} (${note})`,
    declared,
    justification,
  });

  const observedNote = condition.source === 'question' ? 'respondido' : 'valor';

  // `existe` / `não existe` resolvem sempre — nunca devolvem indeterminado
  // (contrato § 5.2, última linha da tabela).
  if (condition.operator === 'exists') return finish(isAbsent(observed) ? 'false' : 'true', `${observedNote}: ${describeValue(observed)}`);
  if (condition.operator === 'not_exists') return finish(isAbsent(observed) ? 'true' : 'false', `${observedNote}: ${describeValue(observed)}`);

  if (declared) return finish('unknown', justification ? `não foi possível determinar: ${justification}` : 'não foi possível determinar');
  if (isAbsent(observed)) return finish('unknown', condition.source === 'question' ? 'sem resposta' : 'dado ausente no contexto');
  if (!type) return finish('unknown', 'fonte desconhecida');

  // `isAbsent` já garantiu que há valor; o cast só existe porque ele não é type guard.
  const truth = compare(type, condition, observed as ConditionValue);
  return finish(truth, `${observedNote}: ${describeValue(observed)}`);
}

/**
 * Comparação por operador. Devolve `unknown` — nunca `false` — quando os valores
 * não são legíveis: erro técnico não pode virar conclusão sanitária.
 */
function compare(type: ValueType, condition: Condition, observed: ConditionValue): Truth {
  const value = condition.value;
  const negate = (truth: Truth): Truth => (truth === 'unknown' ? 'unknown' : truth === 'true' ? 'false' : 'true');

  switch (condition.operator) {
    case 'equals':
      return equalScalar(type, observed, value) ? 'true' : 'false';
    case 'not_equals':
      return negate(equalScalar(type, observed, value) ? 'true' : 'false');
    case 'contains':
      return containsValue(type, observed, value) ? 'true' : 'false';
    case 'not_contains':
      return negate(containsValue(type, observed, value) ? 'true' : 'false');
    case 'in_list':
      return matchesAny(type, observed, value) ? 'true' : 'false';
    case 'not_in_list':
      return negate(matchesAny(type, observed, value) ? 'true' : 'false');
    case 'greater':
    case 'greater_or_equal':
    case 'less':
    case 'less_or_equal': {
      const order = compareScalar(type, observed, value);
      if (order === null) return 'unknown';
      if (condition.operator === 'greater') return order > 0 ? 'true' : 'false';
      if (condition.operator === 'greater_or_equal') return order >= 0 ? 'true' : 'false';
      if (condition.operator === 'less') return order < 0 ? 'true' : 'false';
      return order <= 0 ? 'true' : 'false';
    }
    default:
      return 'unknown';
  }
}

/** `contém`: lista contém o valor; texto contém o trecho. */
function containsValue(type: ValueType, observed: ConditionValue, value: ConditionValue | undefined): boolean {
  if (value === undefined) return false;
  if (Array.isArray(observed)) return observed.some((entry) => equalScalar(type === 'text_list' ? 'text' : type, entry, value));
  return normalizeText(observed).includes(normalizeText(value));
}

/**
 * `pertence a lista`: valor escalar dentro da lista; fonte que já é lista casa
 * por interseção — que é exatamente o `applicableFoodTypes` de hoje
 * (`some(t => foodTypes.includes(t))`, templates.ts:418).
 */
function matchesAny(type: ValueType, observed: ConditionValue, value: ConditionValue | undefined): boolean {
  const candidates = asArray(value);
  const scalarType: ValueType = type === 'text_list' ? 'text' : type;
  const observedEntries = Array.isArray(observed) ? observed : [observed];
  return observedEntries.some((entry) => candidates.some((candidate) => equalScalar(scalarType, entry, candidate)));
}

function explain(
  finalTruth: Truth,
  baseTruth: Truth,
  isElse: boolean,
  combinator: 'all' | 'any',
  traces: InternalTrace[],
  awaiting: boolean,
  justifications: string[]
): string {
  const join = (list: InternalTrace[]) => list.map((t) => t.text).join(combinator === 'all' ? ' e ' : ' ou ');
  const branch = isElse ? 'Ramo alternativo: ' : '';

  if (finalTruth === 'unknown') {
    const pending = traces.filter((t) => t.truth === 'unknown');
    if (awaiting) return `${branch}Pendente de condição — falta resolver: ${join(pending)}.`;
    const why = justifications.length > 0 ? ` Justificativa: ${justifications.join(' | ')}` : '';
    return `${branch}Pendente de condição — marcado como "não foi possível determinar".${why}`;
  }

  // No ramo alternativo, a frase descreve a expressão do "se" e diz que ela caiu
  // do outro lado — é assim que a tela mostra o caminho alternativo.
  if (isElse) {
    const decisive = baseTruth === 'true' ? traces.filter((t) => t.truth === 'true') : traces.filter((t) => t.truth === 'false');
    const shown = decisive.length > 0 ? decisive : traces;
    return baseTruth === 'true'
      ? `${branch}não aplicável porque a condição do ramo principal foi satisfeita: ${join(shown)}.`
      : `${branch}aplicável porque a condição do ramo principal não foi satisfeita: ${join(shown)}.`;
  }

  if (finalTruth === 'true') {
    const decisive = combinator === 'any' ? traces.filter((t) => t.truth === 'true') : traces;
    return `Aplicável porque ${join(decisive)}.`;
  }

  const decisive = combinator === 'all' ? traces.filter((t) => t.truth === 'false') : traces;
  return `Não aplicável por regra porque ${join(decisive)}.`;
}
