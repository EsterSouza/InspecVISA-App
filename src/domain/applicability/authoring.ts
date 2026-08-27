// ============================================================
// src/domain/applicability/authoring.ts
// COND-06 — o que o editor precisa saber para mexer em regra sem quebrar nada.
//
// Puro como o resto do pacote: sem React, sem banco, sem rede, sem relógio.
// Nada aqui decide aplicabilidade — para isso existe `evaluateApplicability`, e
// só ele (handoff, regra inegociável 8). Este arquivo responde outras três
// perguntas, todas do editor:
//
//   1. **Como se lê esta regra?** — o resumo em linguagem humana que o card pede
//      ("Exibida quando 'Realiza processamento de artigos?' é igual a Sim").
//   2. **Quem depende disto?** — a lista que sustenta as travas do ciclo de vida:
//      aposentar pergunta controladora e excluir opção referenciada são
//      **bloqueadas**, não avisadas.
//   3. **O que a cópia leva junto?** — duplicar roteiro ou seção recria as
//      referências internas; a cópia nunca aponta para id do original.
//
// O critério de aceite do card é uma frase só: **nenhuma operação do editor
// produz referência órfã em silêncio**. Por isso toda função daqui que remove
// alguma coisa devolve o que seria arrastado junto, em vez de arrastar calada.
// ============================================================

import {
  CONTEXT_FIELDS,
  LIST_VALUE_OPERATORS,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  QUESTION_VALUE_TYPE,
  VALUELESS_OPERATORS,
} from './schema';
import { normalizeText } from './values';
import type {
  ApplicabilityRule,
  Condition,
  ConditionOperator,
  ConditionValue,
  ConditionalTemplate,
  ContextField,
  RoutingQuestion,
  ValueType,
} from './schema';

/** De onde os rótulos saem. O catálogo de contexto é parâmetro, como no resto do pacote. */
export interface AuthoringSources {
  routingQuestions?: RoutingQuestion[];
  contextFields?: ContextField[];
}

/**
 * Marcador de fonte que não existe mais. Aparece no resumo em vez de sumir: um
 * resumo que esconde a referência quebrada é pior que nenhum resumo.
 */
export const FONTE_DESCONHECIDA = 'referência quebrada';

function findQuestion(sources: AuthoringSources, id: string): RoutingQuestion | undefined {
  return (sources.routingQuestions || []).find((question) => question.id === id);
}

function findContextField(sources: AuthoringSources, key: string): ContextField | undefined {
  return (sources.contextFields || CONTEXT_FIELDS).find((field) => field.key === key);
}

/** Rótulo da opção, nunca o `value` cru — mesma regra de `describeRoutingAnswer`. */
function optionLabel(question: RoutingQuestion | undefined, value: string | number): string {
  const option = (question?.options || []).find(
    (candidate) => normalizeText(candidate.value) === normalizeText(value)
  );
  return option ? option.label : String(value);
}

function describeValue(value: ConditionValue | undefined, question?: RoutingQuestion): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map((entry) => optionLabel(question, entry)).join(', ');
  if (typeof value === 'number') return String(value);
  return optionLabel(question, value);
}

/** "Realiza processamento de artigos? é igual a Sim" — uma condição, por extenso. */
export function describeCondition(condition: Condition, sources: AuthoringSources = {}): string {
  const question = condition.source === 'question' ? findQuestion(sources, condition.field) : undefined;
  const field = condition.source === 'context' ? findContextField(sources, condition.field) : undefined;

  const rotulo =
    condition.source === 'question'
      ? question
        ? question.text
        : `${FONTE_DESCONHECIDA} (${condition.field})`
      : field
        ? field.label
        : `${FONTE_DESCONHECIDA} (${condition.field})`;

  const operador = OPERATOR_LABELS[condition.operator] || condition.operator;
  if (VALUELESS_OPERATORS.includes(condition.operator)) return `${rotulo} ${operador}`;

  const valor = describeValue(condition.value, question);
  if (!valor) return `${rotulo} ${operador} (valor em branco)`;
  return `${rotulo} ${operador} ${valor}`;
}

/**
 * "Exibida quando A e B" — a regra inteira, do jeito que a consultora lê.
 *
 * `branch: 'else'` é o caminho complementar do contrato § 5.3, e a frase precisa
 * dizer isso: **"Exibida quando não for o caso: …"**. Indeterminado continua
 * indeterminado nos dois lados — o resumo nunca promete que o else "pega o resto".
 */
export function describeRule(rule: ApplicabilityRule, sources: AuthoringSources = {}): string {
  const conditions = rule.expression?.conditions || [];
  if (conditions.length === 0) return 'Sempre aplicável (regra sem condição)';

  const cola = rule.expression.combinator === 'any' ? ' ou ' : ' e ';
  const corpo = conditions.map((condition) => describeCondition(condition, sources)).join(cola);

  return rule.branch === 'else' ? `Exibida quando não for o caso: ${corpo}` : `Exibida quando ${corpo}`;
}

// ── O que o construtor de condição pode oferecer ─────────────

/**
 * O tipo do que está sendo comparado. É o que decide quais operadores aparecem
 * na tela: o card pede "operador **compatível com o tipo**", e a lista da tela
 * tem que ser a mesma que o validador cobra depois (`incompatible_operator`).
 */
export function valueTypeForSource(
  source: 'context' | 'question',
  field: string,
  sources: AuthoringSources = {}
): ValueType | null {
  if (source === 'question') {
    const question = findQuestion(sources, field);
    return question ? QUESTION_VALUE_TYPE[question.type] : null;
  }
  return findContextField(sources, field)?.type ?? null;
}

/** Os operadores que aquela fonte aceita. Fonte desconhecida não oferece nenhum. */
export function operatorsForSource(
  source: 'context' | 'question',
  field: string,
  sources: AuthoringSources = {}
): ConditionOperator[] {
  const tipo = valueTypeForSource(source, field, sources);
  return tipo ? OPERATORS_BY_TYPE[tipo] : [];
}

/** Um operador ainda serve depois de trocar a fonte? Evita deixar regra inválida na tela. */
export function operatorFitsSource(
  operator: ConditionOperator,
  source: 'context' | 'question',
  field: string,
  sources: AuthoringSources = {}
): boolean {
  return operatorsForSource(source, field, sources).includes(operator);
}

/** Este operador dispensa valor? A tela esconde o campo de valor quando dispensa. */
export function operatorTakesValue(operator: ConditionOperator): boolean {
  return !VALUELESS_OPERATORS.includes(operator);
}

/** Este operador quer uma lista? A tela mostra seleção múltipla quando quer. */
export function operatorTakesList(operator: ConditionOperator): boolean {
  return LIST_VALUE_OPERATORS.includes(operator);
}

// ── Quem depende de quem ─────────────────────────────────────

function conditionsOf(rule: ApplicabilityRule): Condition[] {
  return rule.expression?.conditions || [];
}

/** Regras que leem uma pergunta de roteamento. Base das travas do ciclo de vida. */
export function rulesUsingQuestion(
  template: Pick<ConditionalTemplate, 'rules'>,
  questionId: string
): ApplicabilityRule[] {
  return (template.rules || []).filter((rule) =>
    conditionsOf(rule).some((condition) => condition.source === 'question' && condition.field === questionId)
  );
}

/**
 * Regras que citam **uma opção** daquela pergunta. Compara normalizado, como o
 * motor compara: opção citada com caixa diferente continua sendo citada.
 */
export function rulesUsingOption(
  template: Pick<ConditionalTemplate, 'rules'>,
  questionId: string,
  optionValue: string
): ApplicabilityRule[] {
  const alvo = normalizeText(optionValue);
  return (template.rules || []).filter((rule) =>
    conditionsOf(rule).some((condition) => {
      if (condition.source !== 'question' || condition.field !== questionId) return false;
      if (condition.value === undefined || condition.value === null) return false;
      const valores = Array.isArray(condition.value) ? condition.value : [condition.value];
      return valores.some((entry) => normalizeText(entry) === alvo);
    })
  );
}

/** Regras cujo alvo é esta seção ou este item. */
export function rulesTargeting(
  template: Pick<ConditionalTemplate, 'rules'>,
  targetType: 'section' | 'item',
  targetId: string
): ApplicabilityRule[] {
  return (template.rules || []).filter(
    (rule) => rule.target?.type === targetType && rule.target?.id === targetId
  );
}

/** Resultado de uma trava: `allowed: false` **bloqueia** a operação, não avisa. */
export interface AuthoringGuard {
  allowed: boolean;
  /** Frase pronta para a tela. Vazia quando `allowed`. */
  reason: string;
  /** As regras que seguram a operação — o editor lista para a consultora ir até elas. */
  blockingRules: ApplicabilityRule[];
}

const LIBERADO: AuthoringGuard = { allowed: true, reason: '', blockingRules: [] };

function concordar(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/**
 * Aposentar pergunta controladora — **bloqueada enquanto houver dependente**
 * (estende o "Aposentar" do FE-17b). Aposentar a pergunta deixaria a regra
 * apontando para pergunta que ninguém responde mais: o alvo cairia em
 * `pendente_de_condicao` para sempre, sem ninguém entender por quê.
 */
export function canRetireQuestion(
  template: Pick<ConditionalTemplate, 'rules'>,
  questionId: string
): AuthoringGuard {
  const dependentes = rulesUsingQuestion(template, questionId);
  if (dependentes.length === 0) return LIBERADO;
  return {
    allowed: false,
    reason:
      `Esta pergunta é usada por ${dependentes.length} ` +
      `${concordar(dependentes.length, 'regra', 'regras')}. ` +
      `Remova ${concordar(dependentes.length, 'a regra', 'as regras')} antes de aposentá-la.`,
    blockingRules: dependentes,
  };
}

/**
 * Excluir opção referenciada por regra — **bloqueada**. Sem isto a regra passa a
 * citar opção que não existe: `unknown_option` no validador, e a consultora só
 * descobre na hora de publicar.
 */
export function canRemoveOption(
  template: Pick<ConditionalTemplate, 'rules'>,
  questionId: string,
  optionValue: string
): AuthoringGuard {
  const dependentes = rulesUsingOption(template, questionId, optionValue);
  if (dependentes.length === 0) return LIBERADO;
  return {
    allowed: false,
    reason:
      `Esta opção é citada por ${dependentes.length} ` +
      `${concordar(dependentes.length, 'regra', 'regras')}. ` +
      `Ajuste ${concordar(dependentes.length, 'a regra', 'as regras')} antes de excluí-la.`,
    blockingRules: dependentes,
  };
}

/**
 * O que cai junto ao remover seções/itens. Não bloqueia — remover item é
 * operação legítima do editor — mas devolve as regras que ficariam órfãs para o
 * editor **dizer isso antes**, que é o aceite do card.
 */
export function rulesOrphanedBy(
  template: Pick<ConditionalTemplate, 'rules'>,
  removed: { sections?: string[]; items?: string[] }
): ApplicabilityRule[] {
  const secoes = new Set(removed.sections || []);
  const itens = new Set(removed.items || []);
  return (template.rules || []).filter((rule) => {
    if (!rule.target?.id) return false;
    return rule.target.type === 'section' ? secoes.has(rule.target.id) : itens.has(rule.target.id);
  });
}

// ── Duplicar sem herdar id ───────────────────────────────────

export interface CloneIdMap {
  sections: Record<string, string>;
  items: Record<string, string>;
  questions: Record<string, string>;
}

/** Quem gera id novo. Injetado para o teste ser determinístico — e o domínio, puro. */
export type MakeId = (kind: 'section' | 'item' | 'question' | 'rule', originalId: string) => string;

interface CloneInput<I extends { id: string }, S extends { id: string; items: I[] }> {
  sections: S[];
  rules?: ApplicabilityRule[];
  routingQuestions?: RoutingQuestion[];
}

function remapRule(rule: ApplicabilityRule, idMap: CloneIdMap, makeId: MakeId): ApplicabilityRule {
  const alvoMapeado =
    rule.target?.type === 'section' ? idMap.sections[rule.target.id] : idMap.items[rule.target?.id || ''];

  return {
    ...rule,
    id: makeId('rule', rule.id),
    target: { ...rule.target, id: alvoMapeado ?? rule.target.id },
    expression: {
      ...rule.expression,
      conditions: conditionsOf(rule).map((condition) =>
        condition.source === 'question' && idMap.questions[condition.field]
          ? { ...condition, field: idMap.questions[condition.field] }
          : { ...condition }
      ),
    },
  };
}

/**
 * Duplicar **roteiro**: seção, item, pergunta e regra ganham id novo, e toda
 * referência interna é reescrita para o id novo. A cópia não compartilha nenhum
 * id com o original — é o que impede editar a cópia e mexer no que já está em
 * inspeção.
 */
export function cloneTemplateForDuplicate<I extends { id: string }, S extends { id: string; items: I[] }>(
  input: CloneInput<I, S>,
  makeId: MakeId
): { sections: S[]; rules: ApplicabilityRule[]; routingQuestions: RoutingQuestion[]; idMap: CloneIdMap } {
  const idMap: CloneIdMap = { sections: {}, items: {}, questions: {} };

  for (const section of input.sections) {
    idMap.sections[section.id] = makeId('section', section.id);
    for (const item of section.items || []) idMap.items[item.id] = makeId('item', item.id);
  }
  for (const question of input.routingQuestions || []) {
    idMap.questions[question.id] = makeId('question', question.id);
  }

  const sections = input.sections.map((section) => ({
    ...section,
    id: idMap.sections[section.id],
    items: (section.items || []).map((item) => ({ ...item, id: idMap.items[item.id] })),
  })) as S[];

  const routingQuestions = (input.routingQuestions || []).map((question) => ({
    ...question,
    id: idMap.questions[question.id],
    ...(question.sectionId && idMap.sections[question.sectionId]
      ? { sectionId: idMap.sections[question.sectionId] }
      : {}),
  }));

  const rules = (input.rules || []).map((rule) => remapRule(rule, idMap, makeId));

  return { sections, rules, routingQuestions, idMap };
}

/**
 * Duplicar **seção**: só a seção, seus itens e as regras que miram dentro dela.
 *
 * As perguntas continuam sendo do roteiro e não são clonadas — a cópia lê as
 * mesmas perguntas, que continuam existindo. O que nunca acontece é a cópia
 * herdar id de item ou de seção do original.
 */
export function cloneSectionForDuplicate<I extends { id: string }, S extends { id: string; items: I[] }>(
  input: CloneInput<I, S>,
  sectionId: string,
  makeId: MakeId
): { section: S | null; rules: ApplicabilityRule[]; idMap: CloneIdMap } {
  const original = input.sections.find((section) => section.id === sectionId);
  if (!original) return { section: null, rules: [], idMap: { sections: {}, items: {}, questions: {} } };

  const idMap: CloneIdMap = { sections: {}, items: {}, questions: {} };
  idMap.sections[original.id] = makeId('section', original.id);
  for (const item of original.items || []) idMap.items[item.id] = makeId('item', item.id);

  const section = {
    ...original,
    id: idMap.sections[original.id],
    items: (original.items || []).map((item) => ({ ...item, id: idMap.items[item.id] })),
  } as S;

  const dentro = (rule: ApplicabilityRule) =>
    rule.target?.type === 'section'
      ? rule.target.id === original.id
      : Boolean(idMap.items[rule.target?.id || '']);

  const rules = (input.rules || []).filter(dentro).map((rule) => remapRule(rule, idMap, makeId));

  return { section, rules, idMap };
}
