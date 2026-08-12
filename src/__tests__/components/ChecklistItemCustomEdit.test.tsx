import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ChecklistItem } from '../../components/inspection/ChecklistItem';
import type { ChecklistItem as ChecklistItemType, InspectionResponse } from '../../types';

const item: ChecklistItemType = {
  id: 'extra|section-1|item-1',
  sectionId: 'section-1',
  order: 3,
  description: 'Item extra persistente',
  weight: 5,
  isCritical: false,
};

const response: InspectionResponse = {
  id: 'response-1',
  inspectionId: 'inspection-1',
  itemId: item.id,
  result: 'not_observed',
  customDescription: item.description,
  customItemMeta: {
    sectionId: item.sectionId,
    order: item.order,
    weight: 5,
    isCritical: false,
    state: 'active',
  },
  photos: [],
  createdAt: new Date('2026-08-12T12:00:00Z'),
  updatedAt: new Date('2026-08-12T12:00:00Z'),
  syncStatus: 'synced',
};

describe('edição de item extra durante a inspeção', () => {
  test('oferece ação acessível e entrega o ID estável ao formulário de edição', () => {
    const onEdit = vi.fn();
    render(
      <ChecklistItem
        item={item}
        response={response}
        onChange={vi.fn()}
        onUpdateDetails={vi.fn()}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar item extra Item extra persistente/i }));
    expect(onEdit).toHaveBeenCalledWith(item.id);
  });
});
