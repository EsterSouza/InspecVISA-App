// ============================================================
// "Importar Base Padrão" travando — a sincronização da biblioteca de legislação.
//
// O botão ficava rodando sem fim e, quando terminava, o que aparecia era o toast
// de erro. A causa não estava no servidor: `seedStandardLegislations` fazia um
// UPDATE por verbete, **em série**, para os 135 da base curada — e fazia isso
// TODA vez, mesmo quando nada tinha mudado. Do navegador, mais de um minuto de
// requisições enfileiradas, que entopem o pool de conexões do host (6 por vez em
// HTTP/1.1) e derrubam por timeout as chamadas vizinhas da mesma página: a lista
// de legislações, os roteiros do admin, as configurações. O erro que a tela
// mostrava era o do vizinho, não o da sincronização.
//
// O que este arquivo tranca:
//   1. base já alinhada → NENHUM update sai;
//   2. só a linha que mudou é gravada;
//   3. o que é editável no admin não é sobrescrito por ressemeadura;
//   4. as gravações saem em blocos, não uma a uma até o fim.
// ============================================================

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LEGISLATION_LIBRARY } from '@visa/legislacao';

const updateSpy = vi.fn();
const insertSpy = vi.fn();
let linhasNoBanco: Record<string, unknown>[] = [];
/** Quantas gravações estavam voando ao mesmo tempo, no pico. */
let emVoo = 0;
let picoDeParalelismo = 0;

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: linhasNoBanco, error: null }),
      insert: (linhas: unknown[]) => {
        insertSpy(linhas);
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_coluna: string, id: string) => {
          updateSpy(id, patch);
          emVoo += 1;
          picoDeParalelismo = Math.max(picoDeParalelismo, emVoo);
          return new Promise((resolve) => {
            setTimeout(() => {
              emVoo -= 1;
              resolve({ error: null });
            }, 0);
          });
        },
      }),
    }),
  },
}));

const { LegislationService } = await import('../../services/legislationService');

/** A tabela exatamente como a curadoria a deixaria — o estado normal em produção. */
function bancoAlinhado() {
  return LEGISLATION_LIBRARY.map((verbete, i) => ({
    id: `id-${i}`,
    name: verbete.name,
    authority: verbete.authority,
    summary: verbete.summary,
    url: verbete.url,
    abnt: verbete.abnt ?? null,
    research_notes: verbete.researchNotes ?? null,
    uf: verbete.uf ?? null,
    municipio: verbete.municipio ?? null,
    segments: verbete.segments && verbete.segments.length ? verbete.segments : null,
    status: verbete.status,
    replaced_by: verbete.replacedBy ?? null,
  }));
}

beforeEach(() => {
  updateSpy.mockClear();
  insertSpy.mockClear();
  emVoo = 0;
  picoDeParalelismo = 0;
  linhasNoBanco = bancoAlinhado();
});

describe('Importar Base Padrão · o que não muda não é gravado', () => {
  test('base já alinhada não dispara UPDATE nenhum', async () => {
    const { inseridas, atualizadas } = await LegislationService.seedStandardLegislations();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(inseridas).toBe(0);
    expect(atualizadas).toBe(0);
  });

  test('a base curada tem 135 verbetes — é o tamanho da fila que existia antes', () => {
    // Se este número crescer muito, o bloco de 8 continua segurando; o que não
    // pode voltar é a gravação incondicional.
    expect(LEGISLATION_LIBRARY.length).toBeGreaterThan(100);
    expect(linhasNoBanco).toHaveLength(LEGISLATION_LIBRARY.length);
  });

  test('só a linha que divergiu é gravada', async () => {
    linhasNoBanco[3] = { ...linhasNoBanco[3], status: 'nao_verificado', uf: 'ZZ' };

    const { atualizadas } = await LegislationService.seedStandardLegislations();

    expect(atualizadas).toBe(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toBe('id-3');
  });

  test('verbete que falta é inserido, e sem varrer os demais', async () => {
    const removido = linhasNoBanco.pop()!;

    const { inseridas, atualizadas } = await LegislationService.seedStandardLegislations();

    expect(inseridas).toBe(1);
    expect(atualizadas).toBe(0);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect((insertSpy.mock.calls[0][0] as { name: string }[])[0].name).toBe(removido.name);
  });
});

describe('Importar Base Padrão · o que a consultora editou é preservado', () => {
  test('ementa e URL escritas no admin não são desfeitas pela ressemeadura', async () => {
    linhasNoBanco[5] = {
      ...linhasNoBanco[5],
      summary: 'Ementa que a consultora reescreveu à mão',
      url: 'https://exemplo.gov.br/corrigido',
      status: 'nao_verificado', // força a linha a entrar na fila
    };

    await LegislationService.seedStandardLegislations();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [, patch] = updateSpy.mock.calls[0];
    expect(patch.summary).toBe('Ementa que a consultora reescreveu à mão');
    expect(patch.url).toBe('https://exemplo.gov.br/corrigido');
    // Vigência, porém, vem sempre da curadoria — é o que o pacote centraliza.
    expect(patch.status).toBe(LEGISLATION_LIBRARY[5].status);
  });

  test('campo vazio no banco é preenchido pela curadoria', async () => {
    linhasNoBanco[7] = { ...linhasNoBanco[7], abnt: null, status: 'nao_verificado' };

    await LegislationService.seedStandardLegislations();

    const [, patch] = updateSpy.mock.calls[0];
    expect(patch.abnt).toBe(LEGISLATION_LIBRARY[7].abnt ?? null);
  });
});

describe('Importar Base Padrão · a fila não volta a ser uma por vez', () => {
  test('com muita coisa para gravar, as requisições saem em bloco', async () => {
    // Trinta linhas divergentes: em série o pico de paralelismo seria 1.
    for (let i = 0; i < 30; i += 1) {
      linhasNoBanco[i] = { ...linhasNoBanco[i], status: 'nao_verificado' };
    }

    const { atualizadas } = await LegislationService.seedStandardLegislations();

    expect(atualizadas).toBe(30);
    expect(updateSpy).toHaveBeenCalledTimes(30);
    expect(picoDeParalelismo).toBeGreaterThan(1);
    expect(picoDeParalelismo).toBeLessThanOrEqual(8);
  });
});
