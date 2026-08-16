// ============================================================
// src/domain/applicability
// COND-02 — motor de aplicabilidade: schema declarativo, avaliação pura e
// validador estrutural.
//
// Contrato normativo: docs/contrato-aplicabilidade.md
// Cenários: docs/gherkin/aplicabilidade.feature
//
// Uma implementação canônica só (handoff, regra inegociável 8): quem precisar
// decidir aplicabilidade — execução, resumo, PDF, plano de ação, simulador —
// chama `evaluateApplicability` daqui. Nada de um avaliador parecido do lado.
// ============================================================

export {
  CONTEXT_FIELDS,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  QUESTION_VALUE_TYPE,
  STATE_LABELS,
  VALUELESS_OPERATORS,
  LIST_VALUE_OPERATORS,
  isAbsent,
  isUndeterminedAnswer,
} from './schema';

export type {
  ApplicabilityRule,
  ApplicabilityState,
  Condition,
  ConditionGroup,
  ConditionOperator,
  ConditionValue,
  ConditionalSection,
  ConditionalTemplate,
  ContextField,
  InspectionContext,
  RoutingAnswer,
  RoutingAnswers,
  RoutingQuestion,
  RoutingQuestionOption,
  Truth,
  ValueType,
} from './schema';

export { evaluateApplicability } from './evaluate';
export type {
  ApplicabilityDecision,
  ApplicabilityInput,
  ApplicabilityResult,
  ConditionTrace,
  DecisionReason,
} from './evaluate';

export { validateTemplateRules } from './validate';
export type { ValidationCode, ValidationIssue } from './validate';
