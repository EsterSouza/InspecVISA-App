import { describe, expect, test } from 'vitest';
import { buildClientActionItems, deadlineToDays } from '../../utils/clientActionPlan';
import type { ChecklistItem, InspectionResponse } from '../../types';

function response(overrides: Partial<InspectionResponse> = {}): InspectionResponse {
  return {
    id: 'resp-1',
    inspectionId: 'insp-1',
    itemId: 'item-1',
    result: 'not_complies',
    createdAt: new Date('2026-03-10T12:00:00Z'),
    updatedAt: new Date('2026-03-10T12:00:00Z'),
    syncStatus: 'synced',
    ...overrides,
  };
}

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item-1',
    sectionId: 'sec-1',
    order: 1,
    description: 'Possuir alvará sanitário vigente',
    weight: 5,
    isCritical: false,
    ...overrides,
  };
}

const inspectionDate = new Date(2026, 2, 10); // 10/03/2026 local

describe('P360-010 - prazo em texto livre', () => {
  test('converte as sugestões do formulário', () => {
    expect(deadlineToDays('Imediato')).toBe(0);
    expect(deadlineToDays('24 horas')).toBe(1);
    expect(deadlineToDays('7 dias')).toBe(7);
    expect(deadlineToDays('90 dias')).toBe(90);
    expect(deadlineToDays('2 semanas')).toBe(14);
    expect(deadlineToDays('3 meses')).toBe(90);
  });

  test('reconhece frases claramente imediatas como prazo 0', () => {
    expect(deadlineToDays('Imediatamente')).toBe(0);
    expect(deadlineToDays('URGENTE')).toBe(0);
    expect(deadlineToDays('imediata')).toBe(0);
  });

  test('devolve null para texto que não dá para datar, em vez de inventar prazo', () => {
    // "assim que possível" e "o quanto antes" são urgentes mas indatáveis: não se inventa data.
    expect(deadlineToDays('assim que possível')).toBeNull();
    expect(deadlineToDays('o quanto antes')).toBeNull();
    expect(deadlineToDays('')).toBeNull();
    expect(deadlineToDays(undefined)).toBeNull();
    expect(deadlineToDays('próxima visita')).toBeNull();
  });
});

describe('P360-010 - projeção do plano de ação', () => {
  test('data o prazo a partir da visita', () => {
    const [projected] = buildClientActionItems(
      [response({ deadline: '30 dias' })],
      [item()],
      inspectionDate
    );
    expect(projected.due_date).toBe('2026-04-09');
  });

  test('prazo imediato vence no dia da visita e prazo indatável não vira data', () => {
    const [immediate] = buildClientActionItems([response({ deadline: 'Imediato' })], [item()], inspectionDate);
    expect(immediate.due_date).toBe('2026-03-10');

    const [vague] = buildClientActionItems([response({ deadline: 'a combinar' })], [item()], inspectionDate);
    expect(vague.due_date).toBeUndefined();
  });

  test('prioriza igual ao plano de ação do PDF: crítico, peso >= 5, resto', () => {
    const responses = [
      response({ id: 'r1', itemId: 'critico' }),
      response({ id: 'r2', itemId: 'importante' }),
      response({ id: 'r3', itemId: 'leve' }),
    ];
    const items = [
      item({ id: 'critico', isCritical: true, weight: 10 }),
      item({ id: 'importante', weight: 5 }),
      item({ id: 'leve', weight: 1 }),
    ];
    expect(buildClientActionItems(responses, items, inspectionDate).map((i) => i.priority)).toEqual([
      'urgent',
      'important',
      'recommended',
    ]);
  });

  test('preenche texto padrão quando a consultora não digitou achado nem ação', () => {
    const [projected] = buildClientActionItems([response()], [item()], inspectionDate);
    expect(projected.title).toBe('Possuir alvará sanitário vigente');
    expect(projected.situation).toMatch(/Achado registrado durante a visita/);
    expect(projected.recommended_action).toMatch(/Definir medida corretiva/);
    expect(projected.responsible).toBeUndefined();
  });

  test('item fora do roteiro usa a descrição digitada pela consultora', () => {
    const [projected] = buildClientActionItems(
      [response({ itemId: 'avulso', customDescription: 'Item acrescentado na visita' })],
      [item()],
      inspectionDate
    );
    expect(projected.title).toBe('Item acrescentado na visita');
    expect(projected.priority).toBe('recommended');
  });

  test('leva situação, ação e responsável digitados', () => {
    const [projected] = buildClientActionItems(
      [
        response({
          situationDescription: '  Alvará vencido desde janeiro.  ',
          correctiveAction: 'Protocolar renovação.',
          responsible: ' Direção técnica ',
        }),
      ],
      [item()],
      inspectionDate
    );
    expect(projected.situation).toBe('Alvará vencido desde janeiro.');
    expect(projected.recommended_action).toBe('Protocolar renovação.');
    expect(projected.responsible).toBe('Direção técnica');
  });
});
