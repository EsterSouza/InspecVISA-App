// ============================================================
// src/domain/applicability/validate.ts
// COND-02 — validador estrutural do roteiro condicional.
//
// Roda sobre o roteiro sozinho: não depende de contexto nem de resposta. É o que
// o gate de publicação (COND-07) consulta, e é o que o motor consulta antes de
// avaliar — regra quebrada nunca esconde requisito (contrato § 6.7).
// ============================================================

import {
  CONTEXT_FIELDS,
  LIST_VALUE_OPERATORS,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  QUESTION_VALUE_TYPE,
  VALUELESS_OPERATORS,
} from './schema';
import { askAtOf } from './routing';
import type {
  ApplicabilityRule,
  Condition,
  ConditionalTemplate,
  ContextField,
  RoutingQuestion,
  ValueType,
} from './schema';
import { asArray, compareScalar, normalizeText, toNumber, toTimestamp } from './values';

export type ValidationCode =
  | 'duplicate_id'
  | 'rule_without_target'
  | 'unknown_target'
  | 'duplicate_rule_target'
  | 'empty_group'
  | 'unknown_context_field'
  | 'unknown_question'
  | 'incompatible_operator'
  | 'invalid_value'
  | 'unknown_option'
  | 'retired_question'
  | 'impossible_condition'
  | 'cycle'
  // ── COND-05 · perguntas de roteamento ──────────────────────
  | 'question_without_options'
  | 'invalid_option'
  | 'duplicate_option'
  | 'unused_question'
  | 'question_duplicates_context'
  | 'question_id_collides';

export interface ValidationIssue {
  code: ValidationCode;
  /** `error` reprova publicação (COND-07). `warning` só informa. */
  severity: 'error' | 'warning';
  /**
   * `true` quando a regra não tem como ser avaliada e o motor a trata como
   * quebrada — o alvo vai para `pendente_de_condicao`, visível, nunca oculto.
   * Erro que **não** desabilita é erro de curadoria (opção inexistente, condição
   * impossível, pergunta aposentada): a avaliação continua determinística, e
   * inspeção já criada segue rodando com a revisão congelada (contrato § 8, caso 14).
   */
  disablesRule: boolean;
  message: string;
  ruleId?: string;
  targetId?: string;
  questionId?: string;
  field?: string;
}

interface ResolvedSource {
  type: ValueType | null;
  question?: RoutingQuestion;
  label: string;
}

function issue(
  code: ValidationCode,
  severity: ValidationIssue['severity'],
  disablesRule: boolean,
  message: string,
  extra: Partial<ValidationIssue> = {}
): ValidationIssue {
  return { code, severity, disablesRule, message, ...extra };
}

function describeTarget(rule: ApplicabilityRule): string {
  return rule.target?.type === 'item' ? `item ${rule.target.id}` : `seção ${rule.target?.id}`;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      if (!repeated.includes(id)) repeated.push(id);
    } else {
      seen.add(id);
    }
  }
  return repeated;
}

/**
 * Valida o roteiro inteiro. A ordem da saída acompanha a ordem do roteiro — o
 * validador é determinístico como o motor.
 */
export function validateTemplateRules(
  template: ConditionalTemplate,
  contextFields: ContextField[] = CONTEXT_FIELDS
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sections = template.sections || [];
  const questions = template.routingQuestions || [];
  const rules = template.rules || [];

  const sectionIds = sections.map((s) => s.id);
  const itemIds = sections.flatMap((s) => s.items.map((i) => i.id));
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const fieldByKey = new Map(contextFields.map((f) => [f.key, f]));
  // ── ids duplicados ────────────────────────────────────────
  for (const [what, ids] of [
    ['Mais de uma seção', sectionIds],
    ['Mais de um item', itemIds],
    ['Mais de uma pergunta de roteamento', questions.map((q) => q.id)],
    ['Mais de uma regra', rules.map((r) => r.id)],
  ] as const) {
    // Não desabilita regra: com id repetido a avaliação ainda é determinística
    // (o último vence, como em qualquer mapa). O que não pode é publicar assim.
    for (const id of duplicates(ids)) {
      issues.push(issue('duplicate_id', 'error', false, `${what} com o id "${id}".`, { targetId: id }));
    }
  }

  // Alvo com mais de uma regra é ambíguo: nada define qual vale, então nenhuma vale.
  const targetKeys = rules.filter((r) => r.target?.id).map((r) => `${r.target.type}:${r.target.id}`);
  const ambiguousTargets = new Set(duplicates(targetKeys));
  for (const key of ambiguousTargets) {
    issues.push(
      issue('duplicate_rule_target', 'error', true, `O alvo "${key.split(':')[1]}" tem mais de uma regra. Um alvo tem no máximo uma regra — combine as condições em TODAS ou QUALQUER.`, {
        targetId: key.split(':')[1],
      })
    );
  }

  // ── as perguntas de roteamento em si (COND-05) ────────────
  const usedQuestionIds = new Set(
    rules.flatMap((rule) =>
      (rule.expression?.conditions || [])
        .filter((condition) => condition.source === 'question')
        .map((condition) => condition.field)
    )
  );
  issues.push(
    ...validateQuestions(questions, { contextFields, sectionIds, itemIds, usedQuestionIds, temRegras: rules.length > 0 })
  );

  for (const rule of rules) {
    issues.push(...validateRule(rule, { sectionIds, itemIds, questionById, fieldByKey, ambiguousTargets }));
  }

  issues.push(...detectCycles(rules, questionById));

  return issues;
}

/**
 * Perguntas cujo enunciado repete um dado que o cadastro já tem. Contrato § 4.1:
 * "pergunta de roteamento só existe para o que não dá para derivar do contexto
 * congelado" — se a consultora tiver que redigitar meia dúzia de coisas
 * conhecidas a cada inspeção, a feature morre por atrito.
 *
 * A lista é curada de propósito: casar por semelhança de texto acusaria pergunta
 * legítima. Só entra o que é, de fato, o mesmo dado do contexto.
 */
const CONTEXT_QUESTION_ALIASES: Record<string, string[]> = {
  uf: ['uf', 'estado', 'qual o estado', 'qual a uf', 'em que estado', 'estado do estabelecimento'],
  municipio: ['municipio', 'cidade', 'qual a cidade', 'qual o municipio', 'cidade do estabelecimento'],
  categoria: ['categoria', 'categoria do estabelecimento', 'tipo de estabelecimento', 'qual o tipo de estabelecimento'],
  tiposDeAlimento: ['tipo de alimento', 'tipos de alimento', 'que tipo de alimento', 'segmento de alimentos'],
  capacidadeIlpi: ['capacidade', 'capacidade da ilpi', 'qual a capacidade'],
  residentesTotal: ['total de residentes', 'quantos residentes', 'numero de residentes'],
  areaUtilM2: ['area util', 'qual a area util', 'metragem'],
};

interface QuestionScope {
  contextFields: ContextField[];
  sectionIds: string[];
  itemIds: string[];
  usedQuestionIds: Set<string>;
  temRegras: boolean;
}

function validateQuestions(questions: RoutingQuestion[], scope: QuestionScope): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const usaOpcoes = (question: RoutingQuestion) =>
    question.type === 'single_choice' || question.type === 'multi_choice';

  for (const question of questions) {
    const base = { questionId: question.id };
    const options = question.options || [];

    // ── opções estáveis ────────────────────────────────────
    if (usaOpcoes(question) && options.length === 0) {
      issues.push(
        issue('question_without_options', 'error', false, `A pergunta "${question.text}" é de escolha e não tem nenhuma opção configurada.`, base)
      );
    }
    if (!usaOpcoes(question) && options.length > 0) {
      issues.push(
        issue('invalid_option', 'error', false, `A pergunta "${question.text}" é do tipo ${question.type} e não deveria ter opções — opção só existe em escolha única ou múltipla.`, base)
      );
    }
    for (const option of options) {
      if (!option || normalizeText(option.value) === '') {
        issues.push(issue('invalid_option', 'error', false, `A pergunta "${question.text}" tem opção sem valor. O valor é o id estável da opção: a regra e a resposta guardam ele, nunca o rótulo.`, base));
      }
    }
    for (const repetida of duplicates(options.map((option) => normalizeText(option?.value)))) {
      if (repetida === '') continue;
      issues.push(issue('duplicate_option', 'error', false, `A pergunta "${question.text}" tem a opção "${repetida}" mais de uma vez. Valor de opção é id: repetido, a resposta fica ambígua.`, base));
    }

    // ── id de pergunta não colide com id de item/seção ─────
    // Resposta de roteamento e resposta sanitária vivem em lugares diferentes de
    // propósito (contrato § 3). Id igual ao de um item faria as duas se
    // confundirem justamente onde o contrato exige que nunca se misturem.
    if (scope.itemIds.includes(question.id) || scope.sectionIds.includes(question.id)) {
      issues.push(
        issue('question_id_collides', 'error', false, `A pergunta "${question.text}" usa o id "${question.id}", que já é de um item ou seção do roteiro. Pergunta de roteamento nunca compartilha id com requisito sanitário.`, base)
      );
    }

    // ── contrato § 4.1: não perguntar o que o sistema já sabe ─
    const enunciado = normalizeText((question.text || '').replace(/\?+\s*$/, ''));
    for (const field of scope.contextFields) {
      const aliases = [field.key, field.label, ...(CONTEXT_QUESTION_ALIASES[field.key] || [])];
      const repete =
        normalizeText(question.id) === normalizeText(field.key) ||
        aliases.some((alias) => normalizeText(alias) === enunciado);
      if (!repete) continue;
      issues.push(
        issue('question_duplicates_context', 'warning', false, `A pergunta "${question.text}" repete o dado "${field.label}", que já vem do cadastro no contexto congelado. Use uma condição de contexto sobre "${field.key}" em vez de perguntar de novo (contrato § 4.1).`, { ...base, field: field.key })
      );
      break;
    }

    // ── pergunta que ninguém usa ───────────────────────────
    // Só vale a pena avisar em roteiro que JÁ tem condição: roteiro sem regra
    // nenhuma não é pergunta órfã, é roteiro sem condicional — e rascunho com
    // pergunta criada antes da regra é trabalho em andamento, não erro.
    if (scope.temRegras && !question.retiredAt && !scope.usedQuestionIds.has(question.id)) {
      issues.push(
        issue('unused_question', 'warning', false, `Nenhuma condição usa a pergunta "${question.text}". Ela seria feita à consultora sem mudar nada no roteiro.`, base)
      );
    }
  }

  return issues;
}

interface RuleScope {
  sectionIds: string[];
  itemIds: string[];
  questionById: Map<string, RoutingQuestion>;
  fieldByKey: Map<string, ContextField>;
  ambiguousTargets: Set<string>;
}

function validateRule(rule: ApplicabilityRule, scope: RuleScope): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const base = { ruleId: rule.id, targetId: rule.target?.id };

  if (!rule.target || !rule.target.id) {
    issues.push(issue('rule_without_target', 'error', true, `A regra "${rule.id}" não aponta para nenhuma seção ou item.`, { ruleId: rule.id }));
  } else {
    const known = rule.target.type === 'item' ? scope.itemIds : scope.sectionIds;
    if (!known.includes(rule.target.id)) {
      issues.push(issue('unknown_target', 'error', true, `A regra "${rule.id}" aponta para ${describeTarget(rule)}, que não existe neste roteiro.`, base));
    }
  }

  const conditions = rule.expression?.conditions || [];
  if (conditions.length === 0) {
    issues.push(issue('empty_group', 'error', true, `A regra "${rule.id}" não tem nenhuma condição. Grupo vazio é erro, não "sempre verdadeiro".`, base));
    return issues;
  }

  const sourceTypes: (ValueType | null)[] = [];
  for (const condition of conditions) {
    const resolved = resolveSource(condition, scope);
    sourceTypes.push(resolved.type);

    if (condition.source === 'context' && resolved.type === null) {
      issues.push(issue('unknown_context_field', 'error', true, `A regra "${rule.id}" usa o dado de contexto "${condition.field}", que não existe.`, { ...base, field: condition.field }));
      continue;
    }
    if (condition.source === 'question' && resolved.type === null) {
      issues.push(issue('unknown_question', 'error', true, `A regra "${rule.id}" depende da pergunta "${condition.field}", que não existe neste roteiro.`, { ...base, questionId: condition.field }));
      continue;
    }

    const type = resolved.type as ValueType;
    if (!OPERATORS_BY_TYPE[type].includes(condition.operator)) {
      issues.push(
        issue('incompatible_operator', 'error', true, `Em "${rule.id}", ${resolved.label} é do tipo ${type} e não aceita o operador "${OPERATOR_LABELS[condition.operator]}".`, {
          ...base,
          field: condition.field,
        })
      );
      continue;
    }

    issues.push(...validateValue(rule, condition, type, resolved, base));

    if (resolved.question?.retiredAt) {
      issues.push(
        issue('retired_question', 'error', false, `A regra "${rule.id}" depende da pergunta "${resolved.question.text}", que está aposentada.`, {
          ...base,
          questionId: resolved.question.id,
        })
      );
    }
  }

  if (rule.expression.combinator === 'all') {
    issues.push(...detectImpossible(rule, conditions, sourceTypes, base));
  }

  return issues;
}

function resolveSource(condition: Condition, scope: RuleScope): ResolvedSource {
  if (condition.source === 'question') {
    const question = scope.questionById.get(condition.field);
    if (!question) return { type: null, label: `a pergunta "${condition.field}"` };
    return { type: QUESTION_VALUE_TYPE[question.type], question, label: `a pergunta "${question.text}"` };
  }
  const field = scope.fieldByKey.get(condition.field);
  if (!field) return { type: null, label: `o dado "${condition.field}"` };
  return { type: field.type, label: `o dado "${field.label}"` };
}

function validateValue(
  rule: ApplicabilityRule,
  condition: Condition,
  type: ValueType,
  resolved: ResolvedSource,
  base: Partial<ValidationIssue>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const where = `Em "${rule.id}", ${resolved.label}`;

  if (VALUELESS_OPERATORS.includes(condition.operator)) {
    if (condition.value !== undefined) {
      issues.push(issue('invalid_value', 'error', true, `${where}: o operador "${OPERATOR_LABELS[condition.operator]}" não recebe valor.`, { ...base, field: condition.field }));
    }
    return issues;
  }

  if (condition.value === undefined || condition.value === null) {
    issues.push(issue('invalid_value', 'error', true, `${where}: falta o valor de comparação.`, { ...base, field: condition.field }));
    return issues;
  }

  if (LIST_VALUE_OPERATORS.includes(condition.operator)) {
    if (!Array.isArray(condition.value) || condition.value.length === 0) {
      issues.push(issue('invalid_value', 'error', true, `${where}: o operador "${OPERATOR_LABELS[condition.operator]}" precisa de uma lista com pelo menos um valor.`, { ...base, field: condition.field }));
      return issues;
    }
  } else if (Array.isArray(condition.value)) {
    issues.push(issue('invalid_value', 'error', true, `${where}: o operador "${OPERATOR_LABELS[condition.operator]}" compara com um valor só, não com uma lista.`, { ...base, field: condition.field }));
    return issues;
  }

  const values = asArray(condition.value);
  const badType = values.some((value) => {
    if (type === 'number') return toNumber(value) === null;
    if (type === 'date') return toTimestamp(value) === null;
    if (type === 'boolean') return typeof condition.value !== 'boolean';
    return typeof value !== 'string' && typeof value !== 'number';
  });
  if (badType) {
    issues.push(issue('invalid_value', 'error', true, `${where}: o valor não é compatível com o tipo ${type}.`, { ...base, field: condition.field }));
    return issues;
  }

  // Opção que não existe mais na pergunta: a condição continua avaliável (dá
  // falso, sempre), mas o roteiro não pode ser publicado assim.
  const options = resolved.question?.options;
  if (options && options.length > 0) {
    const known = options.map((option) => normalizeText(option.value));
    for (const value of values) {
      if (!known.includes(normalizeText(value))) {
        issues.push(
          issue('unknown_option', 'error', false, `${where}: a opção "${value}" não existe na pergunta.`, {
            ...base,
            questionId: resolved.question?.id,
          })
        );
      }
    }
  }

  return issues;
}

/**
 * Condição impossível dentro de um grupo TODAS: duas condições sobre a mesma
 * fonte que nunca podem valer juntas. Detecta os pares que aparecem de verdade
 * num editor visual; não é um SAT solver.
 */
function detectImpossible(
  rule: ApplicabilityRule,
  conditions: Condition[],
  types: (ValueType | null)[],
  base: Partial<ValidationIssue>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let a = 0; a < conditions.length; a += 1) {
    for (let b = a + 1; b < conditions.length; b += 1) {
      const left = conditions[a];
      const right = conditions[b];
      const type = types[a];
      if (!type || types[b] !== type) continue;
      if (left.source !== right.source || left.field !== right.field) continue;
      if (contradicts(left, right, type) || contradicts(right, left, type)) {
        issues.push(
          issue('impossible_condition', 'error', false, `Na regra "${rule.id}", duas condições sobre "${left.field}" nunca podem ser verdadeiras ao mesmo tempo — o alvo nunca seria aplicável.`, {
            ...base,
            field: left.field,
          })
        );
      }
    }
  }

  return issues;
}

function contradicts(left: Condition, right: Condition, type: ValueType): boolean {
  const leftValues = asArray(left.value).map((v) => normalizeText(v));
  const rightValues = asArray(right.value).map((v) => normalizeText(v));
  const sameValue = leftValues.length === 1 && rightValues.length === 1 && leftValues[0] === rightValues[0];

  if (left.operator === 'exists' && right.operator === 'not_exists') return true;
  if (left.operator === 'equals' && right.operator === 'equals') return !sameValue;
  if (left.operator === 'equals' && right.operator === 'not_equals') return sameValue;
  if (left.operator === 'contains' && right.operator === 'not_contains') return sameValue;
  if (left.operator === 'equals' && right.operator === 'in_list') return !rightValues.includes(leftValues[0]);
  if (left.operator === 'equals' && right.operator === 'not_in_list') return rightValues.includes(leftValues[0]);
  if (left.operator === 'in_list' && right.operator === 'in_list') {
    return !leftValues.some((value) => rightValues.includes(value));
  }
  if (left.operator === 'in_list' && right.operator === 'not_in_list') {
    return leftValues.every((value) => rightValues.includes(value));
  }

  // Faixas numéricas / de data sem interseção: (> a) contra (< b) com a >= b.
  const lowerBound = left.operator === 'greater' || left.operator === 'greater_or_equal';
  const upperBound = right.operator === 'less' || right.operator === 'less_or_equal';
  if (lowerBound && upperBound) {
    const order = compareScalar(type, left.value, right.value);
    if (order === null) return false;
    const strict = left.operator === 'greater' || right.operator === 'less';
    return order > 0 || (order === 0 && strict);
  }

  return false;
}

/**
 * Ciclo (contrato § 8, caso 15). O grafo é entre **seções**: uma seção só pode
 * depender de pergunta que more em outra seção já resolvida. Regra de item não
 * cria aresta — a aplicabilidade de um item não decide se a seção aparece, então
 * item que depende de pergunta irmã é legítimo, não ciclo.
 *
 * Seção que depende de pergunta de dentro dela mesma é laço curto: para responder
 * a pergunta ela precisaria já estar aplicável.
 */
function detectCycles(rules: ApplicabilityRule[], questionById: Map<string, RoutingQuestion>): ValidationIssue[] {
  const edges = new Map<string, { to: string; ruleId: string }[]>();

  for (const rule of rules) {
    if (rule.target?.type !== 'section') continue;
    const from = rule.target.id;
    for (const condition of rule.expression?.conditions || []) {
      if (condition.source !== 'question') continue;
      const question = questionById.get(condition.field);
      // Pergunta do wizard é respondida antes de a inspeção existir: ela não
      // pode participar de ciclo, mesmo que alguém tenha deixado um `sectionId`
      // sobrando nela (COND-05).
      if (!question || askAtOf(question) === 'wizard') continue;
      const owner = question.sectionId;
      if (!owner) continue;
      const list = edges.get(from) || [];
      list.push({ to: owner, ruleId: rule.id });
      edges.set(from, list);
    }
  }

  const issues: ValidationIssue[] = [];
  const reported = new Set<string>();
  const visiting = new Set<string>();
  const done = new Set<string>();
  const path: string[] = [];

  const walk = (node: string): void => {
    visiting.add(node);
    path.push(node);
    for (const edge of edges.get(node) || []) {
      if (visiting.has(edge.to)) {
        const cycle = [...path.slice(path.indexOf(edge.to)), edge.to];
        const key = cycle.join('>');
        if (!reported.has(key)) {
          reported.add(key);
          // Uma ocorrência por seção do ciclo: todas ficam sem regra avaliável,
          // e o editor mostra o caminho inteiro na mensagem.
          for (const member of cycle.slice(0, -1)) {
            issues.push(
              issue('cycle', 'error', true, `Dependência circular entre seções: ${cycle.join(' → ')}.`, {
                ruleId: member === node ? edge.ruleId : undefined,
                targetId: member,
              })
            );
          }
        }
      } else if (!done.has(edge.to)) {
        walk(edge.to);
      }
    }
    path.pop();
    visiting.delete(node);
    done.add(node);
  };

  for (const from of edges.keys()) {
    if (!done.has(from)) walk(from);
  }

  return issues;
}
