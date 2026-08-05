import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { PdfPreviewModal } from '../../components/inspection/PdfPreviewModal';
import type { ChecklistTemplate, Inspection, InspectionResponse } from '../../types';

const template: ChecklistTemplate = {
  id: 'tpl-1',
  name: 'Roteiro de Teste',
  category: 'estetica',
  version: '1',
  sections: [],
};

const inspection: Inspection = {
  id: 'insp-1',
  clientId: 'client-1',
  templateId: 'tpl-1',
  consultantName: 'Ester Caiafa',
  inspectionDate: new Date('2026-08-01T00:00:00.000Z'),
  status: 'in_progress',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  syncStatus: 'synced',
};

const responses: InspectionResponse[] = [];

function renderModal(overrides: Partial<ComponentProps<typeof PdfPreviewModal>> = {}) {
  const onGenerate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <PdfPreviewModal
      open
      onClose={onClose}
      template={template}
      responses={responses}
      inspection={inspection}
      onGenerate={onGenerate}
      isGenerating={false}
      {...overrides}
    />
  );
  return { onGenerate, onClose };
}

function goToSourcesStep() {
  fireEvent.click(screen.getByText('Próximo')); // passo 1 -> 2
}

describe('REF-03 - PdfPreviewModal, passo Fontes Consultadas', () => {
  test('adiciona uma fonte com título e nota, e ela some da lista se removida', () => {
    renderModal();
    goToSourcesStep();

    fireEvent.change(screen.getByLabelText('Link *'), { target: { value: 'https://www.gov.br/anvisa/nota-tecnica' } });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nota técnica ANVISA' } });
    fireEvent.change(screen.getByLabelText('Nota (opcional)'), { target: { value: 'consultado em 05/08/2026' } });
    fireEvent.click(screen.getByText('Adicionar fonte'));

    expect(screen.getByText('Nota técnica ANVISA')).toBeInTheDocument();
    expect(screen.getByText('https://www.gov.br/anvisa/nota-tecnica')).toBeInTheDocument();
    expect(screen.getByText('consultado em 05/08/2026')).toBeInTheDocument();

    // o formulário limpa depois de adicionar
    expect((screen.getByLabelText('Link *') as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByLabelText('Remover fonte Nota técnica ANVISA'));
    expect(screen.queryByText('Nota técnica ANVISA')).not.toBeInTheDocument();
  });

  test('usa a URL como rótulo quando não há título', () => {
    renderModal();
    goToSourcesStep();

    fireEvent.change(screen.getByLabelText('Link *'), { target: { value: 'https://example.com/laudo' } });
    fireEvent.click(screen.getByText('Adicionar fonte'));

    // sem título, a URL aparece duplicada: como rótulo (title) e como subtítulo (url)
    expect(screen.getAllByText('https://example.com/laudo')).toHaveLength(2);
  });

  test('rejeita link vazio e link sem http/https, sem adicionar a fonte', () => {
    renderModal();
    goToSourcesStep();

    fireEvent.click(screen.getByText('Adicionar fonte'));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o link da fonte.');

    fireEvent.change(screen.getByLabelText('Link *'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByText('Adicionar fonte'));
    expect(screen.getByRole('alert')).toHaveTextContent('Link inválido');

    expect(screen.getByText('Nenhuma fonte adicionada. O relatório sai sem essa seção, sem problema.')).toBeInTheDocument();
  });

  test('pré-carrega fontes já salvas na inspeção ao abrir', () => {
    renderModal({
      inspection: {
        ...inspection,
        referenceSources: [{ id: 'src-1', url: 'https://example.com/existente', title: 'Fonte existente' }],
      },
    });
    goToSourcesStep();

    expect(screen.getByText('Fonte existente')).toBeInTheDocument();
  });

  test('gerar PDF repassa as fontes consultadas para onGenerate', async () => {
    const { onGenerate } = renderModal();
    goToSourcesStep();

    fireEvent.change(screen.getByLabelText('Link *'), { target: { value: 'https://example.com/fonte' } });
    fireEvent.click(screen.getByText('Adicionar fonte'));

    fireEvent.click(screen.getByText('Próximo')); // passo 2 -> 3 (assinatura)
    fireEvent.click(screen.getByLabelText('Pular assinatura'));
    fireEvent.click(screen.getByText('Gerar PDF'));

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceSources: [expect.objectContaining({ url: 'https://example.com/fonte' })],
      })
    );
  });
});
