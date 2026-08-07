import { describe, expect, test } from 'vitest';
import { filterUnitsBySelection } from '../../utils/clientPortalFormat';

const units = [
  { client_id: 'a', client_name: 'Unidade A' },
  { client_id: 'b', client_name: 'Unidade B' },
];

describe('P360-009 - filterUnitsBySelection', () => {
  test('sem seleção (null), devolve todas as unidades', () => {
    expect(filterUnitsBySelection(units, null)).toEqual(units);
  });

  test('com seleção, devolve só a unidade escolhida', () => {
    expect(filterUnitsBySelection(units, 'b')).toEqual([units[1]]);
  });

  test('voltar para null depois de filtrar restaura "Todas"', () => {
    const filtered = filterUnitsBySelection(units, 'a');
    expect(filtered).toEqual([units[0]]);
    const restored = filterUnitsBySelection(units, null);
    expect(restored).toEqual(units);
  });

  test('conta com uma única unidade: filtro por ela mesma devolve a lista de 1', () => {
    const single = [units[0]];
    expect(filterUnitsBySelection(single, 'a')).toEqual(single);
  });

  test('conta sem unidades: filtro em lista vazia devolve lista vazia', () => {
    expect(filterUnitsBySelection([], null)).toEqual([]);
    expect(filterUnitsBySelection([], 'a')).toEqual([]);
  });
});
