import { describe, expect, test } from 'vitest';
import { toDateKey } from '../../utils/date';

describe('toDateKey', () => {
  // A regressão do commit 45f4adc: `new Date(...).toISOString().split('T')[0]`
  // devolvia 17/08 para as 21:20 do dia 16 em UTC-3. Como `new Date(y, m, d, h, min)`
  // é sempre local, esta asserção quebra em qualquer fuso a oeste de Greenwich
  // se alguém trocar a implementação por toISOString().
  test('usa os componentes locais da data, não os de UTC', () => {
    expect(toDateKey(new Date(2026, 7, 16, 21, 20))).toBe('2026-08-16');
    expect(toDateKey(new Date(2026, 7, 16, 23, 59))).toBe('2026-08-16');
  });

  test('preenche mês e dia com zero à esquerda', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('a virada do ano fica no dia certo', () => {
    expect(toDateKey(new Date(2026, 11, 31, 22, 0))).toBe('2026-12-31');
  });
});
