import { describe, expect, test } from 'vitest';
import {
  aplicarAtualizacao,
  compararRoteiro,
  temAtualizacao,
} from '../../utils/atualizacaoDoRoteiro';
import type { ChecklistItem, ChecklistTemplate } from '../../types';

function item(id: string, extra: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id,
    sectionId: extra.sectionId ?? 'sec-1',
    order: extra.order ?? 1,
    description: extra.description ?? `Pergunta ${id}?`,
    weight: extra.weight ?? 10,
    isCritical: extra.isCritical ?? false,
    ...extra,
  } as ChecklistItem;
}

function roteiro(sections: ChecklistTemplate['sections'], extra: Partial<ChecklistTemplate> = {}): ChecklistTemplate {
  return {
    id: 'tpl-1',
    name: 'Roteiro',
    category: 'estetica',
    sections,
    ...extra,
  } as ChecklistTemplate;
}

describe('atualização da revisão congelada', () => {
  const congelado = roteiro([
    {
      id: 'sec-1',
      title: 'Documentação',
      order: 1,
      items: [item('a', { order: 1 }), item('b', { order: 2 })],
    },
  ] as ChecklistTemplate['sections'], {
    rules: [{ id: 'r1', target: { type: 'item', id: 'a' }, expression: { combinator: 'all', conditions: [] } }],
  } as Partial<ChecklistTemplate>);

  const vivo = roteiro([
    {
      id: 'sec-1',
      title: 'Documentação',
      order: 1,
      items: [
        item('a', { order: 1, requiredAction: '- Providenciar o alvará.' }),
        item('b', { order: 2 }),
        item('c', { order: 3 }),
      ],
    },
    {
      id: 'sec-13',
      title: 'Compartilhamento de Espaço',
      order: 13,
      items: [item('d', { sectionId: 'sec-13', order: 1 })],
    },
  ] as ChecklistTemplate['sections'], {
    rules: [{ id: 'r2', target: { type: 'item', id: 'd' }, expression: { combinator: 'all', conditions: [] } }],
  } as Partial<ChecklistTemplate>);

  test('o diff separa item novo de texto novo, e nomeia a seção que apareceu', () => {
    const diff = compararRoteiro(congelado, vivo);
    expect(diff.itensNovos.map(i => i.id)).toEqual(['c', 'd']);
    expect(diff.itensComTextoNovo.map(i => i.id)).toEqual(['a']);
    expect(diff.secoesNovas).toEqual(['Compartilhamento de Espaço']);
    expect(temAtualizacao(diff)).toBe(true);
  });

  test('roteiro igual não oferece atualização', () => {
    expect(temAtualizacao(compararRoteiro(vivo, vivo))).toBe(false);
  });

  test('a ação pela norma chega ao item que já estava lá', () => {
    const novo = aplicarAtualizacao(congelado, vivo, new Set(['a']));
    const a = novo.sections.flatMap(s => s.items).find(i => i.id === 'a');
    expect(a?.requiredAction).toBe('- Providenciar o alvará.');
  });

  test('item já respondido nunca some, mesmo saindo do roteiro vivo', () => {
    const vivoSemB = roteiro([
      { id: 'sec-1', title: 'Documentação', order: 1, items: [item('a', { order: 1 })] },
    ] as ChecklistTemplate['sections']);

    const comResposta = aplicarAtualizacao(congelado, vivoSemB, new Set(['b']));
    expect(comResposta.sections.flatMap(s => s.items).map(i => i.id)).toEqual(['a', 'b']);

    // Sem resposta, o item sai: é o roteiro vivo mandando, e não há nada a perder.
    const semResposta = aplicarAtualizacao(congelado, vivoSemB, new Set());
    expect(semResposta.sections.flatMap(s => s.items).map(i => i.id)).toEqual(['a']);
  });

  test('seção inteira que sumiu volta só com o que foi respondido', () => {
    const congeladoComDuas = roteiro([
      { id: 'sec-1', title: 'Documentação', order: 1, items: [item('a')] },
      { id: 'sec-9', title: 'Seção aposentada', order: 9, items: [item('x', { sectionId: 'sec-9', order: 1 }), item('y', { sectionId: 'sec-9', order: 2 })] },
    ] as ChecklistTemplate['sections']);
    const vivoSemSecao = roteiro([
      { id: 'sec-1', title: 'Documentação', order: 1, items: [item('a')] },
    ] as ChecklistTemplate['sections']);

    const novo = aplicarAtualizacao(congeladoComDuas, vivoSemSecao, new Set(['x']));
    const secao = novo.sections.find(s => s.id === 'sec-9');
    expect(secao?.items.map(i => i.id)).toEqual(['x']);
  });

  test('a condição continua sendo a da inspeção, não a do roteiro novo', () => {
    // Regra inegociável 10 pelo lado seguro: item novo entra visível, e vistoria
    // em andamento não passa a esconder requisito porque o mestre mudou.
    const novo = aplicarAtualizacao(congelado, vivo, new Set());
    expect(novo.rules?.map(r => r.id)).toEqual(['r1']);
  });

  test('os itens de cada seção saem em ordem', () => {
    const desordenado = roteiro([
      { id: 'sec-1', title: 'Documentação', order: 1, items: [item('c', { order: 3 }), item('a', { order: 1 })] },
    ] as ChecklistTemplate['sections']);
    const novo = aplicarAtualizacao(congelado, desordenado, new Set(['b']));
    expect(novo.sections[0].items.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });
});
