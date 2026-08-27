// ============================================================
// src/components/templates/useApplicabilityDraft.ts
// COND-06 — o rascunho de condições de um roteiro, do lado da tela.
//
// Divisão de trabalho: **decidir** é do domínio puro
// (`src/domain/applicability`), **guardar** é do serviço
// (`applicabilityRevisionService`), e o que sobra é este hook — estado da tela,
// nada mais. Nenhuma regra de negócio nova mora aqui.
//
// Duas invariantes do card vivem nesta camada:
//
//   · **Rascunho inválido pode ser salvo, nunca publicado.** `salvar()` não
//     valida de propósito: regra pela metade é trabalho em andamento. Quem
//     recusa é `publicar()`, e quem recusa de verdade é o serviço.
//   · **Uma regra por alvo.** O validador acusa `duplicate_rule_target`, então
//     o modelo da tela é alvo → regra ou nada. "Sempre aplicável" é a ausência
//     de regra, não uma regra que diz sim.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApplicabilityRevisionService,
  ApplicabilityValidationError,
} from '../../services/applicabilityRevisionService';
import { TemplateService } from '../../services/templateService';
import { canRemoveOption, canRetireQuestion, validateTemplateRules } from '../../domain/applicability';
import type {
  ApplicabilityRule,
  AuthoringGuard,
  ConditionalSection,
  RoutingQuestion,
  ValidationIssue,
} from '../../domain/applicability';
import { rawErrorMessage } from '../../utils/errors';

/** O alvo de uma regra, do jeito que a tela fala dele. */
export interface RuleTarget {
  type: 'section' | 'item';
  id: string;
}

export interface ApplicabilityDraft {
  rules: ApplicabilityRule[];
  routingQuestions: RoutingQuestion[];
  carregando: boolean;
  /** Já existe revisão publicada? Muda o texto do botão: "Publicar" × "Publicar nova versão". */
  temPublicada: boolean;
  /** Mudou desde o último salvamento — o botão de publicar espera salvar antes. */
  sujo: boolean;
  erro: string | null;
  /** Problemas ao vivo, para a tela avisar antes da hora de publicar. */
  problemas: ValidationIssue[];
  regraDe: (target: RuleTarget) => ApplicabilityRule | undefined;
  definirRegra: (target: RuleTarget, rule: ApplicabilityRule | null) => void;
  definirPerguntas: (questions: RoutingQuestion[]) => void;
  podeAposentarPergunta: (questionId: string) => AuthoringGuard;
  podeExcluirOpcao: (questionId: string, optionValue: string) => AuthoringGuard;
  salvar: () => Promise<void>;
  publicar: () => Promise<{ ok: boolean; problemas: ValidationIssue[]; mensagem?: string }>;
}

function chaveDoAlvo(target: RuleTarget): string {
  return `${target.type}:${target.id}`;
}

/**
 * @param templateId  Roteiro em edição. `undefined` em roteiro novo — não há o
 *                    que versionar antes de existir, e o hook fica inerte.
 * @param sections    A árvore como está na tela, só para validar ao vivo.
 */
export function useApplicabilityDraft(
  templateId: string | undefined,
  sections: ConditionalSection[]
): ApplicabilityDraft {
  const [rules, setRules] = useState<ApplicabilityRule[]>([]);
  const [routingQuestions, setRoutingQuestions] = useState<RoutingQuestion[]>([]);
  const [carregando, setCarregando] = useState(Boolean(templateId));
  const [temPublicada, setTemPublicada] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) {
      setCarregando(false);
      return;
    }
    let ativo = true;

    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const rascunho = await ApplicabilityRevisionService.getDraft(templateId);
        const publicada = await ApplicabilityRevisionService.getPublishedRevision(templateId);
        if (!ativo) return;

        // Sem rascunho, o ponto de partida é o que está no ar — editar um roteiro
        // publicado começa do que a inspeção usa hoje, não de uma folha em branco.
        const base = rascunho ?? publicada;
        setRules(base?.rules ?? []);
        setRoutingQuestions(base?.routingQuestions ?? []);
        setTemPublicada(Boolean(publicada));
        setSujo(false);
      } catch (err) {
        if (!ativo) return;
        console.error('[useApplicabilityDraft] falha ao carregar revisão:', err);
        setErro(rawErrorMessage(err) || 'Não foi possível carregar as condições deste roteiro.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [templateId]);

  const porAlvo = useMemo(() => {
    const mapa = new Map<string, ApplicabilityRule>();
    for (const rule of rules) {
      if (rule.target?.id) mapa.set(chaveDoAlvo(rule.target), rule);
    }
    return mapa;
  }, [rules]);

  const problemas = useMemo(
    () => validateTemplateRules({ sections, rules, routingQuestions }),
    [sections, rules, routingQuestions]
  );

  const regraDe = useCallback((target: RuleTarget) => porAlvo.get(chaveDoAlvo(target)), [porAlvo]);

  /** `null` volta o alvo para "Sempre aplicável" — some a regra, não fica regra vazia. */
  const definirRegra = useCallback((target: RuleTarget, rule: ApplicabilityRule | null) => {
    setRules((prev) => {
      const outras = prev.filter(
        (candidata) => !(candidata.target?.type === target.type && candidata.target?.id === target.id)
      );
      return rule ? [...outras, rule] : outras;
    });
    setSujo(true);
  }, []);

  const definirPerguntas = useCallback((questions: RoutingQuestion[]) => {
    setRoutingQuestions(questions);
    setSujo(true);
  }, []);

  const podeAposentarPergunta = useCallback(
    (questionId: string) => canRetireQuestion({ rules }, questionId),
    [rules]
  );

  const podeExcluirOpcao = useCallback(
    (questionId: string, optionValue: string) => canRemoveOption({ rules }, questionId, optionValue),
    [rules]
  );

  const salvar = useCallback(async () => {
    if (!templateId) return;
    // Sem validar, de propósito: o rascunho é para poder parar no meio de uma regra.
    await ApplicabilityRevisionService.saveDraft(templateId, { rules, routingQuestions });
    setSujo(false);
  }, [templateId, rules, routingQuestions]);

  const publicar = useCallback(async () => {
    if (!templateId) return { ok: false, problemas: [], mensagem: 'Salve o roteiro antes de publicar as condições.' };
    try {
      // Valida contra a árvore que está **no banco**, não contra a da tela: publicar
      // condição que aponta para item ainda não salvo criaria referência órfã.
      const salvo = await TemplateService.getFullTemplate(templateId);
      await ApplicabilityRevisionService.publishDraft(salvo);
      setTemPublicada(true);
      setSujo(false);
      return { ok: true, problemas: [] };
    } catch (err) {
      if (err instanceof ApplicabilityValidationError) {
        return { ok: false, problemas: err.issues };
      }
      console.error('[useApplicabilityDraft] falha ao publicar:', err);
      return {
        ok: false,
        problemas: [],
        mensagem: rawErrorMessage(err) || 'Não foi possível publicar as condições.',
      };
    }
  }, [templateId]);

  return {
    rules,
    routingQuestions,
    carregando,
    temPublicada,
    sujo,
    erro,
    problemas,
    regraDe,
    definirRegra,
    definirPerguntas,
    podeAposentarPergunta,
    podeExcluirOpcao,
    salvar,
    publicar,
  };
}
