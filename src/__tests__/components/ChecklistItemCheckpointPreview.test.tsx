import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ChecklistItem } from '../../components/inspection/ChecklistItem';
import type { ChecklistItem as ChecklistItemType, InspectionResponse } from '../../types';

const item: ChecklistItemType = {
  id: 'item-1',
  sectionId: 'section-1',
  order: 1,
  description: 'Lavatório exclusivo para higienização das mãos',
  weight: 10,
  isCritical: true,
};

function responseWith(overrides: Partial<InspectionResponse>): InspectionResponse {
  return {
    id: 'response-1',
    inspectionId: 'inspection-1',
    itemId: item.id,
    result: 'not_complies',
    photos: [],
    createdAt: new Date('2026-08-12T12:00:00Z'),
    updatedAt: new Date('2026-08-12T12:00:00Z'),
    syncStatus: 'synced',
    ...overrides,
  };
}

function renderItem(response: InspectionResponse) {
  return render(
    <ChecklistItem
      item={item}
      response={response}
      onChange={vi.fn()}
      onUpdateDetails={vi.fn()}
      onAddPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
    />
  );
}

describe('preview das tarefas na tela de inspeção', () => {
  test('mostra em quantas tarefas o texto vai se dividir, e quais são', () => {
    renderItem(responseWith({
      correctiveAction: '- Providenciar dispenser de sabonete\n- Substituir a lixeira por uma com pedal',
    }));

    expect(screen.getByText('2 tarefas — o cliente responde uma por uma')).toBeInTheDocument();
    expect(screen.getByText('Providenciar dispenser de sabonete')).toBeInTheDocument();
    expect(screen.getByText('Substituir a lixeira por uma com pedal')).toBeInTheDocument();
  });

  test('um traço só já conta como uma tarefa, no singular', () => {
    renderItem(responseWith({ correctiveAction: '- Providenciar dispenser de sabonete' }));
    expect(screen.getByText('1 tarefa — o cliente responde uma por uma')).toBeInTheDocument();
  });

  test('parágrafo corrido não anuncia tarefa nenhuma', () => {
    renderItem(responseWith({
      correctiveAction: 'Recuperar o revestimento do piso com material liso, impermeável e lavável.',
      situationDescription: 'O piso apresenta trincas longitudinais que impedem a higienização.',
    }));

    expect(screen.queryByText(/tarefas? — o cliente responde/)).not.toBeInTheDocument();
    expect(screen.queryByText(/em destaque no relatório/)).not.toBeInTheDocument();
  });

  test('os tópicos da situação são anunciados como destaque, não como tarefa', () => {
    renderItem(responseWith({
      situationDescription: 'Foi observado o seguinte:\n- Lavatório sem sabonete\n- Lixeira sem pedal',
    }));

    expect(screen.getByText('2 pontos em destaque no relatório')).toBeInTheDocument();
    expect(screen.queryByText(/o cliente responde uma por uma/)).not.toBeInTheDocument();
  });
});
