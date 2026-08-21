import { fireEvent, render, screen } from '@testing-library/react';
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

function renderItem(response: InspectionResponse, onUpdateDetails = vi.fn()) {
  return render(
    <ChecklistItem
      item={item}
      response={response}
      onChange={vi.fn()}
      onUpdateDetails={onUpdateDetails}
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

describe('botoes de atalho da acao corretiva', () => {
  /** O texto que a tela mandou salvar no ultimo clique. */
  function clicar(acaoAtual: string, verbo: string): string {
    const onUpdateDetails = vi.fn();
    renderItem(responseWith({ correctiveAction: acaoAtual }), onUpdateDetails);
    fireEvent.click(screen.getByRole('button', { name: verbo }));
    return onUpdateDetails.mock.calls.at(-1)![1].correctiveAction;
  }

  test('clicar num segundo verbo troca o primeiro, que ficou pendurado', () => {
    // O caso real de agosto: ela clicou em Abolir, mudou de ideia e clicou em Adequar.
    // O primeiro sobrava sozinho na linha e virava uma tarefa chamada so "Abolir".
    expect(clicar('- Abolir ', 'Adequar')).toBe('- Adequar ');
  });

  test('topico ja escrito acima nao e tocado pela troca', () => {
    // O texto e a identidade do topico no portal: reescrever um topico completo mudaria
    // a chave dele e devolveria ao cliente, em branco, algo que ele ja pode ter marcado.
    const resultado = clicar('- Trocar a lixeira por uma com pedal \n- Abolir', 'Adequar');
    expect(resultado).toBe('- Trocar a lixeira por uma com pedal \n- Adequar ');
  });

  test('sem verbo pendurado, o clique continua acrescentando um topico', () => {
    expect(clicar('- Trocar a lixeira por uma com pedal', 'Providenciar'))
      .toBe('- Trocar a lixeira por uma com pedal \n- Providenciar ');
  });

  test('verbo pendurado no meio do texto nao e mexido', () => {
    // So o ultimo marcador e o que ela acabou de abrir; um verbo solto no meio ja foi
    // publicado assim e pode ter virado topico no portal.
    const resultado = clicar('- Abolir \n- Trocar a lixeira', 'Adequar');
    expect(resultado).toBe('- Abolir \n- Trocar a lixeira \n- Adequar ');
  });

  test('campo vazio abre o primeiro topico', () => {
    // Sem nenhum texto o painel nem abre, entao a situacao e quem o mantem em tela aqui.
    const onUpdateDetails = vi.fn();
    renderItem(responseWith({ situationDescription: 'Lixeira sem pedal.' }), onUpdateDetails);
    fireEvent.click(screen.getByRole('button', { name: 'Providenciar' }));
    expect(onUpdateDetails.mock.calls.at(-1)![1].correctiveAction).toBe('- Providenciar ');
  });
});
