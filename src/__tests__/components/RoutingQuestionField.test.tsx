// ============================================================
// COND-05 — a pergunta de roteamento na tela.
//
// Ela é usada no wizard de criação e, no COND-08, em campo. O que estes testes
// travam é o que não pode divergir entre os dois lugares: o que sai do controle
// é o VALOR da opção (nunca o rótulo), múltipla escolha soma e tira, e a
// pergunta se anuncia como opcional ou obrigatória.
// ============================================================

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RoutingQuestionField } from '../../components/inspection/RoutingQuestionField';
import type { RoutingQuestion } from '../../domain/applicability';

const MODALIDADE: RoutingQuestion = {
  id: 'q-modalidade',
  text: 'O processamento é próprio ou terceirizado?',
  type: 'single_choice',
  askAt: 'wizard',
  required: true,
  options: [
    { value: 'proprio', label: 'Próprio' },
    { value: 'terc', label: 'Terceirizado' },
  ],
};

const EQUIPAMENTOS: RoutingQuestion = {
  id: 'q-equipamentos',
  text: 'Quais equipamentos existem?',
  type: 'multi_choice',
  askAt: 'wizard',
  options: [
    { value: 'autoclave', label: 'Autoclave' },
    { value: 'laser', label: 'Laser' },
  ],
};

const SALAS: RoutingQuestion = {
  id: 'q-salas',
  text: 'Quantas salas de procedimento?',
  type: 'number',
  askAt: 'wizard',
  helpText: 'Conte só as salas em uso.',
};

describe('RoutingQuestionField', () => {
  test('escolha única devolve o valor da opção, não o rótulo clicado', () => {
    const onChange = vi.fn();
    render(<RoutingQuestionField question={MODALIDADE} answer={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Terceirizado'));
    expect(onChange).toHaveBeenCalledWith('terc', undefined);
  });

  test('múltipla escolha acumula e tira sem perder o resto', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RoutingQuestionField question={EQUIPAMENTOS} answer={['autoclave']} onChange={onChange} />
    );

    fireEvent.click(screen.getByLabelText('Laser'));
    expect(onChange).toHaveBeenCalledWith(['autoclave', 'laser'], undefined);

    rerender(<RoutingQuestionField question={EQUIPAMENTOS} answer={['autoclave', 'laser']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Autoclave'));
    expect(onChange).toHaveBeenLastCalledWith(['laser'], undefined);
  });

  test('número devolve número, e campo vazio limpa a resposta', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RoutingQuestionField question={SALAS} answer={undefined} onChange={onChange} />);

    // O controle é `type="number"`: texto que não é número o navegador nem
    // entrega. A recusa com mensagem existe para quem chama o domínio direto
    // (ver parseRoutingAnswer em src/__tests__/domain/routingQuestions.test.ts).
    const campo = screen.getByLabelText(/Quantas salas/);
    fireEvent.change(campo, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(3, undefined);

    rerender(<RoutingQuestionField question={SALAS} answer={3} onChange={onChange} />);
    fireEvent.change(campo, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null, undefined);
  });

  test('a pergunta diz se é obrigatória ou opcional, e mostra a ajuda', () => {
    const { rerender } = render(
      <RoutingQuestionField question={MODALIDADE} answer={undefined} onChange={vi.fn()} />
    );
    expect(screen.getByText(MODALIDADE.text).textContent).not.toContain('(opcional)');

    rerender(<RoutingQuestionField question={EQUIPAMENTOS} answer={undefined} onChange={vi.fn()} />);
    expect(screen.getByText(EQUIPAMENTOS.text).textContent).toContain('(opcional)');

    rerender(<RoutingQuestionField question={SALAS} answer={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Conte só as salas em uso.')).toBeTruthy();
  });

  test('escolha sem opção configurada avisa em vez de sumir da tela', () => {
    render(
      <RoutingQuestionField
        question={{ id: 'q-vazia', text: 'Sem opções', type: 'single_choice', options: [] }}
        answer={undefined}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/ainda não tem opções configuradas/)).toBeTruthy();
  });
});
