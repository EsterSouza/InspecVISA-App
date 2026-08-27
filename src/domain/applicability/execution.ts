// ============================================================
// src/domain/applicability/execution.ts
// COND-08 — a execução adaptativa, do lado puro.
//
// Três perguntas, um arquivo:
//
//   · **"o que a tela mostra?"** — `resolveExecutionTree` roda o motor sobre a
//     revisão congelada e separa o que a consultora vê (aplicável + pendente,
//     marcado) do que saiu por regra (com a resposta preservada e o motivo).
//   · **"o que esta resposta vai tirar da tela?"** — `answerChangeImpact`
//     compara a árvore de antes com a de depois e devolve o que sai e o que
//     volta, para a confirmação com número do contrato § 6.1.
//   · **"as duas consultoras estão vendo a mesma árvore?"** —
//     `mergeRoutingAnswers` converge resposta de roteamento por pergunta, e não
//     pelo objeto inteiro: quem respondeu a pergunta 1 offline não pode perder a
//     resposta porque a colega respondeu a pergunta 2 (contrato § 6.5).
//
// Puro como o resto do pacote: sem React, sem Supabase, sem rede, sem relógio.
// Nenhuma regra de aplicabilidade nova mora aqui — quem decide continua sendo
// `evaluateApplicability` (regra inegociável 8). Este arquivo só organiza a
// saída dele do jeito que a execução precisa ler.
// ============================================================

import { CONTEXT_FIELDS, isUndeterminedAnswer } from './schema';
import type {
  ApplicabilityState,
  ConditionalTemplate,
  ContextField,
  InspectionContext,
  RoutingAnswer,
  RoutingAnswers,
  RoutingQuestion,
} from './schema';
import { evaluateApplicability } from './evaluate';
import type { ApplicabilityDecision, ApplicabilityResult } from './evaluate';
import { askAtOf, isAnswered } from './routing';

// ── A árvore que a execução mostra ───────────────────────────
// A forma é estrutural de propósito: um `ChecklistTemplate` real já a satisfaz,
// sem conversão e sem cópia.

export interface ExecutionItem {
  id: string;
  description?: string;
}

export interface ExecutionSection {
  id: string;
  title?: string;
  items: ExecutionItem[];
}

export interface ExecutionTemplate extends ConditionalTemplate {
  sections: ExecutionSection[];
}

/** Um alvo que saiu da árvore por regra — com o motivo e a resposta preservada. */
export interface ExcludedTarget {
  type: 'section' | 'item';
  id: string;
  label: string;
  /** Seção a que o item pertencia, para a lista dizer de onde ele saiu. */
  sectionId?: string;
  sectionTitle?: string;
  decision: ApplicabilityDecision;
  /** `true` quando existe resposta gravada para este item (contrato § 6.1). */
  answered: boolean;
}

export interface ExecutionCounts {
  /** Itens do roteiro congelado, aplicáveis ou não. */
  cadastrados: number;
  aplicaveis: number;
  foraPorRegra: number;
  pendentes: number;
  /** Itens fora da árvore que **têm resposta gravada**. */
  foraComResposta: number;
}

export interface ExecutionTree<S> {
  /** As seções que a tela mostra, já sem o que saiu por regra. */
  sections: S[];
  /** Estado de cada seção mostrada — `pendente_de_condicao` vira aviso na tela. */
  sectionState: Record<string, ApplicabilityDecision>;
  itemState: Record<string, ApplicabilityDecision>;
  excluded: ExcludedTarget[];
  counts: ExecutionCounts;
  /** O que o validador achou na revisão congelada. Erro aqui é visível, nunca calado. */
  validation: ApplicabilityResult['validation'];
}

export interface ExecutionTreeInput<S extends ExecutionSection> {
  sections: S[];
  rules?: ConditionalTemplate['rules'];
  routingQuestions?: RoutingQuestion[];
  context?: InspectionContext;
  answers?: RoutingAnswers;
  contextFields?: ContextField[];
  /** Ids de item com resposta gravada — o que decide se o excluído aparece na lista. */
  answeredItemIds?: ReadonlySet<string>;
}

function labelOf(value: string | undefined, fallback: string): string {
  const texto = (value || '').trim();
  return texto || fallback;
}

/**
 * A árvore da execução.
 *
 * Item **não aplicável por regra** sai da lista — é a razão de ser da feature.
 * Ele não some do sistema: vai para `excluded`, com a explicação que o próprio
 * motor escreveu e com a marca de quem já tem resposta gravada. Item
 * **pendente** continua na tela, marcado (contrato § 7): pendência que some é
 * exatamente o que o contrato § 6.4 proíbe.
 *
 * A seção não aplicável sai inteira, e seus itens não são listados um a um —
 * eles herdaram o estado dela, e repetir 12 linhas dizendo a mesma coisa esconde
 * a informação em vez de mostrá-la. Os itens dela que **têm resposta** entram,
 * porque aí a consultora precisa saber que aquilo saiu do resultado.
 */
export function resolveExecutionTree<S extends ExecutionSection>(
  input: ExecutionTreeInput<S>
): ExecutionTree<S> {
  const answered = input.answeredItemIds || new Set<string>();
  const resultado = evaluateApplicability({
    template: { sections: input.sections, rules: input.rules, routingQuestions: input.routingQuestions },
    context: input.context,
    answers: input.answers,
    contextFields: input.contextFields || CONTEXT_FIELDS,
  });

  const sections: S[] = [];
  const excluded: ExcludedTarget[] = [];
  const counts: ExecutionCounts = {
    cadastrados: 0,
    aplicaveis: 0,
    foraPorRegra: 0,
    pendentes: 0,
    foraComResposta: 0,
  };

  const contaItem = (state: ApplicabilityState, itemId: string) => {
    counts.cadastrados += 1;
    if (state === 'aplicavel') counts.aplicaveis += 1;
    else if (state === 'pendente_de_condicao') counts.pendentes += 1;
    else {
      counts.foraPorRegra += 1;
      if (answered.has(itemId)) counts.foraComResposta += 1;
    }
  };

  for (const section of input.sections || []) {
    const decisaoSecao = resultado.sections[section.id];
    const sectionTitle = labelOf(section.title, section.id);

    if (decisaoSecao && decisaoSecao.state === 'nao_aplicavel_por_regra') {
      for (const item of section.items || []) {
        contaItem('nao_aplicavel_por_regra', item.id);
        if (!answered.has(item.id)) continue;
        excluded.push({
          type: 'item',
          id: item.id,
          label: labelOf(item.description, item.id),
          sectionId: section.id,
          sectionTitle,
          decision: resultado.items[item.id] || decisaoSecao,
          answered: true,
        });
      }
      excluded.push({
        type: 'section',
        id: section.id,
        label: sectionTitle,
        decision: decisaoSecao,
        answered: (section.items || []).some((item) => answered.has(item.id)),
      });
      continue;
    }

    const visiveis: ExecutionItem[] = [];
    for (const item of section.items || []) {
      const decisaoItem = resultado.items[item.id];
      const state = decisaoItem?.state || 'aplicavel';
      contaItem(state, item.id);
      if (state === 'nao_aplicavel_por_regra') {
        excluded.push({
          type: 'item',
          id: item.id,
          label: labelOf(item.description, item.id),
          sectionId: section.id,
          sectionTitle,
          decision: decisaoItem as ApplicabilityDecision,
          answered: answered.has(item.id),
        });
        continue;
      }
      visiveis.push(item);
    }

    // Seção aplicável (ou pendente) sem nenhum item visível continua na tela: é
    // ela que carrega a explicação de por que ficou vazia.
    sections.push({ ...section, items: visiveis } as S);
  }

  return {
    sections,
    sectionState: resultado.sections,
    itemState: resultado.items,
    excluded,
    counts,
    validation: resultado.validation,
  };
}

/**
 * O que impede fechar a inspeção (contrato § 6.4).
 *
 * Item `pendente_de_condicao` **esperando resposta** bloqueia: a árvore real não
 * é conhecida, e entregar relatório assim é afirmar o que ninguém apurou. Item
 * pendente por **"não foi possível determinar"** NÃO bloqueia — é a saída de
 * campo, com justificativa, lista própria no relatório e fora do denominador.
 *
 * A distinção mora na decisão da origem: o item que herdou o estado da seção tem
 * `reason: 'inherited'`, então quem decide é a decisão da seção de onde ele veio.
 */
export function pendingBlockers<S extends ExecutionSection>(
  tree: ExecutionTree<S>
): { id: string; label: string; sectionTitle?: string }[] {
  const bloqueia = (decision: ApplicabilityDecision | undefined): boolean => {
    if (!decision || decision.state !== 'pendente_de_condicao') return false;
    if (decision.reason === 'inherited' && decision.inheritedFrom) {
      return bloqueia(tree.sectionState[decision.inheritedFrom]);
    }
    // `rule_error` bloqueia: condição quebrada não é "não foi possível
    // determinar", é roteiro para consertar (regra inegociável 10).
    return decision.reason !== 'declared_undetermined';
  };

  const saida: { id: string; label: string; sectionTitle?: string }[] = [];
  for (const section of tree.sections) {
    for (const item of section.items || []) {
      if (!bloqueia(tree.itemState[item.id])) continue;
      saida.push({
        id: item.id,
        label: labelOf(item.description, item.id),
        sectionTitle: labelOf(section.title, section.id),
      });
    }
  }
  return saida;
}

// ── O que muda quando a resposta controladora muda ───────────

export interface AnswerChangeImpact {
  /** Itens **com resposta gravada** que deixam de ser aplicáveis. */
  leaving: ExcludedTarget[];
  /** Itens que voltam a ser aplicáveis (o caminho de volta do contrato § 6.1). */
  returning: ExcludedTarget[];
  /** Seções inteiras que saem, para a frase da confirmação. */
  leavingSections: ExcludedTarget[];
  /** `true` quando há o que confirmar — nada some sem a consultora saber. */
  needsConfirmation: boolean;
}

export interface AnswerChangeInput<S extends ExecutionSection> extends ExecutionTreeInput<S> {
  questionId: string;
  /** A resposta que a tela quer gravar. `null` limpa. */
  nextAnswer: RoutingAnswer | null;
}

/**
 * O que a mudança de uma resposta controladora tira e devolve.
 *
 * Roda o motor duas vezes — antes e depois — porque a única fonte de verdade
 * sobre aplicabilidade é ele. Reimplementar "quem depende de quem" aqui seria o
 * segundo motor que a regra inegociável 8 proíbe.
 *
 * Só entra em `leaving` o item que **já tem resposta**: tirar da tela um item em
 * branco não perde nada e não merece diálogo. É a leitura literal do § 6.1 ("uma
 * mudança que retira item já respondido").
 */
export function answerChangeImpact<S extends ExecutionSection>(
  input: AnswerChangeInput<S>
): AnswerChangeImpact {
  const answered = input.answeredItemIds || new Set<string>();
  const antes = resolveExecutionTree(input);
  const depois = resolveExecutionTree({
    ...input,
    answers: { ...(input.answers || {}), [input.questionId]: input.nextAnswer },
  });

  const estadoAntes = antes.itemState;
  const foraAntes = new Set(
    Object.keys(estadoAntes).filter((id) => estadoAntes[id].state === 'nao_aplicavel_por_regra')
  );
  const rotulo = new Map<string, { label: string; sectionId: string; sectionTitle: string }>();
  for (const section of input.sections || []) {
    for (const item of section.items || []) {
      rotulo.set(item.id, {
        label: labelOf(item.description, item.id),
        sectionId: section.id,
        sectionTitle: labelOf(section.title, section.id),
      });
    }
  }

  const leaving: ExcludedTarget[] = [];
  const returning: ExcludedTarget[] = [];

  for (const alvo of depois.excluded) {
    if (alvo.type !== 'item') continue;
    if (foraAntes.has(alvo.id)) continue;
    if (!answered.has(alvo.id)) continue;
    leaving.push(alvo);
  }

  // O que volta se mede pelo estado, não pela lista de excluídos: item de seção
  // que saiu só entra naquela lista quando tem resposta, e o caminho de volta
  // vale para todos (contrato § 6.1).
  for (const id of Object.keys(estadoAntes)) {
    if (estadoAntes[id]?.state !== 'nao_aplicavel_por_regra') continue;
    const agora = depois.itemState[id];
    if (!agora || agora.state === 'nao_aplicavel_por_regra') continue;
    const onde = rotulo.get(id);
    returning.push({
      type: 'item',
      id,
      label: onde?.label || id,
      sectionId: onde?.sectionId,
      sectionTitle: onde?.sectionTitle,
      decision: agora,
      answered: answered.has(id),
    });
  }

  const secoesAntes = new Set(
    antes.excluded.filter((alvo) => alvo.type === 'section').map((alvo) => alvo.id)
  );
  const leavingSections = depois.excluded.filter(
    (alvo) => alvo.type === 'section' && !secoesAntes.has(alvo.id)
  );

  return {
    leaving,
    returning,
    leavingSections,
    needsConfirmation: leaving.length > 0,
  };
}

// ── Convergência entre dispositivos ──────────────────────────

/**
 * Carimbo de uma resposta de roteamento: quando foi respondida e por quem.
 *
 * Existe para o merge por pergunta. Sem ele, o merge do registro inteiro
 * (`{...local, ...remote}`) apagaria a resposta que a colega deu offline a
 * **outra** pergunta — perda silenciosa, que é o que a regra inegociável 1
 * proíbe.
 */
export interface RoutingAnswerStamp {
  /** ISO-8601. Quem carimba passa o relógio; este arquivo não lê relógio. */
  at: string;
  by?: string;
}

export type RoutingAnswersMeta = Record<string, RoutingAnswerStamp>;

export interface RoutingAnswersState {
  answers: RoutingAnswers;
  meta: RoutingAnswersMeta;
}

/** Registra a resposta com autoria e hora — o "última escrita vence" do contrato § 6.5. */
export function stampRoutingAnswer(
  state: RoutingAnswersState | undefined,
  questionId: string,
  answer: RoutingAnswer | null,
  stamp: RoutingAnswerStamp
): RoutingAnswersState {
  return {
    // Limpar guarda `null` **explícito**: apagar a chave faria o merge
    // ressuscitar a resposta antiga vinda do outro dispositivo.
    answers: { ...(state?.answers || {}), [questionId]: answer },
    meta: { ...(state?.meta || {}), [questionId]: stamp },
  };
}

function stampTime(meta: RoutingAnswersMeta | undefined, questionId: string): number {
  const at = meta?.[questionId]?.at;
  if (!at) return 0;
  const time = Date.parse(at);
  return Number.isNaN(time) ? 0 : time;
}

/** Comparação estável para o empate — os dois dispositivos chegam ao mesmo lado. */
function tieBreak(a: RoutingAnswer | null | undefined, b: RoutingAnswer | null | undefined): number {
  const serialize = (value: RoutingAnswer | null | undefined) => (value === undefined ? '' : JSON.stringify(value));
  const left = serialize(a);
  const right = serialize(b);
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

/**
 * Converge as respostas de roteamento **pergunta a pergunta**.
 *
 * Regra: vence o carimbo mais recente. Sem carimbo vale época zero — resposta
 * carimbada sempre ganha de resposta sem carimbo (registro antigo, anterior ao
 * COND-08). Empate de relógio com valores diferentes desempata pelo valor
 * serializado: é arbitrário, mas é **igual nos dois dispositivos**, que é o que
 * impede divergência permanente (contrato § 6.5).
 *
 * Chave presente só de um lado entra como está — inclusive quando o valor é
 * `null`, que é "respondeu e apagou", não "nunca respondeu".
 */
export function mergeRoutingAnswers(
  local: Partial<RoutingAnswersState> | undefined,
  remote: Partial<RoutingAnswersState> | undefined
): RoutingAnswersState {
  const answersLocal = local?.answers || {};
  const answersRemote = remote?.answers || {};
  const metaLocal = local?.meta || {};
  const metaRemote = remote?.meta || {};

  const answers: RoutingAnswers = {};
  const meta: RoutingAnswersMeta = {};

  const ids = new Set([...Object.keys(answersLocal), ...Object.keys(answersRemote), ...Object.keys(metaLocal), ...Object.keys(metaRemote)]);

  for (const id of ids) {
    const temLocal = id in answersLocal;
    const temRemote = id in answersRemote;

    let venceRemoto: boolean;
    if (!temLocal) venceRemoto = true;
    else if (!temRemote) venceRemoto = false;
    else {
      const tLocal = stampTime(metaLocal, id);
      const tRemote = stampTime(metaRemote, id);
      venceRemoto = tRemote > tLocal || (tRemote === tLocal && tieBreak(answersRemote[id], answersLocal[id]) > 0);
    }

    if (venceRemoto) {
      if (temRemote) answers[id] = answersRemote[id] as RoutingAnswer | null;
      if (metaRemote[id]) meta[id] = metaRemote[id];
      else if (metaLocal[id]) meta[id] = metaLocal[id];
    } else {
      if (temLocal) answers[id] = answersLocal[id] as RoutingAnswer | null;
      if (metaLocal[id]) meta[id] = metaLocal[id];
      else if (metaRemote[id]) meta[id] = metaRemote[id];
    }
  }

  return { answers, meta };
}

// ── As perguntas que a execução faz ──────────────────────────

export interface ExecutionQuestion {
  question: RoutingQuestion;
  answer: RoutingAnswer | null | undefined;
  /** Quem respondeu por último, quando o carimbo diz. */
  stamp?: RoutingAnswerStamp;
  /** Obrigatória em aberto: segura o bloco, não esconde nada (COND-05, decisão 3). */
  blocking: boolean;
  /** Quantas seções e itens esta pergunta controla — a tela diz o que ela libera. */
  controls: { sections: number; items: number };
}

/**
 * As perguntas respondidas em campo, na ordem do roteiro, com o que cada uma
 * controla. Aposentada com resposta continua aparecendo (contrato § 8, caso 14):
 * ela decidiu a árvore desta inspeção e some da tela seria mentira.
 */
export function executionQuestions(
  template: Pick<ConditionalTemplate, 'rules' | 'routingQuestions'>,
  answers: RoutingAnswers | undefined,
  meta?: RoutingAnswersMeta
): ExecutionQuestion[] {
  const registro = answers || {};
  const saida: ExecutionQuestion[] = [];

  for (const question of template.routingQuestions || []) {
    if (askAtOf(question) !== 'execution') continue;
    const answer = registro[question.id];
    if (question.retiredAt && !isAnswered(answer)) continue;

    let sections = 0;
    let items = 0;
    for (const rule of template.rules || []) {
      const usa = (rule.expression?.conditions || []).some(
        (condition) => condition.source === 'question' && condition.field === question.id
      );
      if (!usa || !rule.target?.id) continue;
      if (rule.target.type === 'item') items += 1;
      else sections += 1;
    }

    saida.push({
      question,
      answer,
      stamp: meta?.[question.id],
      blocking: Boolean(question.required) && !question.retiredAt && !isAnswered(answer),
      controls: { sections, items },
    });
  }

  return saida;
}

/**
 * As perguntas de campo que ficaram como "não foi possível determinar" — a lista
 * própria que o relatório mostra (contrato § 6.4). Aqui só o recorte; imprimir é
 * o COND-09.
 */
export function undeterminedQuestions(
  template: Pick<ConditionalTemplate, 'routingQuestions'>,
  answers: RoutingAnswers | undefined
): RoutingQuestion[] {
  const registro = answers || {};
  return (template.routingQuestions || []).filter((question) => isUndeterminedAnswer(registro[question.id]));
}
