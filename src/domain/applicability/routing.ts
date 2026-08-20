// ============================================================
// src/domain/applicability/routing.ts
// COND-05 — perguntas de roteamento: onde cada uma é respondida, como a resposta
// é normalizada, o que ainda falta responder e como elas aparecem no relatório.
//
// Puro como o resto do pacote: sem React, sem banco, sem rede, sem relógio.
//
// Pergunta de roteamento **não é requisito sanitário** (contrato § 3): não tem
// peso nem criticidade, não é conforme nem NC, não entra na nota, não gera plano
// de ação e nunca aparece como exigência infringida. É por isso que a resposta
// dela **não mora em `responses`** — mora na inspeção, em `routingAnswers`. As
// duas coisas nunca compartilham tabela, id nem vocabulário.
// ============================================================

import { isAbsent, isUndeterminedAnswer } from './schema';
import type {
  ConditionalTemplate,
  RoutingAnswer,
  RoutingAnswers,
  RoutingQuestion,
  RoutingScope,
} from './schema';
import { normalizeText, toBoolean, toNumber } from './values';

/**
 * Onde a pergunta é respondida. Valor ausente ou ilegível cai em `execution`: o
 * lado conservador é perguntar em campo, nunca deixar de perguntar (e nunca
 * travar a criação da inspeção por causa de uma pergunta malformada).
 */
export function askAtOf(question: RoutingQuestion): RoutingScope {
  return question.askAt === 'wizard' ? 'wizard' : 'execution';
}

/**
 * As perguntas de um momento. Aposentada não é perguntada de novo — mas a
 * resposta já dada continua valendo na inspeção que a congelou (contrato § 8,
 * caso 14), e por isso `includeRetired` existe para quem precisa exibir.
 */
export function routingQuestionsFor(
  template: Pick<ConditionalTemplate, 'routingQuestions'>,
  scope: RoutingScope,
  options: { includeRetired?: boolean } = {}
): RoutingQuestion[] {
  return (template.routingQuestions || []).filter(
    (question) => askAtOf(question) === scope && (options.includeRetired || !question.retiredAt)
  );
}

/**
 * Respondida = tem alguma coisa registrada, **inclusive** "não foi possível
 * determinar" — que é resposta legítima em campo e pode fechar a inspeção
 * (contrato § 6.4). O que ela não é: valor conhecido. Para isso, `isDetermined`.
 */
export function isAnswered(answer: RoutingAnswer | null | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  if (isUndeterminedAnswer(answer)) return true;
  return !isAbsent(answer);
}

export function isDetermined(answer: RoutingAnswer | null | undefined): boolean {
  return isAnswered(answer) && !isUndeterminedAnswer(answer);
}

export interface ParsedRoutingAnswer {
  /** `null` = limpar a resposta. Nunca inventa valor. */
  answer: RoutingAnswer | null;
  /** Mensagem em pt-BR quando o que veio não é resposta válida para o tipo. */
  error?: string;
}

/**
 * Normaliza o que a tela coletou para o formato que o motor lê.
 *
 * Escolha guarda o **`value` da opção**, nunca o rótulo: renomear "Terceirizado"
 * para "Terceirizado (contrato)" não pode mudar resposta nem quebrar regra
 * (regra inegociável 4). Valor fora do catálogo de opções é recusado aqui, e não
 * gravado torto para o motor descobrir depois.
 */
export function parseRoutingAnswer(question: RoutingQuestion, raw: unknown): ParsedRoutingAnswer {
  if (isUndeterminedAnswer(raw as RoutingAnswer)) {
    const declared = raw as { undetermined: true; justification?: string };
    const justification = (declared.justification || '').trim();
    return { answer: justification ? { undetermined: true, justification } : { undetermined: true } };
  }

  if (isAbsent(raw)) return { answer: null };

  switch (question.type) {
    case 'boolean': {
      const value = toBoolean(raw);
      if (value === null) return { answer: null, error: 'Responda Sim ou Não.' };
      return { answer: value };
    }
    case 'number': {
      const value = toNumber(raw);
      if (value === null) return { answer: null, error: 'Informe um número.' };
      return { answer: value };
    }
    case 'single_choice': {
      const option = findOption(question, raw);
      if (!option) return { answer: null, error: 'Escolha uma das opções da pergunta.' };
      return { answer: option };
    }
    case 'multi_choice': {
      const entries = Array.isArray(raw) ? raw : [raw];
      const chosen: string[] = [];
      for (const entry of entries) {
        if (isAbsent(entry)) continue;
        const option = findOption(question, entry);
        if (!option) return { answer: null, error: 'Uma das opções marcadas não existe mais na pergunta.' };
        if (!chosen.includes(option)) chosen.push(option);
      }
      return { answer: chosen.length > 0 ? chosen : null };
    }
    default:
      return { answer: null, error: 'Tipo de pergunta desconhecido.' };
  }
}

/** O `value` canônico da opção que casa com o que veio da tela. */
function findOption(question: RoutingQuestion, raw: unknown): string | null {
  const wanted = normalizeText(raw);
  const option = (question.options || []).find((candidate) => normalizeText(candidate.value) === wanted);
  return option ? option.value : null;
}

/**
 * O que falta responder para o bloco liberar. Só pergunta **obrigatória** entra:
 * a opcional sem resposta deixa o alvo `pendente_de_condicao` (visível, nunca
 * oculto), e isso já é o comportamento do motor.
 */
export function missingRequiredQuestions(
  template: Pick<ConditionalTemplate, 'routingQuestions'>,
  answers: RoutingAnswers | undefined,
  scope?: RoutingScope
): RoutingQuestion[] {
  const registro = answers || {};
  return (template.routingQuestions || []).filter(
    (question) =>
      question.required &&
      !question.retiredAt &&
      (scope === undefined || askAtOf(question) === scope) &&
      !isAnswered(registro[question.id])
  );
}

export interface RoutingGate {
  /** `true` quando nenhuma pergunta obrigatória daquele momento está em aberto. */
  ready: boolean;
  missing: RoutingQuestion[];
}

export function routingGate(
  template: Pick<ConditionalTemplate, 'routingQuestions'>,
  answers: RoutingAnswers | undefined,
  scope?: RoutingScope
): RoutingGate {
  const missing = missingRequiredQuestions(template, answers, scope);
  return { ready: missing.length === 0, missing };
}

/** Seções e itens que dependem de uma pergunta — o que ela "libera". */
export function targetsControlledBy(
  template: Pick<ConditionalTemplate, 'rules'>,
  questionId: string
): { sections: string[]; items: string[] } {
  const sections: string[] = [];
  const items: string[] = [];
  for (const rule of template.rules || []) {
    if (!rule.target?.id) continue;
    const usa = (rule.expression?.conditions || []).some(
      (condition) => condition.source === 'question' && condition.field === questionId
    );
    if (!usa) continue;
    const bucket = rule.target.type === 'item' ? items : sections;
    if (!bucket.includes(rule.target.id)) bucket.push(rule.target.id);
  }
  return { sections, items };
}

/** Como a resposta é lida por gente — rótulo da opção, nunca o `value` cru. */
export function describeRoutingAnswer(
  question: RoutingQuestion,
  answer: RoutingAnswer | null | undefined
): string {
  if (!isAnswered(answer)) return 'Sem resposta';
  if (isUndeterminedAnswer(answer)) return 'Não foi possível determinar';
  if (typeof answer === 'boolean') return answer ? 'Sim' : 'Não';
  if (Array.isArray(answer)) return answer.map((entry) => optionLabel(question, entry)).join(', ');
  if (typeof answer === 'number') return String(answer);
  return optionLabel(question, answer as string);
}

function optionLabel(question: RoutingQuestion, value: string | number): string {
  const option = (question.options || []).find(
    (candidate) => normalizeText(candidate.value) === normalizeText(value)
  );
  return option ? option.label : String(value);
}

export interface DeclaredRoutingAnswer {
  questionId: string;
  question: string;
  answer: string;
  undetermined: boolean;
  justification?: string;
}

/**
 * O que o relatório mostra das perguntas de roteamento: **contexto declarado**
 * ("Processamento de artigos: terceirizado"), na ordem do roteiro — decisão 2 da
 * Ester (contrato § 10). Nunca contagem de conformidade, nunca NC. Pergunta sem
 * resposta não entra: o relatório não afirma o que ninguém disse.
 */
export function declaredRoutingContext(
  template: Pick<ConditionalTemplate, 'routingQuestions'>,
  answers: RoutingAnswers | undefined
): DeclaredRoutingAnswer[] {
  const registro = answers || {};
  const declarados: DeclaredRoutingAnswer[] = [];
  for (const question of template.routingQuestions || []) {
    const answer = registro[question.id];
    if (!isAnswered(answer)) continue;
    const undetermined = isUndeterminedAnswer(answer);
    declarados.push({
      questionId: question.id,
      question: question.text,
      answer: describeRoutingAnswer(question, answer),
      undetermined,
      ...(undetermined && answer.justification ? { justification: answer.justification } : {}),
    });
  }
  return declarados;
}
