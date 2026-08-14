import { describe, expect, test } from 'vitest';
import { isLegislationApplicable } from '../../services/legislationService';

const estadual = { uf: 'GO', segments: ['ilpi'] as const, status: 'vigente' as const };

describe('isLegislationApplicable — UF em texto livre', () => {
  // `client.state` é digitado à mão desde sempre. Antes só 'RJ', 'MG' e 'SP' (com e
  // sem acento) eram reconhecidos, então uma ILPI cadastrada como "Goias" saía com
  // zero legislação estadual no relatório — sem erro nenhum, só a lista vazia.
  test.each(['GO', 'go', ' Go ', 'Goiás', 'Goias', 'GOIAS', 'goiás'])(
    'reconhece o estado escrito como %j',
    (state) => {
      expect(isLegislationApplicable(estadual, state, 'ilpi')).toBe(true);
    }
  );

  test.each([undefined, null, '', 'SP', 'Tocantins'])(
    'não aplica norma de GO quando o estado é %j',
    (state) => {
      expect(isLegislationApplicable(estadual, state, 'ilpi')).toBe(false);
    }
  );

  test('respeita o segmento curado da norma estadual', () => {
    expect(isLegislationApplicable(estadual, 'Goiás', 'alimentos')).toBe(false);
  });

  test('norma revogada nunca é sugerida', () => {
    expect(isLegislationApplicable({ ...estadual, status: 'revogada' }, 'GO', 'ilpi')).toBe(false);
  });

  test('federal entra pelo segmento curado, não pela UF', () => {
    const federal = { uf: null, segments: ['estetica'] as const, status: 'vigente' as const };
    expect(isLegislationApplicable(federal, 'BA', 'estetica')).toBe(true);
    expect(isLegislationApplicable(federal, 'BA', 'ilpi')).toBe(false);
  });
});
