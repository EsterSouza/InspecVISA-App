// ============================================================
// src/domain/applicability/simulate.ts
// COND-07 — simulador de cenário e gate de publicação.
//
// Duas perguntas, um arquivo:
//
//   · **"o que aparece se for assim?"** — `simulateTemplate` roda o motor sobre
//     um cenário inventado e devolve seção a seção, com a justificativa que o
//     próprio motor escreveu. Sem cliente, sem inspeção, sem banco.
//   · **"dá para publicar?"** — `publishGate` separa o que reprova do que só
//     avisa, e agrupa por causa para a tela dizer o que consertar primeiro.
//
// Puro como o resto do pacote: sem React, sem Supabase, sem rede, sem relógio.
// Nenhuma regra nova mora aqui — quem decide aplicabilidade continua sendo
// `evaluateApplicability`, e quem decide o que é erro continua sendo
// `validateTemplateRules` (regra inegociável 8: uma implementação canônica só).
// ============================================================

import { CONTEXT_FIELDS } from './schema';
import type {
  ApplicabilityState,
  ConditionalSection,
  ConditionalTemplate,
  ContextField,
  InspectionContext,
  RoutingAnswers,
  RoutingQuestion,
} from './schema';
import { evaluateApplicability } from './evaluate';
import type { ApplicabilityDecision } from './evaluate';
import { validateTemplateRules } from './validate';
import type { ValidationCode, ValidationIssue } from './validate';

// ── O roteiro com os rótulos que a tela mostra ───────────────
// O motor só precisa de id; o simulador precisa dizer **qual** item sumiu. Por
// isso a árvore aqui é a do motor mais o texto — e um `ChecklistTemplate` real
// já satisfaz esta forma, sem conversão.

export interface LabeledItem {
  id: string;
  description?: string;
}

export interface LabeledSection extends ConditionalSection {
  title?: string;
  items: LabeledItem[];
}

export interface LabeledTemplate extends ConditionalTemplate {
  sections: LabeledSection[];
}

// ── Cenário ──────────────────────────────────────────────────

/**
 * O que a consultora inventa para testar: o contexto que viria do cadastro e as
 * respostas de roteamento que viriam do agendamento ou do campo. É a mesma
 * entrada que uma inspeção real dá ao motor — por isso o simulador não pode
 * divergir da execução.
 */
export interface SimulationScenario {
  context?: InspectionContext;
  answers?: RoutingAnswers;
}

export interface SimulationCounts {
  aplicavel: number;
  nao_aplicavel_por_regra: number;
  pendente_de_condicao: number;
  total: number;
}

export interface SimulatedItem {
  id: string;
  label: string;
  decision: ApplicabilityDecision;
}

export interface SimulatedSection {
  id: string;
  label: string;
  decision: ApplicabilityDecision;
  items: SimulatedItem[];
  /** Contagem dos **itens** desta seção. */
  counts: SimulationCounts;
}

export interface SimulationResult {
  sections: SimulatedSection[];
  /** Contagem por item, no roteiro inteiro. É o denominador do score (COND-09). */
  itemCounts: SimulationCounts;
  /** Contagem por seção. */
  sectionCounts: SimulationCounts;
  validation: ValidationIssue[];
}

export interface SimulationInput {
  template: LabeledTemplate;
  scenario?: SimulationScenario;
  contextFields?: ContextField[];
}

function zeros(): SimulationCounts {
  return { aplicavel: 0, nao_aplicavel_por_regra: 0, pendente_de_condicao: 0, total: 0 };
}

function count(counts: SimulationCounts, state: ApplicabilityState): void {
  counts[state] += 1;
  counts.total += 1;
}

/**
 * Roda o motor sobre um cenário e organiza a saída do jeito que a tela lê:
 * seção a seção, item a item, com contagem por nível.
 *
 * Não filtra nada: item não aplicável continua na lista, com o motivo. O
 * simulador existe justamente para **ver o que sumiria** — esconder aqui seria
 * repetir o problema que a feature veio resolver.
 */
export function simulateTemplate(input: SimulationInput): SimulationResult {
  const { template } = input;
  const scenario = input.scenario || {};
  const contextFields = input.contextFields || CONTEXT_FIELDS;

  const resultado = evaluateApplicability({
    template,
    context: scenario.context,
    answers: scenario.answers,
    contextFields,
  });

  const itemCounts = zeros();
  const sectionCounts = zeros();
  const sections: SimulatedSection[] = [];

  for (const section of template.sections || []) {
    const decision = resultado.sections[section.id];
    if (!decision) continue;
    count(sectionCounts, decision.state);

    const counts = zeros();
    const items: SimulatedItem[] = [];
    for (const item of section.items || []) {
      const itemDecision = resultado.items[item.id];
      if (!itemDecision) continue;
      count(counts, itemDecision.state);
      count(itemCounts, itemDecision.state);
      items.push({
        id: item.id,
        label: item.description?.trim() || item.id,
        decision: itemDecision,
      });
    }

    sections.push({
      id: section.id,
      label: section.title?.trim() || section.id,
      decision,
      items,
      counts,
    });
  }

  return { sections, itemCounts, sectionCounts, validation: resultado.validation };
}

/**
 * O que o simulador precisa perguntar. Só entra o que **muda o resultado**: campo
 * de contexto citado por alguma condição e pergunta de roteamento citada por
 * alguma condição.
 *
 * Pergunta aposentada citada por regra entra de propósito — ela é um erro que o
 * gate acusa, e escondê-la do simulador esconderia justamente o cenário quebrado.
 */
export interface SimulationInputs {
  contextFields: ContextField[];
  questions: RoutingQuestion[];
  /** Ids citados por condição que não existem no roteiro — referência quebrada. */
  unknownQuestionIds: string[];
  unknownContextKeys: string[];
}

export function simulationInputs(
  template: Pick<ConditionalTemplate, 'rules' | 'routingQuestions'>,
  contextFields: ContextField[] = CONTEXT_FIELDS
): SimulationInputs {
  const questionIds = new Set<string>();
  const contextKeys = new Set<string>();

  for (const rule of template.rules || []) {
    for (const condition of rule.expression?.conditions || []) {
      if (!condition.field) continue;
      if (condition.source === 'question') questionIds.add(condition.field);
      else contextKeys.add(condition.field);
    }
  }

  const questions = (template.routingQuestions || []).filter((question) => questionIds.has(question.id));
  const conhecidas = new Set(questions.map((question) => question.id));
  const campos = contextFields.filter((field) => contextKeys.has(field.key));
  const chavesConhecidas = new Set(campos.map((field) => field.key));

  return {
    contextFields: campos,
    questions,
    unknownQuestionIds: [...questionIds].filter((id) => !conhecidas.has(id)),
    unknownContextKeys: [...contextKeys].filter((key) => !chavesConhecidas.has(key)),
  };
}

// ── Gate de publicação ───────────────────────────────────────

/**
 * Rótulo curto de cada causa, para agrupar a lista de problemas. A mensagem
 * completa continua vindo do validador — isto aqui é só o título do grupo.
 */
export const GATE_LABELS: Record<ValidationCode, string> = {
  duplicate_id: 'Id repetido',
  rule_without_target: 'Regra sem destino',
  unknown_target: 'Destino que não existe',
  duplicate_rule_target: 'Mais de uma regra no mesmo destino',
  empty_group: 'Condição vazia',
  unknown_context_field: 'Referência quebrada no contexto',
  unknown_question: 'Referência quebrada de pergunta',
  incompatible_operator: 'Operador incompatível com o tipo',
  invalid_value: 'Valor de comparação inválido',
  unknown_option: 'Opção que não existe mais',
  retired_question: 'Pergunta aposentada',
  impossible_condition: 'Condição impossível',
  unreachable_branch: 'Ramo inalcançável',
  cycle: 'Dependência circular',
  question_without_options: 'Pergunta de escolha sem opção',
  invalid_option: 'Opção malformada',
  duplicate_option: 'Opção repetida',
  unused_question: 'Pergunta que nenhuma regra usa',
  question_duplicates_context: 'Pergunta repete dado do cadastro',
  question_id_collides: 'Id de pergunta colide com requisito',
};

export interface GateGroup {
  code: ValidationCode;
  label: string;
  issues: ValidationIssue[];
}

export interface PublishGate {
  /** `false` reprova a publicação. É o mesmo corte que o serviço aplica antes do banco. */
  ready: boolean;
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Blockers agrupados por causa, na ordem em que aparecem no roteiro. */
  groups: GateGroup[];
  /** Avisos agrupados do mesmo jeito. Aviso nunca reprova. */
  warningGroups: GateGroup[];
}

function agrupar(issues: ValidationIssue[]): GateGroup[] {
  const grupos: GateGroup[] = [];
  const porCodigo = new Map<ValidationCode, GateGroup>();
  for (const problema of issues) {
    let grupo = porCodigo.get(problema.code);
    if (!grupo) {
      grupo = { code: problema.code, label: GATE_LABELS[problema.code] ?? problema.code, issues: [] };
      porCodigo.set(problema.code, grupo);
      grupos.push(grupo);
    }
    grupo.issues.push(problema);
  }
  return grupos;
}

/**
 * O gate a partir de uma validação já feita — para a tela não validar duas vezes
 * o mesmo roteiro a cada tecla.
 *
 * O corte é o mesmo de `ApplicabilityRevisionService.publishDraft`:
 * `severity === 'error'` reprova, `warning` só informa. Se um dia os dois
 * divergirem, o gate mente — e é por isso que o teste amarra os dois lados.
 */
export function gateFromIssues(issues: ValidationIssue[]): PublishGate {
  const blockers = issues.filter((problema) => problema.severity === 'error');
  const warnings = issues.filter((problema) => problema.severity === 'warning');
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    groups: agrupar(blockers),
    warningGroups: agrupar(warnings),
  };
}

export function publishGate(
  template: ConditionalTemplate,
  contextFields: ContextField[] = CONTEXT_FIELDS
): PublishGate {
  return gateFromIssues(validateTemplateRules(template, contextFields));
}

/**
 * Onde o problema mora, com o nome que a pessoa lê na tela.
 *
 * O validador é puro e só conhece id: as mensagens dele dizem `a regra "dzioxzc"`
 * porque é tudo o que ele tem. Quem está consertando precisa da seção e do item —
 * então a tradução acontece aqui, onde os rótulos existem, e não dentro do
 * validador (que continua sem depender de texto de tela).
 *
 * Devolve `undefined` quando não há nome melhor do que o id — aí a tela não
 * mostra linha nenhuma, em vez de mostrar um id repetido.
 */
export function describeIssueLocation(
  issue: ValidationIssue,
  template: Pick<LabeledTemplate, 'sections' | 'routingQuestions'>
): string | undefined {
  if (issue.questionId) {
    const question = (template.routingQuestions || []).find((q) => q.id === issue.questionId);
    if (question?.text?.trim()) return `Pergunta «${question.text.trim()}»`;
  }

  if (issue.targetId) {
    for (const section of template.sections || []) {
      if (section.id === issue.targetId) {
        return section.title?.trim() ? `Seção «${section.title.trim()}»` : undefined;
      }
      for (const item of section.items || []) {
        if (item.id !== issue.targetId) continue;
        if (!item.description?.trim()) return undefined;
        const texto = item.description.trim();
        const curto = texto.length > 90 ? `${texto.slice(0, 90)}…` : texto;
        return section.title?.trim() ? `${section.title.trim()} · «${curto}»` : `Item «${curto}»`;
      }
    }
  }

  return undefined;
}
