// ============================================================
// src/domain/applicability/compose.ts
// COND-10 — montar árvores de condicional sem cair na armadilha do alvo repetido.
//
// ─── A armadilha ────────────────────────────────────────────────────────────
//
// O motor guarda **uma regra por alvo**: `evaluate.ts` monta um
// `Map<'item:est-036', regra>`, e o último `set` vence. Duas regras no mesmo
// item, escritas em árvores diferentes, e uma delas simplesmente deixa de
// existir — sem erro, sem aviso, sem log. É a mesma família de falha silenciosa
// do `replacesItemId` dos suplementos e do id de catálogo que não existe no
// banco: nada quebra, o resultado é que fica errado.
//
// O validador tem o `duplicate_rule_target`, então o gate de publicação pega o
// caso. Mas pegar no gate é tarde: a essa altura a árvore já foi escrita, e a
// saída fácil vira "tira o alvo de uma das duas", que empobrece a regra.
//
// ─── A saída ────────────────────────────────────────────────────────────────
//
// `combinarPorAlvo` funde as regras que apontam para o mesmo alvo numa só, com
// as condições somadas em `all`. É o que permite dizer a coisa certa: o registro
// dos ciclos de esterilização é aplicável quando a unidade processa artigos **e**
// já está em funcionamento. Uma condição só nunca daria conta.
//
// A fusão é sempre `all`, e isso é uma escolha de segurança: cada condição a
// mais é mais uma razão para o requisito SAIR. O contrário — fundir em `any` —
// faria uma árvore nova ressuscitar requisito que outra tinha tirado, e ninguém
// perceberia.
//
// Grupo com `any` não é fundido: `ConditionGroup` é de um nível só, então
// `any` misturado com `all` não tem como ser expresso sem aninhamento. Nesse
// caso a função **levanta erro** em vez de inventar uma expressão parecida.
// ============================================================

import type { ApplicabilityRule, ConditionGroup, ConditionValue } from './schema';

/** `quando('q-processa', true)` — a expressão que quase toda árvore usa. */
export function quando(questionId: string, value: ConditionValue): ConditionGroup {
  return {
    combinator: 'all',
    conditions: [{ source: 'question', field: questionId, operator: 'equals', value }],
  };
}

/** Uma regra de item por id, todas com a mesma condição. */
export function itensQuando(
  prefixo: string,
  questionId: string,
  value: ConditionValue,
  itemIds: string[]
): ApplicabilityRule[] {
  return itemIds.map((id) => ({
    id: `${prefixo}-${id}`,
    target: { type: 'item' as const, id },
    expression: quando(questionId, value),
  }));
}

/** A regra de seção — sai a seção inteira, e os itens dela vão junto (contrato § 5.4). */
export function secaoQuando(
  prefixo: string,
  questionId: string,
  value: ConditionValue,
  sectionId: string
): ApplicabilityRule {
  return {
    id: `${prefixo}-${sectionId}`,
    target: { type: 'section', id: sectionId },
    expression: quando(questionId, value),
  };
}

/** Chave do alvo, no mesmo formato que `evaluate.ts` usa no seu Map. */
function chave(regra: ApplicabilityRule): string {
  return `${regra.target.type}:${regra.target.id}`;
}

/**
 * Funde as regras que apontam para o mesmo alvo, somando as condições em `all`.
 *
 * A ordem de saída é a da primeira aparição de cada alvo, para o resultado não
 * depender da ordem em que as árvores foram declaradas. Condição repetida
 * (mesma pergunta, mesmo operador, mesmo valor) entra uma vez só — duas árvores
 * podem legitimamente depender da mesma resposta.
 */
export function combinarPorAlvo(regras: ApplicabilityRule[]): ApplicabilityRule[] {
  const porAlvo = new Map<string, ApplicabilityRule[]>();
  for (const regra of regras) {
    const lista = porAlvo.get(chave(regra));
    if (lista) lista.push(regra);
    else porAlvo.set(chave(regra), [regra]);
  }

  return Array.from(porAlvo.values()).map((grupo) => {
    if (grupo.length === 1) return grupo[0];

    const comAny = grupo.find((regra) => regra.expression.combinator !== 'all');
    if (comAny) {
      throw new Error(
        `combinarPorAlvo: a regra "${comAny.id}" usa o combinador "${comAny.expression.combinator}" e disputa `
        + `o alvo ${chave(comAny)} com outra. ConditionGroup é de um nível só — reescreva as duas à mão.`
      );
    }

    const vistas = new Set<string>();
    const conditions = grupo.flatMap((regra) => regra.expression.conditions).filter((condicao) => {
      const assinatura = `${condicao.source}|${condicao.field}|${condicao.operator}|${JSON.stringify(condicao.value)}`;
      if (vistas.has(assinatura)) return false;
      vistas.add(assinatura);
      return true;
    });

    return {
      id: grupo.map((regra) => regra.id).join('+'),
      target: grupo[0].target,
      expression: { combinator: 'all' as const, conditions },
    };
  });
}
