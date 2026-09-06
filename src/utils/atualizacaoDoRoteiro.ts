import type { ChecklistItem, ChecklistTemplate, Section } from '../types';

// ============================================================
// Atualizar a revisão congelada de uma inspeção EM ANDAMENTO.
//
// COND-03 congela o roteiro na criação da inspeção, e isso é proposital: o
// roteiro-mestre não pode mudar debaixo de quem está vistoriando. O efeito
// colateral apareceu na vistoria pré-obra da consultoria em 06/09/2026 — o
// roteiro ganhou a ação pela norma já escrita em 115 itens, e a inspeção aberta
// no dia anterior continuou sem nenhuma delas, porque a árvore dela estava
// congelada desde 04/09.
//
// A saída não é descongelar sozinho. É deixar a consultora ATUALIZAR quando ela
// quiser, vendo antes o que entra. Duas travas fazem isso ser seguro:
//
//  1. Item que já tem resposta NUNCA sai, mesmo que tenha saído do roteiro vivo.
//     Resposta órfã degrada relatório entregue, e este arquivo não cria nenhuma.
//  2. `rules` e `routingQuestions` continuam sendo as da revisão congelada. A
//     atualização mexe em item e texto, não em condição — item novo entra
//     visível, que é o lado seguro da regra inegociável 10.
// ============================================================

export type AtualizacaoDoRoteiro = {
  itensNovos: ChecklistItem[];
  itensComTextoNovo: ChecklistItem[];
  secoesNovas: string[];
};

function todosOsItens(template: ChecklistTemplate): ChecklistItem[] {
  return template.sections.flatMap(section => section.items);
}

function porId(template: ChecklistTemplate): Map<string, ChecklistItem> {
  return new Map(todosOsItens(template).map(item => [item.id, item]));
}

/** O texto mudou quando a orientação, a ação pela norma ou a pergunta mudaram. */
function textoDiferente(congelado: ChecklistItem, vivo: ChecklistItem): boolean {
  return (congelado.guidance ?? '') !== (vivo.guidance ?? '')
    || (congelado.requiredAction ?? '') !== (vivo.requiredAction ?? '')
    || congelado.description !== vivo.description
    || (congelado.legislation ?? '') !== (vivo.legislation ?? '');
}

export function compararRoteiro(
  congelado: ChecklistTemplate,
  vivo: ChecklistTemplate,
): AtualizacaoDoRoteiro {
  const noCongelado = porId(congelado);
  const secoesCongeladas = new Set(congelado.sections.map(section => section.id));

  const itensNovos: ChecklistItem[] = [];
  const itensComTextoNovo: ChecklistItem[] = [];

  for (const item of todosOsItens(vivo)) {
    const antigo = noCongelado.get(item.id);
    if (!antigo) {
      itensNovos.push(item);
      continue;
    }
    if (textoDiferente(antigo, item)) itensComTextoNovo.push(item);
  }

  return {
    itensNovos,
    itensComTextoNovo,
    secoesNovas: vivo.sections
      .filter(section => !secoesCongeladas.has(section.id))
      .map(section => section.title),
  };
}

export function temAtualizacao(diff: AtualizacaoDoRoteiro): boolean {
  return diff.itensNovos.length > 0 || diff.itensComTextoNovo.length > 0;
}

/**
 * A nova revisão congelada: a árvore viva, mais tudo que a inspeção já respondeu
 * e que o roteiro vivo não tem mais. As condições continuam sendo as de antes.
 */
export function aplicarAtualizacao(
  congelado: ChecklistTemplate,
  vivo: ChecklistTemplate,
  idsComResposta: Set<string>,
): ChecklistTemplate {
  const sections: Section[] = vivo.sections.map(section => ({
    ...section,
    items: [...section.items],
  }));
  const presentes = new Set(sections.flatMap(section => section.items.map(item => item.id)));
  const porIdDeSecao = new Map(sections.map(section => [section.id, section]));

  // Item respondido que sumiu do roteiro vivo volta para o lugar onde estava. Se
  // a seção inteira também sumiu, ela volta junto — vazia de tudo menos do que
  // foi respondido, porque o resto dela o roteiro vivo já não pede.
  for (const secaoAntiga of congelado.sections) {
    for (const item of secaoAntiga.items) {
      if (presentes.has(item.id) || !idsComResposta.has(item.id)) continue;
      let destino = porIdDeSecao.get(secaoAntiga.id);
      if (!destino) {
        destino = { ...secaoAntiga, items: [] };
        sections.push(destino);
        porIdDeSecao.set(destino.id, destino);
      }
      destino.items.push(item);
      presentes.add(item.id);
    }
  }

  for (const section of sections) {
    section.items.sort((a, b) => a.order - b.order);
  }

  return {
    ...vivo,
    sections,
    // A condição desta inspeção é a que ela congelou. Roteiro novo não traz
    // regra nova para dentro de vistoria em andamento (contrato § 6.2).
    rules: congelado.rules,
    routingQuestions: congelado.routingQuestions,
  };
}
