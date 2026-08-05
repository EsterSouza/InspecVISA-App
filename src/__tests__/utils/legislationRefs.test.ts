import { describe, expect, test } from 'vitest';
import { canonicalLegislationKey, extractBaseLegislation } from '../../utils/legislationRefs';

describe('legislationRefs — regressão do bug achado no REF-01', () => {
  test('"Art. N, Lei Municipal ..." gera a mesma base e a mesma chave que a citação limpa', () => {
    const comArtigo = extractBaseLegislation('Art. 276, Lei Municipal 1.812/2014');
    const semArtigo = extractBaseLegislation('Lei Municipal 1.812/2014');

    expect(comArtigo).toEqual(['Lei Municipal 1.812/2014']);
    expect(comArtigo).toEqual(semArtigo);
    expect(canonicalLegislationKey(comArtigo[0])).toBe(canonicalLegislationKey(semArtigo[0]));
    expect(canonicalLegislationKey(comArtigo[0])).toBe('LEI|1812|2014');
  });

  test('artigos diferentes da mesma lei municipal não fragmentam a chave canônica', () => {
    const grafias = [
      'Art. 276, Lei Municipal 1.812/2014',
      'Art. 276 IV, Lei Municipal 1.812/2014',
      'Art. 277, Lei Municipal 1.812/2014',
      'Art. 289, Lei Municipal 1.812/2014',
    ];
    const keys = new Set(
      grafias.flatMap(raw => extractBaseLegislation(raw)).map(canonicalLegislationKey)
    );
    expect(keys).toEqual(new Set(['LEI|1812|2014']));
  });

  test('reconhece "Lei Municipal RJ nº ..." com sigla de UF entre o qualificador e o número', () => {
    const bases = extractBaseLegislation('Lei Municipal RJ nº 8.618/2024');
    expect(bases).toEqual(['Lei Municipal RJ nº 8.618/2024']);
    expect(canonicalLegislationKey(bases[0])).toBe('LEI|8618|2024');
  });

  test('reconhece "Lei Ordinária" como qualificador válido', () => {
    const bases = extractBaseLegislation('Lei Ordinária nº 8.049/2018');
    expect(bases).toEqual(['Lei Ordinária nº 8.049/2018']);
    expect(canonicalLegislationKey(bases[0])).toBe('LEI|8049|2018');
  });

  test('não regride os qualificadores que já funcionavam (Federal, Estadual, Complementar, sem qualificador)', () => {
    expect(canonicalLegislationKey(extractBaseLegislation('Lei Federal nº 10.741/2003')[0])).toBe('LEI|10741|2003');
    expect(canonicalLegislationKey(extractBaseLegislation('Art. 48 da Lei 10.741/2003')[0])).toBe('LEI|10741|2003');
    expect(canonicalLegislationKey(extractBaseLegislation('Lei nº 6.360/1976')[0])).toBe('LEI|6360|1976');
  });

  test('canonicalLegislationKey ancora a busca do número no tipo reconhecido mesmo sem passar por extractBaseLegislation', () => {
    // Defesa em profundidade: mesmo um texto bruto, não limpo por extractBaseLegislation,
    // não pode ter um número de artigo anterior ao tipo confundido com o número do ato.
    expect(canonicalLegislationKey('Art. 276, Lei Municipal 1.812/2014')).toBe('LEI|1812|2014');
    expect(canonicalLegislationKey('Parágrafo 5, RDC 502/2021')).toBe('RDC|502|2021');
  });
});
