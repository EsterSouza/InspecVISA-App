// ============================================================
// COND-09 — "a tela diz qual é".
//
// O aceite do card exige que o resumo declare o denominador que usou. Este teste
// renderiza o cartão de resultado e confere as três linhas novas, incluindo a
// regra de silêncio: inspeção sem condicional não ganha "0 fora por regra".
// ============================================================

import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportScoreCard } from '../../components/inspection/ReportScoreCard';
import type { ResultsCounts } from '../../domain/applicability';
import type { ChecklistTemplate, InspectionResponse } from '../../types';

const TEMPLATE = {
  id: 'tpl',
  name: 'Roteiro',
  category: 'estetica',
  sections: [{
    id: 's1',
    title: 'Infraestrutura',
    items: [
      { id: 'i1', description: 'Piso lavável', weight: 5, isCritical: false },
      { id: 'i2', description: 'Lavatório', weight: 10, isCritical: true },
    ],
  }],
} as unknown as ChecklistTemplate;

const RESPOSTAS = [
  { id: 'r1', itemId: 'i1', result: 'complies' },
  { id: 'r2', itemId: 'i2', result: 'not_complies' },
] as unknown as InspectionResponse[];

const contagens = (extra: Partial<ResultsCounts> = {}): ResultsCounts => ({
  cadastrados: 4,
  aplicaveis: 2,
  foraPorRegra: 0,
  pendentes: 0,
  foraComResposta: 0,
  naArvore: 2,
  respondidos: 2,
  semResposta: 0,
  ...extra,
});

const montar = (counts?: ResultsCounts) => render(
  <ReportScoreCard
    template={TEMPLATE}
    responses={RESPOSTAS}
    previousVisit={null}
    isIlpi={false}
    recurringCount={0}
    counts={counts}
  />
);

describe('COND-09 · o resumo declara o denominador', () => {
  test('mostra quantos dos aplicáveis foram respondidos', () => {
    montar(contagens({ respondidos: 1, semResposta: 1 }));
    expect(screen.getByText('Requisitos respondidos')).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });

  test('inspeção sem condicional não ganha linha de "fora por regra"', () => {
    montar(contagens());
    expect(screen.queryByText(/Fora do roteiro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aguardando uma definição/)).not.toBeInTheDocument();
  });

  test('o que saiu por regra aparece, com quantas respostas ficaram guardadas', () => {
    montar(contagens({ cadastrados: 4, aplicaveis: 2, foraPorRegra: 2, foraComResposta: 2 }));
    expect(screen.getByText(/Fora do roteiro por não se aplicar/)).toBeInTheDocument();
    expect(screen.getByText(/2 com resposta guardada/)).toBeInTheDocument();
  });

  test('pendente de condição tem linha própria', () => {
    montar(contagens({ pendentes: 3 }));
    expect(screen.getByText('Aguardando uma definição para valer')).toBeInTheDocument();
  });

  test('sem contagens o cartão continua o de antes', () => {
    montar(undefined);
    expect(screen.queryByText('Requisitos respondidos')).not.toBeInTheDocument();
    expect(screen.getByText('Não conformidades críticas')).toBeInTheDocument();
  });
});
