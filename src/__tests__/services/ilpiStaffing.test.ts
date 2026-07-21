import { describe, expect, test } from 'vitest';
import { calcFederalCaregivers, calcRJCaregivers } from '../../utils/ilpiStaffing';
import { isRioState } from '../../utils/state';

describe('calcFederalCaregivers (RDC 502/2021)', () => {
  test('uses plain ceil(residents / ratio) per grau, no artificial floor', () => {
    // Grau I=1, Grau II=5, Grau III=1 → 1 + 1 + 1 = 3 (not padded up to 5)
    expect(calcFederalCaregivers(1, 5, 1)).toEqual({ grau1: 1, grau2: 1, grau3: 1, total: 3 });
  });
});

describe('calcRJCaregivers (Lei 8.049/2018 RJ)', () => {
  test('Grau III uses 1:8 ratio', () => {
    expect(calcRJCaregivers(1, 5, 1)).toEqual({ grau1: 1, grau2: 1, grau3: 1, total: 3 });
  });
});

describe('isRioState', () => {
  test('matches RJ despite trailing/leading whitespace', () => {
    expect(isRioState('RJ ')).toBe(true);
    expect(isRioState(' Rio de Janeiro')).toBe(true);
  });

  test('rejects other states', () => {
    expect(isRioState('Goiás')).toBe(false);
    expect(isRioState(undefined)).toBe(false);
  });
});
