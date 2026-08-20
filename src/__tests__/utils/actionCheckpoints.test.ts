import { describe, expect, test } from 'vitest';
import { checkpointKey, parseCheckpoints } from '../../utils/actionCheckpoints';

describe('parseCheckpoints', () => {
  test('texto corrido não vira lista', () => {
    const texto =
      'O estabelecimento mantém o piso da cozinha em estado de conservação insuficiente, ' +
      'com trincas que impedem a higienização adequada e favorecem o acúmulo de sujidade.';
    expect(parseCheckpoints(texto)).toEqual({ context: texto, points: [] });
  });

  test('traço no início da linha vira tarefa', () => {
    const { context, points } = parseCheckpoints(
      '- Providenciar dispenser de papel toalha\n- Substituir a lixeira sem tampa\n- Implementar POP de higienização'
    );
    expect(context).toBe('');
    expect(points).toEqual([
      'Providenciar dispenser de papel toalha',
      'Substituir a lixeira sem tampa',
      'Implementar POP de higienização',
    ]);
  });

  test('um traço só já é uma tarefa', () => {
    expect(parseCheckpoints('- Providenciar dispenser de papel toalha').points).toEqual([
      'Providenciar dispenser de papel toalha',
    ]);
  });

  test('texto antes do primeiro marcador vira contexto, não tarefa', () => {
    const { context, points } = parseCheckpoints(
      'Foi observado o seguinte na área de manipulação:\n- Bancada com trinca\n- Torneira com vazamento'
    );
    expect(context).toBe('Foi observado o seguinte na área de manipulação:');
    expect(points).toEqual(['Bancada com trinca', 'Torneira com vazamento']);
  });

  test('numeração com parêntese e com ponto', () => {
    expect(parseCheckpoints('1) Providenciar RT\n2) Afixar o alvará\n3. Atualizar o PGRSS').points).toEqual([
      'Providenciar RT',
      'Afixar o alvará',
      'Atualizar o PGRSS',
    ]);
  });

  test('bolinha e asterisco também contam', () => {
    expect(parseCheckpoints('• Trocar o filtro\n* Limpar o duto').points).toEqual([
      'Trocar o filtro',
      'Limpar o duto',
    ]);
  });

  test('linha quebrada no meio da frase continua o tópico anterior', () => {
    expect(
      parseCheckpoints('- Providenciar contrato com empresa\nlicenciada para coleta\n- Guardar os manifestos').points
    ).toEqual(['Providenciar contrato com empresa licenciada para coleta', 'Guardar os manifestos']);
  });

  test('marcador vazio é ignorado', () => {
    expect(parseCheckpoints('- Trocar a lixeira\n-\n- ').points).toEqual(['Trocar a lixeira']);
  });

  test('o formato que os botões da tela de inspeção produzem', () => {
    // ChecklistItem escreve `- Providenciar ` e emenda o próximo com ` \n- `.
    expect(parseCheckpoints('- Providenciar sabonete líquido \n- Adequar a altura da pia').points).toEqual([
      'Providenciar sabonete líquido',
      'Adequar a altura da pia',
    ]);
  });

  test('hífen no meio do texto não vira marcador', () => {
    const texto = 'Sala 2 - climatização insuficiente, medida em 28 graus no dia da visita.';
    expect(parseCheckpoints(texto)).toEqual({ context: texto, points: [] });
  });

  test('medida decimal no início não vira numeração', () => {
    const texto = '1.5 m de afastamento entre as macas, abaixo do exigido.';
    expect(parseCheckpoints(texto).points).toEqual([]);
  });

  test('vazio não quebra', () => {
    expect(parseCheckpoints('')).toEqual({ context: '', points: [] });
    expect(parseCheckpoints(null)).toEqual({ context: '', points: [] });
    expect(parseCheckpoints(undefined)).toEqual({ context: '', points: [] });
  });
});

describe('checkpointKey', () => {
  test('a mesma frase produz a mesma chave, apesar de acento, caixa e pontuação', () => {
    expect(checkpointKey('Providenciar dispenser de papel toalha')).toBe(
      checkpointKey('PROVIDENCIAR DISPENSER DE PAPEL TOALHA.')
    );
    expect(checkpointKey('Implementar POP de higienização')).toBe(
      checkpointKey('implementar pop de higienizacao')
    );
  });

  test('frase reescrita produz chave diferente — é outra tarefa', () => {
    expect(checkpointKey('Trocar a lixeira sem tampa')).not.toBe(
      checkpointKey('Trocar a lixeira sem tampa por uma com pedal')
    );
  });
});
