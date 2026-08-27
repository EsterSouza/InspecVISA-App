import { describe, expect, test } from 'vitest';
import { getEffectiveTemplate, getTemplateById } from '../../data/templates';
import { suplementoAlimentosRioDeJaneiro } from '../../data/alimentos/suplemento-rio-de-janeiro';
import type { ChecklistTemplate, Client } from '../../types';

const base = getTemplateById('tpl-alimentos-federal-v1') as ChecklistTemplate;

function client(city: string, foodTypes: Client['foodTypes']): Client {
  return { state: 'RJ', city, foodTypes } as Client;
}

describe('roteiro de alimentos — Município do Rio', () => {
  test('aplica os módulos japonês e delivery somente à capital e aos segmentos selecionados', () => {
    const cut = new Date('2026-08-27T00:00:00.000Z');
    const rio = getEffectiveTemplate(base, client('Rio de Janeiro', ['pescados_crus', 'dark_kitchen']), undefined, true, cut);
    const niteroi = getEffectiveTemplate(base, client('Niterói', ['pescados_crus', 'dark_kitchen']), undefined, true, cut);

    expect(rio.sections.some(section => section.id === 'sec-ali-rio-geral-v2')).toBe(true);
    expect(rio.sections.some(section => section.id === 'sec-ali-rio-japones-v2')).toBe(true);
    expect(rio.sections.some(section => section.id === 'sec-ali-rio-delivery-v2')).toBe(true);
    expect(rio.sections.flatMap(section => section.items)).toHaveLength(139);
    expect(niteroi.sections.some(section => section.id.startsWith('sec-ali-rio-'))).toBe(false);
  });

  test('segue o percurso físico de inspeção sem retorno entre estações', () => {
    const effective = getEffectiveTemplate(base, client('Rio de Janeiro', ['pescados_crus', 'dark_kitchen']), undefined, true);
    const titles = effective.sections.map(section => section.title);
    const position = (part: string) => titles.findIndex(title => title.includes(part));

    expect(position('Regularização')).toBeLessThan(position('Edificação'));
    expect(position('Edificação')).toBeLessThan(position('Recepção'));
    expect(position('Recepção')).toBeLessThan(position('Armazenamento'));
    expect(position('Armazenamento')).toBeLessThan(position('Equipamentos'));
    expect(position('Equipamentos')).toBeLessThan(position('Produção'));
    expect(position('Produção')).toBeLessThan(position('Culinária Oriental'));
    expect(position('Culinária Oriental')).toBeLessThan(position('Exposição'));
    expect(position('Exposição')).toBeLessThan(position('Transporte de Alimentos'));
    expect(position('Transporte de Alimentos')).toBeLessThan(position('Delivery e Transporte'));
    expect(position('Delivery e Transporte')).toBeLessThan(position('Higienização'));
    expect(position('Higienização')).toBeLessThan(position('Manipuladores'));
    expect(position('Manipuladores')).toBeLessThan(position('Documentação'));
  });

  test('mantém perguntas municipais atômicas e criticidade coerente com o peso', () => {
    const items = (suplementoAlimentosRioDeJaneiro.newSections || []).flatMap(section => section.items);

    expect(items).toHaveLength(46);
    expect(items.every(item => item.description.endsWith('?'))).toBe(true);
    expect(items.every(item => item.isCritical ? item.weight === 10 : item.weight < 10)).toBe(true);
    expect(items.every(item => !/Porto Alegre|Fortaleza|45\.585\/2018/i.test(item.legislation || ''))).toBe(true);
  });

  test('não mostra seções de segmento não selecionado', () => {
    const effective = getEffectiveTemplate(base, client('Rio de Janeiro', ['servico_alimentacao']), undefined, true);

    expect(effective.sections.some(section => section.id === 'sec-ali-rio-geral-v2')).toBe(true);
    expect(effective.sections.some(section => section.id === 'sec-ali-rio-japones-v2')).toBe(false);
    expect(effective.sections.some(section => section.id === 'sec-ali-rio-delivery-v2')).toBe(false);
  });

  test('UUID remoto usa o conteúdo federal canônico atualizado sem perder sua identidade', () => {
    const remote: ChecklistTemplate = {
      id: '84adbc41-1785-43c1-8e74-e24b6264ea7b',
      name: 'Roteiro de Inspeção — Serviços de Alimentação (Nacional)',
      category: 'alimentos',
      version: 'legado',
      sections: [{ id: 'uuid-legado', title: 'Conteúdo legado', order: 1, items: [] }],
    };

    const effective = getEffectiveTemplate(
      remote,
      client('Rio de Janeiro', ['pescados_crus']),
      undefined,
      true,
      new Date('2026-08-27T00:00:00.000Z'),
    );

    expect(effective.id).toBe(remote.id);
    expect(effective.version).toBe('08/2026');
    expect(effective.sections.some(section => section.id === 'uuid-legado')).toBe(false);
    expect(effective.sections.some(section => section.id === 'sec-ali-fed-01')).toBe(true);
    expect(effective.sections.flatMap(section => section.items).some(item => item.id === 'ali-f-061')).toBe(false);
  });
});
