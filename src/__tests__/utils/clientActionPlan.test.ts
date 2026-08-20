import { describe, expect, test } from 'vitest';
import { buildClientActionItems, deadlineToDays, resolveRecurringDueDate } from '../../utils/clientActionPlan';
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

describe('prazo de pendência reincidente', () => {
  // Visita de 17/08/2026; a mesma regra roda no `on conflict` da RPC de publicação.
  const visita = new Date(2026, 7, 17);

  test('sem prazo pactuado, o prazo desta visita entra', () => {
    expect(resolveRecurringDueDate(null, '2026-10-16', visita)).toEqual({
      effective: '2026-10-16', kind: 'novo', expired: false,
    });
  });

  test('prazo pactuado longe do vencimento é mantido', () => {
    expect(resolveRecurringDueDate('2026-09-21', '2026-10-16', visita)).toEqual({
      effective: '2026-09-21', kind: 'mantido', expired: false,
    });
  });

  test('prazo vencido volta a ser negociável', () => {
    expect(resolveRecurringDueDate('2026-07-10', '2026-10-16', visita)).toEqual({
      effective: '2026-10-16', kind: 'repactuado', expired: true,
    });
  });

  test('prazo vencendo dentro da janela de 7 dias também é repactuado', () => {
    expect(resolveRecurringDueDate('2026-08-22', '2026-10-16', visita).kind).toBe('repactuado');
    expect(resolveRecurringDueDate('2026-08-25', '2026-10-16', visita).kind).toBe('mantido');
  });

  test('encurtar o prazo sempre vale', () => {
    expect(resolveRecurringDueDate('2026-09-21', '2026-08-24', visita)).toEqual({
      effective: '2026-08-24', kind: 'encurtado', expired: false,
    });
  });

  test('escolher "sem prazo" não apaga data pactuada que ainda vale', () => {
    expect(resolveRecurringDueDate('2026-09-21', undefined, visita).effective).toBe('2026-09-21');
    // Já vencida, é repactuação de verdade: fica sem data porque foi escolha.
    expect(resolveRecurringDueDate('2026-07-10', undefined, visita).effective).toBeUndefined();
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

  test('reincidência não reinicia o prazo já pactuado', () => {
    // Item ganhou 60 dias na visita de 08/02 (vence 09/04) e reaparece na visita
    // de 10/03, com "60 dias" outra vez: continua vencendo 09/04, não 09/05.
    const [projected] = buildClientActionItems(
      [response({ deadline: '60 dias' })],
      [item()],
      inspectionDate,
      [{ source_item_id: 'item-1', due_date: '2026-04-09', title: 'Possuir alvará sanitário vigente' }],
    );
    expect(projected.due_date).toBe('2026-04-09');
  });

  test('prazo vencido é repactuado a partir desta visita', () => {
    const [projected] = buildClientActionItems(
      [response({ deadline: '30 dias' })],
      [item()],
      inspectionDate,
      [{ source_item_id: 'item-1', due_date: '2026-02-01', title: 'Possuir alvará sanitário vigente' }],
    );
    expect(projected.due_date).toBe('2026-04-09');
  });

  test('roteiro novo, requisito antigo: a pendência do portal continua a mesma linha', () => {
    // A visita anterior rodou no roteiro estático (`fed-009`); esta roda no roteiro
    // do banco, com id UUID. Publicar com a chave nova criaria uma segunda pendência
    // do mesmo requisito no portal do cliente.
    const [projected] = buildClientActionItems(
      [response({ itemId: '1b0370f5-72b4-49c1-a60b-d08fcb3879a5', deadline: '30 dias' })],
      [item({ id: '1b0370f5-72b4-49c1-a60b-d08fcb3879a5', description: 'Possui ambiente para guarda de material de limpeza (DML).' })],
      inspectionDate,
      [{ source_item_id: 'fed-009', due_date: '2026-04-09', title: 'Possui ambiente para guarda de material de limpeza (DML).' }],
    );
    expect(projected.source_item_id).toBe('fed-009');
    expect(projected.due_date).toBe('2026-04-09');
  });

  test('título repetido em duas pendências abertas não casa por texto', () => {
    const [projected] = buildClientActionItems(
      [response({ itemId: 'novo-uuid' })],
      [item({ id: 'novo-uuid', description: 'Item repetido' })],
      inspectionDate,
      [
        { source_item_id: 'antigo-a', due_date: '2026-04-09', title: 'Item repetido' },
        { source_item_id: 'antigo-b', due_date: '2026-05-09', title: 'Item repetido' },
      ],
    );
    expect(projected.source_item_id).toBe('novo-uuid');
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

  // ─── PORT-05: os tópicos que o cliente vai marcar um a um ───────────────────

  test('a ação em tópicos vira uma tarefa por tópico, com chave estável', () => {
    const [projected] = buildClientActionItems(
      [response({ correctiveAction: '- Protocolar a renovação\n- Afixar o alvará na recepção' })],
      [item()],
      inspectionDate
    );

    expect(projected.checkpoints).toEqual([
      { key: 'protocolar a renovacao', text: 'Protocolar a renovação' },
      { key: 'afixar o alvara na recepcao', text: 'Afixar o alvará na recepção' },
    ]);
  });

  test('ação em parágrafo corrido não gera tarefa nenhuma', () => {
    const [projected] = buildClientActionItems(
      [response({ correctiveAction: 'Protocolar a renovação na vigilância municipal e afixar o alvará.' })],
      [item()],
      inspectionDate
    );
    expect(projected.checkpoints).toEqual([]);
  });

  test('tópico repetido não vai duas vezes — o upsert do banco morreria na segunda', () => {
    const [projected] = buildClientActionItems(
      [response({ correctiveAction: '- Trocar a lixeira\n- Pintar a parede\n- TROCAR A LIXEIRA.' })],
      [item()],
      inspectionDate
    );

    expect(projected.checkpoints?.map((checkpoint) => checkpoint.text)).toEqual([
      'Trocar a lixeira',
      'Pintar a parede',
    ]);
  });
});
