import { describe, expect, test } from 'vitest';
import { canonicalLegislationKey, citedLegislations, extractBaseLegislation } from '../../utils/legislationRefs';
import type { ChecklistTemplate, InspectionResponse } from '../../types';

describe('citedLegislations — o que fundamenta aquele relatório', () => {
  const template = {
    sections: [{
      id: 's1',
      items: [
        { id: 'i1', legislation: 'RDC 63/2011' },
        { id: 'i2', legislation: 'RDC 222/2018' },
        { id: 'i3', legislation: 'Lei Municipal 1.812/2014' },
      ],
    }],
  } as unknown as ChecklistTemplate;

  const resposta = (itemId: string, extra: Partial<InspectionResponse> = {}) => ({
    id: `r-${itemId}`, itemId, result: 'conforme', ...extra,
  }) as InspectionResponse;

  test('lista apenas as normas dos itens avaliados', () => {
    // i3 não foi avaliado: a lei municipal não fundamenta este relatório.
    expect(citedLegislations(template, [resposta('i1'), resposta('i2')]))
      .toEqual(['RDC 222/2018', 'RDC 63/2011']);
  });

  test('ignora resposta substituída por reavaliação posterior', () => {
    // O modal olhava todas as respostas, inclusive as antigas, e por isso listava
    // norma de item que a consultora já tinha reavaliado como não aplicável.
    const antiga = resposta('i1', { createdAt: new Date('2026-01-01') } as Partial<InspectionResponse>);
    const nova = resposta('i1', { id: 'r-i1-nova', createdAt: new Date('2026-02-01') } as Partial<InspectionResponse>);
    expect(citedLegislations(template, [antiga, nova])).toEqual(['RDC 63/2011']);
  });

  test('item sem resposta nenhuma não entra', () => {
    expect(citedLegislations(template, [])).toEqual([]);
  });
});

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

  test('número com ponto de milhar não é cortado — "RE Anvisa nº 2.605/2006"', () => {
    // Antes do REF-02 o padrão de RDC/RE só aceitava \d+, então "2.605" virava "2"
    // e a mesma resolução aparecia como dois atos diferentes no inventário.
    const comPonto = extractBaseLegislation('RE Anvisa nº 2.605/2006');
    expect(comPonto).toEqual(['RE Anvisa nº 2.605/2006']);
    expect(canonicalLegislationKey(comPonto[0])).toBe('RE|2605|2006');
    expect(canonicalLegislationKey(extractBaseLegislation('RE 2605/2006')[0])).toBe('RE|2605|2006');
  });

  test('ano de dois dígitos colado ao número resolve para o ano cheio', () => {
    expect(canonicalLegislationKey(extractBaseLegislation('Portaria SVS/MS nº 344/98')[0])).toBe('PORTARIA|344|1998');
    expect(canonicalLegislationKey(extractBaseLegislation('Portaria SVS/MS 344/1998')[0])).toBe('PORTARIA|344|1998');
    expect(canonicalLegislationKey(extractBaseLegislation('Decreto-Rio 45585/18')[0])).toBe('DECRETO|45585|2018');
    expect(canonicalLegislationKey(extractBaseLegislation('Portaria 2616/98')[0])).toBe('PORTARIA|2616|1998');
  });

  test('não confunde sufixo de norma sem ano com ano de dois dígitos', () => {
    expect(canonicalLegislationKey(extractBaseLegislation('NR-32')[0])).toBe('NR|32|');
    expect(canonicalLegislationKey(extractBaseLegislation('NR 24')[0])).toBe('NR|24|');
    expect(canonicalLegislationKey('CBO 5162-10 - Cuidador de Idosos')).toBe('CBO|5162|');
  });

  test('zeros à esquerda não criam ato novo', () => {
    expect(canonicalLegislationKey('Nota Técnica 02/2024/ANVISA'))
      .toBe(canonicalLegislationKey('Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA'));
    expect(canonicalLegislationKey('Portaria IVISA-RIO 002/2020')).toBe('PORTARIA|2|2020');
  });

  test('artigo solto não vira ato normativo', () => {
    // "Art. 21; Art. 24, II da RDC 502/2021" chegava a produzir a base "Art. 21",
    // que o inventário do REF-01 contava como um ato (chave OUTRO|21|).
    expect(extractBaseLegislation('Art. 21; Art. 24, II da RDC 502/2021')).toEqual(['RDC 502/2021']);
    expect(extractBaseLegislation('Art. 21; Art. 51; Art. 46, IV da RDC 502/2021')).toEqual(['RDC 502/2021']);
    expect(extractBaseLegislation('Art. 21')).toEqual([]);
  });

  test('não engole texto sem forma normativa que não seja artigo solto', () => {
    expect(extractBaseLegislation('Boas Práticas; manual do fabricante'))
      .toEqual(['Boas Práticas', 'manual do fabricante']);
  });

  test('canonicalLegislationKey ancora a busca do número no tipo reconhecido mesmo sem passar por extractBaseLegislation', () => {
    // Defesa em profundidade: mesmo um texto bruto, não limpo por extractBaseLegislation,
    // não pode ter um número de artigo anterior ao tipo confundido com o número do ato.
    expect(canonicalLegislationKey('Art. 276, Lei Municipal 1.812/2014')).toBe('LEI|1812|2014');
    expect(canonicalLegislationKey('Parágrafo 5, RDC 502/2021')).toBe('RDC|502|2021');
  });
});
