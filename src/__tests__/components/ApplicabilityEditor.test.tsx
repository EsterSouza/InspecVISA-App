// ============================================================
// COND-06 — as duas telas do editor de condições.
//
// O card tem dois aceites, e os dois são de comportamento, não de layout:
//   · nenhuma operação produz referência órfã **em silêncio**;
//   · rascunho inválido pode ser salvo, **nunca publicado**.
//
// A segunda metade é do serviço (suíte de domínio + `publishDraft`). Aqui fica a
// primeira: o que a tela deixa e o que ela **bloqueia**.
// ============================================================

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ApplicabilityFieldset } from '../../components/templates/ApplicabilityFieldset';
import { RoutingQuestionsPanel } from '../../components/templates/RoutingQuestionsPanel';
import { canRemoveOption, canRetireQuestion } from '../../domain/applicability';
import type { ApplicabilityRule, RoutingQuestion } from '../../domain/applicability';

const PROCESSA: RoutingQuestion = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos?',
  type: 'single_choice',
  askAt: 'execution',
  options: [
    { value: 'proprio', label: 'Próprio' },
    { value: 'terceirizado', label: 'Terceirizado' },
  ],
};

const REGRA: ApplicabilityRule = {
  id: 'r-1',
  target: { type: 'section', id: 'sec-2' },
  expression: {
    combinator: 'all',
    conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: 'proprio' }],
  },
  branch: 'if',
};

let contador = 0;
const makeId = () => `novo-${++contador}`;

// ── O construtor de condição ─────────────────────────────────

describe('ApplicabilityFieldset', () => {
  test('"Sempre aplicável" vem marcado quando o alvo não tem regra', () => {
    render(
      <ApplicabilityFieldset
        target={{ type: 'item', id: 'item-1' }}
        targetLabel="este item"
        questions={[PROCESSA]}
        onChange={vi.fn()}
        makeId={makeId}
      />
    );
    expect(screen.getByRole('radio', { name: /Sempre aplicável/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /sob condição/ })).not.toBeChecked();
  });

  test('escolher "sob condição" cria uma regra com uma condição em branco', () => {
    const onChange = vi.fn();
    render(
      <ApplicabilityFieldset
        target={{ type: 'item', id: 'item-1' }}
        targetLabel="este item"
        questions={[PROCESSA]}
        onChange={onChange}
        makeId={makeId}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: /sob condição/ }));

    const regra = onChange.mock.calls[0][0] as ApplicabilityRule;
    expect(regra.target).toEqual({ type: 'item', id: 'item-1' });
    expect(regra.expression.conditions).toHaveLength(1);
    expect(regra.branch).toBe('if');
  });

  test('voltar para "Sempre aplicável" apaga a regra em vez de deixar regra vazia', () => {
    const onChange = vi.fn();
    render(
      <ApplicabilityFieldset
        target={{ type: 'section', id: 'sec-2' }}
        targetLabel="esta seção"
        rule={REGRA}
        questions={[PROCESSA]}
        onChange={onChange}
        makeId={makeId}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: /Sempre aplicável/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('mostra o resumo em português, com o rótulo da opção e não o id', () => {
    render(
      <ApplicabilityFieldset
        target={{ type: 'section', id: 'sec-2' }}
        targetLabel="esta seção"
        rule={REGRA}
        questions={[PROCESSA]}
        onChange={vi.fn()}
        makeId={makeId}
      />
    );
    expect(
      screen.getByText('Exibida quando Realiza processamento de artigos? é igual a Próprio')
    ).toBeInTheDocument();
  });

  test('o operador oferecido é compatível com o tipo da fonte', () => {
    render(
      <ApplicabilityFieldset
        target={{ type: 'section', id: 'sec-2' }}
        targetLabel="esta seção"
        rule={REGRA}
        questions={[PROCESSA]}
        onChange={vi.fn()}
        makeId={makeId}
      />
    );
    const operador = screen.getByLabelText('Operador');
    const rotulos = within(operador).getAllByRole('option').map((o) => o.textContent);
    // Escolha única é texto: "é igual a" cabe, "é maior que" não.
    expect(rotulos).toContain('é igual a');
    expect(rotulos).not.toContain('é maior que');
  });

  test('trocar a fonte para um tipo incompatível troca o operador em vez de deixar regra impossível', () => {
    const onChange = vi.fn();
    const porTamanho: ApplicabilityRule = {
      ...REGRA,
      expression: {
        combinator: 'all',
        conditions: [{ source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 20 }],
      },
    };
    render(
      <ApplicabilityFieldset
        target={{ type: 'section', id: 'sec-2' }}
        targetLabel="esta seção"
        rule={porTamanho}
        questions={[PROCESSA]}
        onChange={onChange}
        makeId={makeId}
      />
    );

    // "é maior que" não existe para escolha única — não pode sobreviver à troca.
    fireEvent.change(screen.getByLabelText('Fonte da condição'), {
      target: { value: 'question:q-processa' },
    });

    const regra = onChange.mock.calls[0][0] as ApplicabilityRule;
    expect(regra.expression.conditions[0].operator).not.toBe('greater');
    expect(regra.expression.conditions[0].value).toBeUndefined();
  });

  test('pergunta com opção não vira campo livre — o valor sai de uma lista', () => {
    render(
      <ApplicabilityFieldset
        target={{ type: 'section', id: 'sec-2' }}
        targetLabel="esta seção"
        rule={REGRA}
        questions={[PROCESSA]}
        onChange={vi.fn()}
        makeId={makeId}
      />
    );
    const valor = screen.getByLabelText('Valor');
    expect(valor.tagName).toBe('SELECT');
    expect(within(valor).getAllByRole('option').map((o) => o.textContent)).toContain('Próprio');
  });

  test('a última condição não pode ser removida — regra sem condição não é regra', () => {
    render(
      <ApplicabilityFieldset
        target={{ type: 'section', id: 'sec-2' }}
        targetLabel="esta seção"
        rule={REGRA}
        questions={[PROCESSA]}
        onChange={vi.fn()}
        makeId={makeId}
      />
    );
    expect(screen.getByTitle('A regra precisa de pelo menos uma condição')).toBeDisabled();
  });
});

// ── As travas do ciclo de vida ───────────────────────────────

function painel(rules: ApplicabilityRule[], onChange = vi.fn()) {
  render(
    <RoutingQuestionsPanel
      questions={[PROCESSA]}
      rules={rules}
      sections={[{ id: 'sec-1', title: 'Contexto' }]}
      onChange={onChange}
      podeAposentar={(questionId) => canRetireQuestion({ rules }, questionId)}
      podeExcluirOpcao={(questionId, value) => canRemoveOption({ rules }, questionId, value)}
      makeId={makeId}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Expandir pergunta' }));
  return onChange;
}

describe('RoutingQuestionsPanel — travas do ciclo de vida', () => {
  test('aposentar pergunta controladora é bloqueado, com o motivo na tela', () => {
    painel([REGRA]);
    expect(screen.getByRole('button', { name: /Aposentar pergunta/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled();
  });

  test('sem dependente, aposentar é liberado', () => {
    painel([]);
    expect(screen.getByRole('button', { name: /Aposentar pergunta/ })).toBeEnabled();
  });

  test('lista quem depende da pergunta, em português', () => {
    painel([REGRA]);
    expect(screen.getByText('Quem depende desta pergunta')).toBeInTheDocument();
    expect(
      screen.getByText(/Exibida quando Realiza processamento de artigos\? é igual a Próprio/)
    ).toBeInTheDocument();
  });

  test('excluir opção citada por regra é bloqueado', () => {
    painel([REGRA]);
    const botao = screen.getByTitle(/Esta opção é citada por 1 regra/);
    expect(botao).toBeDisabled();
  });

  test('opção não citada continua excluível', () => {
    const onChange = painel([REGRA]);
    fireEvent.click(screen.getByTitle('Excluir opção'));
    const questions = onChange.mock.calls[0][0] as RoutingQuestion[];
    expect(questions[0].options?.map((o) => o.value)).toEqual(['proprio']);
  });

  test('renomear a opção não mexe no id que a regra guarda', () => {
    const onChange = painel([REGRA]);
    const campos = screen.getAllByLabelText('Rótulo da opção');
    fireEvent.change(campos[0], { target: { value: 'Processamento próprio' } });

    const questions = onChange.mock.calls[0][0] as RoutingQuestion[];
    expect(questions[0].options?.[0]).toEqual({ value: 'proprio', label: 'Processamento próprio' });
  });

  test('renomear a pergunta não mexe no id que a regra guarda', () => {
    const onChange = painel([REGRA]);
    fireEvent.change(screen.getByDisplayValue(PROCESSA.text), {
      target: { value: 'Faz processamento aqui dentro?' },
    });

    const questions = onChange.mock.calls[0][0] as RoutingQuestion[];
    expect(questions[0].id).toBe('q-processa');
    expect(questions[0].text).toBe('Faz processamento aqui dentro?');
  });
});
