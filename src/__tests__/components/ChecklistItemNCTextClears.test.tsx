import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ChecklistItem } from '../../components/inspection/ChecklistItem';
import type { ChecklistItem as ChecklistItemType, InspectionResponse } from '../../types';

const item: ChecklistItemType = {
  id: 'item-1',
  sectionId: 'section-1',
  order: 1,
  description: 'Item de teste',
  weight: 5,
  isCritical: false,
};

function baseResponse(overrides: Partial<InspectionResponse>): InspectionResponse {
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

describe('texto de não conformidade some ao marcar CUMPRE e volta ao desmarcar', () => {
  test('abre os detalhes ao clicar em NÃO CUMPRE', () => {
    const onChange = vi.fn();

    render(
      <ChecklistItem
        item={item}
        response={baseResponse({ result: 'complies' })}
        onChange={onChange}
        onUpdateDetails={vi.fn()}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Não cumpre' }));

    expect(onChange).toHaveBeenCalledWith(item.id, 'not_complies');
    expect(screen.getByRole('button', { name: 'Recolher' })).toBeInTheDocument();
  });

  test('sai da tela e do relatório ao virar CUMPRE, e volta se apertar NÃO CUMPRE de novo', () => {
    const onUpdateDetails = vi.fn();

    let response = baseResponse({
      result: 'not_complies',
      situationDescription: 'Mofo na parede',
      correctiveAction: 'Pintar a parede',
    });

    const { rerender } = render(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Mofo na parede')).toBeInTheDocument();

    // Consultora marca CUMPRE: o pai atualiza o result, o texto da NC continua
    // no response até este efeito rodar e mandar limpar.
    response = { ...response, result: 'complies' };
    rerender(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    expect(onUpdateDetails).toHaveBeenCalledWith(item.id, {
      situationDescription: '',
      correctiveAction: '',
    });

    // Simula o pai aplicando a limpeza.
    response = { ...response, situationDescription: '', correctiveAction: '' };
    rerender(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    expect(screen.queryByDisplayValue('Mofo na parede')).not.toBeInTheDocument();

    onUpdateDetails.mockClear();

    // Consultora aperta NÃO CUMPRE de novo por engano: o texto tem que voltar.
    response = { ...response, result: 'not_complies' };
    rerender(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    expect(onUpdateDetails).toHaveBeenCalledWith(item.id, {
      situationDescription: 'Mofo na parede',
      correctiveAction: 'Pintar a parede',
    });
  });

  test('não sobrescreve texto novo já digitado quando volta para NÃO CUMPRE', () => {
    const onUpdateDetails = vi.fn();

    let response = baseResponse({
      result: 'not_complies',
      situationDescription: 'Mofo na parede',
      correctiveAction: 'Pintar a parede',
    });

    const { rerender } = render(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    // Vira CUMPRE e o pai aplica a limpeza (como no outro teste).
    response = { ...response, result: 'complies', situationDescription: '', correctiveAction: '' };
    rerender(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    onUpdateDetails.mockClear();

    // Enquanto está CUMPRE, ela escreve um elogio de verdade no mesmo campo.
    response = { ...response, situationDescription: 'Ambiente impecável' };
    rerender(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    // Volta para NÃO CUMPRE: o elogio novo não pode ser substituído pelo texto
    // antigo guardado.
    response = { ...response, result: 'not_complies' };
    rerender(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={onUpdateDetails}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    );

    expect(onUpdateDetails).not.toHaveBeenCalledWith(item.id, {
      situationDescription: 'Mofo na parede',
      correctiveAction: 'Pintar a parede',
    });
    expect(screen.getByDisplayValue('Ambiente impecável')).toBeInTheDocument();
  });
});
