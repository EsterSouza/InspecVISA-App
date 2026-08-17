import { describe, expect, test } from 'vitest';
import {
  buildRequirementIndex,
  normalizeRequirementText,
  remapItemsToTemplate,
} from '../../utils/itemIdentity';
import type { ChecklistTemplate } from '../../types';

/** Trecho do roteiro do banco: os mesmos requisitos do estático, com id UUID. */
const template = {
  sections: [
    {
      id: 'sec-uuid-1',
      title: 'Estrutura Física',
      items: [
        { id: 'uuid-dml', sectionId: 'sec-uuid-1', order: 1, weight: 10, isCritical: true,
          description: 'Possui ambiente para guarda de material de limpeza (DML), provido de tanque.' },
        { id: 'uuid-sala', sectionId: 'sec-uuid-1', order: 2, weight: 5, isCritical: false,
          description: 'Possui sala para atividades de assistência individualizada e sigilosa.' },
      ],
    },
  ],
} as unknown as ChecklistTemplate;

describe('mesmo requisito, id diferente', () => {
  test('normaliza acento, caixa e pontuação', () => {
    expect(normalizeRequirementText('Possui SALA para assistência, sigilosa.'))
      .toBe(normalizeRequirementText('possui sala para assistencia sigilosa'));
    expect(normalizeRequirementText(undefined)).toBe('');
  });

  test('índice casa a descrição com o id do roteiro atual', () => {
    const index = buildRequirementIndex(template);
    expect(index.get(normalizeRequirementText('Possui ambiente para guarda de material de limpeza (DML), provido de tanque.')))
      .toBe('uuid-dml');
  });

  test('descrição repetida no mesmo roteiro fica fora do índice', () => {
    const repetido = {
      sections: [{
        id: 's', title: 's', items: [
          { id: 'a', description: 'Item igual' },
          { id: 'b', description: 'Item igual' },
        ],
      }],
    } as unknown as ChecklistTemplate;
    expect(buildRequirementIndex(repetido).size).toBe(0);
  });

  test('pendência do roteiro antigo ganha o id equivalente', () => {
    const [remapped] = remapItemsToTemplate(
      [{ itemId: 'fed-009', description: 'Possui ambiente para guarda de material de limpeza (DML), provido de tanque.' }],
      template,
    );
    expect(remapped.itemId).toBe('uuid-dml');
  });

  test('id que ainda existe no roteiro não é tocado', () => {
    const [remapped] = remapItemsToTemplate(
      [{ itemId: 'uuid-sala', description: 'Texto que mudou de redação depois' }],
      template,
    );
    expect(remapped.itemId).toBe('uuid-sala');
  });

  test('item extra tem a seção remapeada pelo título, não o id', () => {
    const [remapped] = remapItemsToTemplate(
      [{
        itemId: 'extra|sec-fed-01|abc',
        description: 'Cama hospitalar com defeito',
        sectionTitle: 'Estrutura Física',
        customItemMeta: { sectionId: 'sec-fed-01', order: 30 },
      }],
      template,
    );
    expect(remapped.customItemMeta.sectionId).toBe('sec-uuid-1');
    expect(remapped.itemId).toBe('extra|sec-fed-01|abc');
  });

  test('item extra de seção que não existe mais sai inalterado', () => {
    const [remapped] = remapItemsToTemplate(
      [{
        itemId: 'extra|sec-fed-99|abc',
        description: 'Achado avulso',
        sectionTitle: 'Seção que sumiu do roteiro',
        customItemMeta: { sectionId: 'sec-fed-99', order: 1 },
      }],
      template,
    );
    expect(remapped.customItemMeta.sectionId).toBe('sec-fed-99');
  });

  test('requisito sem equivalente sai inalterado, para o filtro decidir', () => {
    const [remapped] = remapItemsToTemplate(
      [{ itemId: 'rj-s12-009', description: 'Conta com profissional de terapia ocupacional.' }],
      template,
    );
    expect(remapped.itemId).toBe('rj-s12-009');
  });
});
