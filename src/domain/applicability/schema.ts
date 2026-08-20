// ============================================================
// src/domain/applicability/schema.ts
// COND-02 — o schema declarativo do motor de aplicabilidade.
//
// Normativo: docs/contrato-aplicabilidade.md. Onde este arquivo divergir do
// contrato, este arquivo está errado.
//
// Pacote de domínio PURO: nada aqui pode importar React, Supabase, Dexie, rede
// nem ler o relógio. A única dependência é `utils/state`, que é string pura.
// ============================================================

// ── Os três estados (contrato § 2) ───────────────────────────
// Literais em português porque são normativos: o contrato os nomeia assim, e
// eles vão aparecer em snapshot, log e explicação.
export type ApplicabilityState =
  | 'aplicavel'
  | 'nao_aplicavel_por_regra'
  | 'pendente_de_condicao';

/**
 * Verdade de uma condição. `unknown` é indeterminado — e indeterminado **não é
 * falso** (contrato § 5.2). É a regra que impede "pergunta sem resposta" de
 * virar "não se aplica".
 */
export type Truth = 'true' | 'false' | 'unknown';

// ── Tipos de valor ───────────────────────────────────────────
// `date` guarda ISO-8601 em texto; compara por Date.parse, nunca pelo relógio.
export type ValueType = 'text' | 'number' | 'boolean' | 'text_list' | 'date';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater'
  | 'greater_or_equal'
  | 'less'
  | 'less_or_equal'
  | 'exists'
  | 'not_exists'
  | 'in_list'
  | 'not_in_list';

export type ConditionValue = string | number | boolean | Array<string | number>;

/**
 * Uma condição: fonte + campo/pergunta (por **id**) + operador + valor.
 * Generalização de `section.applicableFoodTypes`, que já era isto em miniatura
 * (docs/mapa-roteiro-inspecao.md, regra 3).
 *
 * `field` é a chave do contexto congelado quando `source = 'context'`, e o **id**
 * da pergunta de roteamento quando `source = 'question'`. Nunca é texto de
 * pergunta: mudar a redação não pode quebrar regra (handoff, regra 4).
 */
export interface Condition {
  source: 'context' | 'question';
  field: string;
  operator: ConditionOperator;
  value?: ConditionValue;
}

/** Grupo de condições. Sem aninhamento nesta versão — TODAS ou QUALQUER, um nível. */
export interface ConditionGroup {
  combinator: 'all' | 'any';
  conditions: Condition[];
}

/**
 * Regra = alvo + expressão.
 *
 * `branch: 'else'` é o caminho alternativo do contrato § 5.3: internamente é a
 * condição complementar (nega verdadeiro↔falso), e **indeterminado continua
 * indeterminado** — nunca "cai no else por padrão".
 */
export interface ApplicabilityRule {
  id: string;
  target: { type: 'section' | 'item'; id: string };
  expression: ConditionGroup;
  branch?: 'if' | 'else';
}

export interface RoutingQuestionOption {
  /** Id estável da opção. É o que a regra e a resposta guardam — nunca o rótulo. */
  value: string;
  label: string;
}

/**
 * Onde a pergunta de roteamento é respondida (COND-05).
 *
 * `wizard` — na criação da inspeção, quando o dado é conhecido antes de ir a
 * campo. `execution` — em campo, quando só lá se sabe.
 */
export type RoutingScope = 'wizard' | 'execution';

/**
 * Pergunta de roteamento (contrato § 3): existe só para decidir aplicabilidade.
 * Nunca pesa, nunca é NC, nunca gera pendência. Texto livre não é fonte de
 * condição nesta versão — por isso não há tipo `text`.
 */
export interface RoutingQuestion {
  id: string;
  text: string;
  type: 'boolean' | 'single_choice' | 'multi_choice' | 'number';
  options?: RoutingQuestionOption[];
  /**
   * Onde a pergunta é respondida (COND-05). Ausente ou ilegível vale
   * `execution`: o lado conservador é perguntar em campo, nunca deixar de
   * perguntar. Use `askAtOf()` — nada lê este campo cru.
   */
  askAt?: RoutingScope;
  /**
   * Obrigatória: enquanto não for respondida, o que depende dela fica pendente
   * e o bloco não libera (o "liberar bloco" do COND-05). Não apaga nem esconde
   * nada — só impede seguir como se a árvore estivesse resolvida.
   */
  required?: boolean;
  /** Ajuda curta ao lado da pergunta na tela. Nunca entra em condição. */
  helpText?: string;
  /** Seção onde a pergunta é respondida. É o que permite detectar ciclo. */
  sectionId?: string;
  retiredAt?: string | null;
}

export const QUESTION_VALUE_TYPE: Record<RoutingQuestion['type'], ValueType> = {
  boolean: 'boolean',
  single_choice: 'text',
  multi_choice: 'text_list',
  number: 'number',
};

/** Um campo do contexto congelado, declarado para o validador ter o que conferir. */
export interface ContextField {
  key: string;
  label: string;
  type: ValueType;
}

/**
 * Catálogo do contexto congelado (contrato § 4). São os dados que a inspeção já
 * guarda hoje na criação (`NewInspection.tsx`), nada mais: sem cliente vivo, sem
 * data de hoje, sem contagem de inspeções anteriores.
 *
 * `uf` guarda a **sigla** — quem monta o contexto passa `client.state` por
 * `toUF()` antes, porque o cadastro é texto livre ("Goias", "rj ").
 *
 * O catálogo é parâmetro em toda a API: COND-05 acrescenta campo sem tocar aqui.
 */
export const CONTEXT_FIELDS: ContextField[] = [
  { key: 'uf', label: 'UF', type: 'text' },
  { key: 'municipio', label: 'Município', type: 'text' },
  { key: 'categoria', label: 'Categoria do estabelecimento', type: 'text' },
  { key: 'tiposDeAlimento', label: 'Tipos de alimento', type: 'text_list' },
  { key: 'capacidadeIlpi', label: 'Capacidade da ILPI', type: 'number' },
  { key: 'residentesTotal', label: 'Total de residentes', type: 'number' },
  { key: 'areaUtilM2', label: 'Área útil (m²)', type: 'number' },
  { key: 'inicioDaInspecao', label: 'Início da inspeção', type: 'date' },
];

/** Operadores aceitos por tipo de valor. Fora desta tabela é `incompatible_operator`. */
export const OPERATORS_BY_TYPE: Record<ValueType, ConditionOperator[]> = {
  text: ['equals', 'not_equals', 'contains', 'not_contains', 'in_list', 'not_in_list', 'exists', 'not_exists'],
  number: ['equals', 'not_equals', 'greater', 'greater_or_equal', 'less', 'less_or_equal', 'in_list', 'not_in_list', 'exists', 'not_exists'],
  boolean: ['equals', 'not_equals', 'exists', 'not_exists'],
  text_list: ['contains', 'not_contains', 'in_list', 'not_in_list', 'exists', 'not_exists'],
  date: ['equals', 'not_equals', 'greater', 'greater_or_equal', 'less', 'less_or_equal', 'exists', 'not_exists'],
};

/** Operadores que dispensam valor (e que nunca devolvem indeterminado). */
export const VALUELESS_OPERATORS: ConditionOperator[] = ['exists', 'not_exists'];

/** Operadores cujo valor é uma lista. */
export const LIST_VALUE_OPERATORS: ConditionOperator[] = ['in_list', 'not_in_list'];

/** Rótulos em pt-BR — o editor (COND-06) e a explicação do motor leem daqui. */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'é igual a',
  not_equals: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  greater: 'é maior que',
  greater_or_equal: 'é maior ou igual a',
  less: 'é menor que',
  less_or_equal: 'é menor ou igual a',
  exists: 'está preenchido',
  not_exists: 'está vazio',
  in_list: 'pertence a',
  not_in_list: 'não pertence a',
};

export const STATE_LABELS: Record<ApplicabilityState, string> = {
  aplicavel: 'Aplicável',
  nao_aplicavel_por_regra: 'Não aplicável por regra',
  pendente_de_condicao: 'Pendente de condição',
};

// ── Entrada do motor ─────────────────────────────────────────

/**
 * O que o motor precisa de um roteiro. Estrutural de propósito: um
 * `ChecklistTemplate` real satisfaz esta forma, e o COND-03 decide como
 * `rules`/`routingQuestions` chegam até aqui (hoje ninguém os persiste).
 */
export interface ConditionalTemplate {
  sections: ConditionalSection[];
  routingQuestions?: RoutingQuestion[];
  rules?: ApplicabilityRule[];
}

export interface ConditionalSection {
  id: string;
  title?: string;
  items: { id: string }[];
}

/**
 * Resposta de pergunta de roteamento. A forma de objeto é o "não foi possível
 * determinar" do contrato § 6.4: vale indeterminado **declarado** — o item fica
 * pendente, mas a inspeção pode fechar, com a justificativa no relatório.
 */
export type RoutingAnswer =
  | ConditionValue
  | { undetermined: true; justification?: string };

export type RoutingAnswers = Record<string, RoutingAnswer | null | undefined>;

/** Contexto congelado, já normalizado por quem congela (COND-03). */
export type InspectionContext = Record<string, ConditionValue | null | undefined>;

export function isUndeterminedAnswer(
  answer: RoutingAnswer | null | undefined
): answer is { undetermined: true; justification?: string } {
  return typeof answer === 'object' && answer !== null && !Array.isArray(answer) && 'undetermined' in answer;
}

/**
 * Ausente = `undefined`, `null`, texto vazio ou lista vazia. Ausente é
 * **indeterminado**, nunca falso (contrato § 5.2), inclusive quando o dado
 * existe no cadastro mas está em branco (§ 4.1).
 */
export function isAbsent(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
