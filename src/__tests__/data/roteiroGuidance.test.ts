// ============================================================
// Campo `guidance` — a orientação de campo do item do roteiro.
//
// O campo existe porque a alternativa era pior. Os números de dimensionamento
// da RDC 50 não cabem na `description`: reescrever a pergunta no lugar troca o
// sentido de resposta já gravada (REF-05), e cravar "7,50 m²" em `sau-031`
// ESTREITARIA um requisito que hoje cobre consultório indiferenciado,
// diferenciado e sala de exames e procedimentos, cada um com o seu mínimo.
//
// O que esta suíte tranca:
//   1. a orientação nunca vira pergunta — `description` e `guidance` são campos
//      distintos, e nenhum item tem os dois com o mesmo texto;
//   2. a orientação não entra no score — nenhum item ganhou ou perdeu peso ou
//      criticidade ao receber orientação;
//   3. os números conferidos contra o PDF da RDC 50 estão lá, com o endereço
//      (parte/item/tabela) junto — número sem endereço é o que já existia;
//   4. o campo atravessa o congelamento do relatório, que é um clone JSON.
// ============================================================

import { describe, expect, test } from 'vitest';
import { templateEsteticaClinica } from '../../data/estetica/roteiro-clinica';
import { templateServicosSaude } from '../../data/saude/roteiro-servicos-saude';
import type { ChecklistItem } from '../../types';

const ITENS: ChecklistItem[] = templateServicosSaude.sections.flatMap(secao => secao.items);

function item(id: string): ChecklistItem {
  const achado = ITENS.find(i => i.id === id);
  if (!achado) throw new Error(`item ${id} não existe no roteiro`);
  return achado;
}

describe('guidance · a orientação nunca vira pergunta', () => {
  test('todo item com orientação continua com a sua própria pergunta', () => {
    const comOrientacao = ITENS.filter(i => i.guidance);
    expect(comOrientacao.length).toBeGreaterThan(0);
    for (const i of comOrientacao) {
      expect(i.description.trim()).not.toBe(i.guidance!.trim());
      expect(i.description.trim().length).toBeGreaterThan(0);
    }
  });

  test('a pergunta de sau-031 segue genérica — é o motivo de o campo existir', () => {
    // Se alguém "melhorar" isto cravando 7,50 m² na pergunta, o item deixa de
    // servir para consultório diferenciado e para sala de procedimentos.
    const sau031 = item('sau-031');
    expect(sau031.description).not.toMatch(/7,5|2,2/);
    expect(sau031.guidance).toMatch(/7,5 m²/);
    expect(sau031.guidance).toMatch(/6,0 m²/);
  });

  test('orientação em branco não existe: ou tem texto, ou o campo não vem', () => {
    for (const i of ITENS) {
      if (i.guidance !== undefined) expect(i.guidance.trim()).not.toBe('');
    }
  });
});

describe('guidance · não mexe no score', () => {
  test('o MARP só lê weight e isCritical, e nenhum dos dois mudou', () => {
    // Peso e criticidade dos itens que receberam orientação, como estavam antes.
    const esperado: Record<string, { weight: number; isCritical: boolean }> = {
      'sau-002': { weight: 10, isCritical: true },
      'sau-010': { weight: 10, isCritical: true },
      'sau-011': { weight: 10, isCritical: true },
      'sau-025': { weight: 10, isCritical: true },
      'sau-026': { weight: 10, isCritical: true },
      'sau-027': { weight: 10, isCritical: true },
      'sau-029': { weight: 10, isCritical: true },
      'sau-031': { weight: 10, isCritical: true },
      'sau-032': { weight: 10, isCritical: true },
      'sau-033': { weight: 10, isCritical: true },
      'sau-034': { weight: 10, isCritical: true },
      'sau-035': { weight: 5, isCritical: false },
      'sau-036': { weight: 10, isCritical: true },
      'sau-037': { weight: 10, isCritical: true },
      'sau-041': { weight: 5, isCritical: false },
      'sau-042': { weight: 5, isCritical: false },
      'sau-047': { weight: 10, isCritical: true },
    };
    for (const [id, esperados] of Object.entries(esperado)) {
      const i = item(id);
      expect(i.guidance, `${id} deveria ter orientação`).toBeTruthy();
      expect({ weight: i.weight, isCritical: i.isCritical }, id).toEqual(esperados);
    }
  });
});

describe('guidance · número sempre com endereço na norma', () => {
  // Cada linha: item, um número que precisa estar lá, e o endereço que o
  // sustenta. Número solto é o que a consultora já tinha de decorar.
  const CONFERIDOS: [string, RegExp, RegExp][] = [
    ['sau-031', /7,5 m² com dimensão mínima de 2,2 m/, /Parte II, item 3.*Unidade Funcional 1/],
    ['sau-032', /9,0 m² sem área de limpeza/, /Parte II, item 3.*Unidade Funcional 4/],
    ['sau-037', /2,0 m² com dimensão mínima de 1,0 m/, /Unidade Funcional 8.*atividade 8\.7/],
    ['sau-041', /1,50 m quando, por sua localização, se destinem ao uso de pacientes/, /Parte III, item 4/],
    ['sau-042', /1,50 m de diâmetro/, /NBR 9050/],
    ['sau-026', /não superior a 4%/, /Parte III, item 6\.2, C\.1/],
    ['sau-025', /meia-cana não é exigência da RDC 50/, /Parte III, item 6\.2, C\.2/],
  ];

  test.each(CONFERIDOS)('%s traz o número e o endereço', (id, numero, endereco) => {
    const orientacao = item(id).guidance!;
    expect(orientacao).toMatch(numero);
    expect(orientacao).toMatch(endereco);
  });

  test('sau-037 avisa da linha vizinha que quase entrou no lugar', () => {
    // A extração de texto do PDF embaralha as colunas da tabela e faz o 4,0 m²
    // da sala de utilidades parecer do DML. Quem reler a norma cai na mesma
    // armadilha; o aviso fica no próprio texto.
    expect(item('sau-037').guidance).toMatch(/Sala de utilidades com pia de despejo/);
    expect(item('sau-037').guidance).toMatch(/4,0 m²/);
  });

  test('sau-029 registra o que a norma NÃO exige', () => {
    // "Iluminação natural" só aparece na bibliografia da RDC 50. O item existia
    // e cobrava mais do que a norma pede.
    expect(item('sau-029').guidance).toMatch(/NÃO exige iluminação nem ventilação naturais/);
  });

  test('sau-002 lista os CNAEs e diz de quem é a decisão', () => {
    const orientacao = item('sau-002').guidance!;
    for (const codigo of ['8630-5/03', '8630-5/01', '8630-5/02', '8650-0/01', '9602-5/02']) {
      expect(orientacao, codigo).toContain(codigo);
    }
    expect(orientacao).toMatch(/escolha do código é do contador/);
  });
});

describe('guidance · atravessa o congelamento do relatório', () => {
  test('sobrevive ao clone JSON que congela o roteiro na inspeção', () => {
    // `reportTemplate.ts` congela por `JSON.parse(JSON.stringify(template))`.
    // Campo novo passa por construção — este teste é o alarme para o dia em que
    // alguém trocar o clone por uma cópia campo a campo.
    const congelado = JSON.parse(JSON.stringify(templateServicosSaude)) as typeof templateServicosSaude;
    const original = item('sau-031');
    const depois = congelado.sections
      .flatMap(s => s.items)
      .find(i => i.id === 'sau-031');
    expect(depois?.guidance).toBe(original.guidance);
  });
});

// ============================================================
// O mesmo campo no roteiro de estética, que é o mais usado da consultoria e
// estava sem nenhuma orientação. Os 12 itens abaixo receberam a leitura de
// norma já conferida contra o PDF da RDC 50 — e `est-023` carrega a biblioteca
// de revestimentos inteira, porque este roteiro não tem o item separado de
// revestimento que o de saúde tem.
// ============================================================

const ITENS_EST: ChecklistItem[] = templateEsteticaClinica.sections.flatMap(secao => secao.items);

function itemEst(id: string): ChecklistItem {
  const achado = ITENS_EST.find(i => i.id === id);
  if (!achado) throw new Error(`item ${id} não existe no roteiro de estética`);
  return achado;
}

describe('guidance · roteiro de estética', () => {
  const PESOS: Record<string, { weight: number; isCritical: boolean }> = {
    'est-002': { weight: 10, isCritical: true },
    'est-010': { weight: 10, isCritical: true },
    'est-023': { weight: 10, isCritical: true },
    'est-024': { weight: 10, isCritical: true },
    'est-026': { weight: 10, isCritical: true },
    'est-027': { weight: 10, isCritical: true },
    'est-028': { weight: 10, isCritical: true },
    'est-029': { weight: 10, isCritical: true },
    'est-030': { weight: 10, isCritical: true },
    'est-032': { weight: 2, isCritical: false },
    'est-036': { weight: 10, isCritical: true },
    'est-038': { weight: 10, isCritical: true },
  };

  test('os itens orientados são exatamente os previstos, e nenhum mudou de peso', () => {
    const comOrientacao = ITENS_EST.filter(i => i.guidance).map(i => i.id).sort();
    expect(comOrientacao).toEqual(Object.keys(PESOS).sort());
    for (const [id, esperados] of Object.entries(PESOS)) {
      const i = itemEst(id);
      expect({ weight: i.weight, isCritical: i.isCritical }, id).toEqual(esperados);
    }
  });

  test('a orientação nunca vira pergunta, e nunca vem vazia', () => {
    for (const i of ITENS_EST) {
      if (i.guidance === undefined) continue;
      expect(i.guidance.trim(), i.id).not.toBe('');
      expect(i.description.trim(), i.id).not.toBe(i.guidance.trim());
    }
  });

  test('est-023 carrega a régua dos 4% com o endereço e os grupos da ABNT', () => {
    // O critério de área crítica é objetivo — absorção de água — e é o que
    // decide na ficha técnica do produto. Sem os grupos, a consultora volta a
    // depender de "parece liso e lavável".
    const g = itemEst('est-023').guidance!;
    expect(g).toMatch(/Parte III, item 6\.2/);
    expect(g).toMatch(/não superior a 4%/);
    for (const grupo of ['BIa', 'BIb', 'BIIa', 'BIII']) expect(g, grupo).toContain(grupo);
    expect(g).toMatch(/rejunte/);
    expect(g).toMatch(/meia-cana não é exigência dela/);
    expect(g).toMatch(/forro falso removível proibido/);
  });

  test('est-027 separa os três sanitários que se confundem', () => {
    const g = itemEst('est-027').guidance!;
    expect(g).toMatch(/ginecologia, proctologia e urologia/);
    expect(g).toMatch(/adicional ao do público, não o substitui/);
    expect(g).toMatch(/1,50 m de DIÂMETRO/);
  });

  test('est-036 checa o escopo da RDC 15 antes de cobrar o art. 44', () => {
    const g = itemEst('est-036').guidance!;
    expect(g).toMatch(/art\. 3º, parágrafo único/);
    expect(g).toMatch(/consultório individualizado/);
  });

  test('mobiliário: mesma pergunta nos dois roteiros, mesma orientação', () => {
    // est-024 e sau-027 têm a description idêntica. Se um dia divergirem, a
    // consultora recebe duas respostas diferentes para a mesma pergunta.
    expect(itemEst('est-024').description).toBe(item('sau-027').description);
    expect(itemEst('est-024').guidance).toBe(item('sau-027').guidance);
  });

  test('sobrevive ao clone JSON que congela o roteiro na inspeção', () => {
    const congelado = JSON.parse(JSON.stringify(templateEsteticaClinica)) as typeof templateEsteticaClinica;
    const depois = congelado.sections.flatMap(s => s.items).find(i => i.id === 'est-023');
    expect(depois?.guidance).toBe(itemEst('est-023').guidance);
  });
});
