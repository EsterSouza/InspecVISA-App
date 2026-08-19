import { beforeEach, describe, expect, test, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}));

vi.mock('../../utils/localScope', () => ({
  getActiveTenantId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}));

import {
  ApplicabilityRevisionService,
  ApplicabilityValidationError,
  mapRevisionRow,
  toConditionalTemplate,
} from '../../services/applicabilityRevisionService';
import type { ChecklistTemplate } from '../../types';

/**
 * PostgREST encadeado: cada método devolve o próprio objeto, e o objeto é
 * aguardável em qualquer ponto da corrente — que é como o serviço o usa
 * (`.limit(1)` num caso, `.single()` no outro).
 */
type Resposta = { data: unknown; error: unknown };

const chamadas: { metodo: string; argumentos: unknown[] }[] = [];
let respostas: Resposta[] = [];

function filaDeConsultas() {
  const consulta: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'order', 'limit', 'update', 'insert', 'delete', 'single', 'maybeSingle']) {
    consulta[metodo] = (...argumentos: unknown[]) => {
      chamadas.push({ metodo, argumentos });
      return consulta;
    };
  }
  consulta.then = (resolve: (r: Resposta) => unknown) =>
    Promise.resolve(resolve(respostas.shift() ?? { data: null, error: null }));
  return consulta;
}

function linha(extra: Record<string, unknown> = {}) {
  return {
    id: 'rev-1',
    tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    template_id: 'tpl-estetica-v1',
    revision: 3,
    status: 'draft',
    rules: [],
    routing_questions: [],
    notes: null,
    published_at: null,
    updated_at: '2026-08-19T09:00:00Z',
    ...extra,
  };
}

const roteiro: ChecklistTemplate = {
  id: 'tpl-estetica-v1',
  name: 'Estética — roteiro base',
  category: 'estetica',
  version: '2026',
  sections: [
    {
      id: 'sec-processamento',
      title: 'Processamento de artigos',
      order: 1,
      items: [
        {
          id: 'item-autoclave',
          sectionId: 'sec-processamento',
          order: 1,
          description: 'Autoclave com registro de ciclo',
          weight: 5,
          isCritical: true,
        },
      ],
    },
  ],
};

const perguntaProcessamento = {
  id: 'q-processamento',
  text: 'Realiza processamento de artigos?',
  type: 'boolean' as const,
};

const regraValida = {
  id: 'rule-autoclave',
  target: { type: 'item' as const, id: 'item-autoclave' },
  expression: {
    combinator: 'all' as const,
    conditions: [
      { source: 'question' as const, field: 'q-processamento', operator: 'equals' as const, value: true },
    ],
  },
};

describe('COND-04 — persistência das revisões de aplicabilidade', () => {
  beforeEach(() => {
    chamadas.length = 0;
    respostas = [];
    from.mockReset();
    from.mockImplementation(() => filaDeConsultas());
  });

  test('roteiro sem revisão publicada devolve null — sem regra é o comportamento de hoje', async () => {
    respostas = [{ data: [], error: null }];

    const revisao = await ApplicabilityRevisionService.getPublishedRevision('tpl-estetica-v1');

    expect(revisao).toBeNull();
    expect(from).toHaveBeenCalledWith('checklist_template_revisions');
    expect(chamadas).toContainEqual({ metodo: 'eq', argumentos: ['status', 'published'] });
    // A publicada corrente é a de maior número, nunca a primeira que aparecer.
    expect(chamadas).toContainEqual({ metodo: 'order', argumentos: ['revision', { ascending: false }] });
  });

  test('a revisão publicada chega ao motor com regras e perguntas', async () => {
    respostas = [{
      data: [linha({ status: 'published', published_at: '2026-08-19T09:30:00Z', rules: [regraValida], routing_questions: [perguntaProcessamento] })],
      error: null,
    }];

    const revisao = await ApplicabilityRevisionService.getPublishedRevision('tpl-estetica-v1');

    expect(revisao?.status).toBe('published');
    expect(revisao?.rules).toHaveLength(1);
    expect(toConditionalTemplate(roteiro, revisao)).toEqual({
      sections: roteiro.sections,
      rules: [regraValida],
      routingQuestions: [perguntaProcessamento],
    });
  });

  test('sem revisão, o roteiro vai ao motor com as listas vazias', () => {
    expect(toConditionalTemplate(roteiro, null)).toEqual({
      sections: roteiro.sections,
      rules: [],
      routingQuestions: [],
    });
  });

  test('jsonb ilegível vira lista vazia, nunca regra inventada', () => {
    const revisao = mapRevisionRow(linha({ rules: 'nao e uma lista', routing_questions: null }) as never);
    expect(revisao.rules).toEqual([]);
    expect(revisao.routingQuestions).toEqual([]);
  });

  test('rascunho aceita regra incompleta e nasce no tenant ativo', async () => {
    const regraPelaMetade = {
      id: 'rule-em-construcao',
      target: { type: 'item' as const, id: '' },
      expression: { combinator: 'all' as const, conditions: [] },
    };
    respostas = [
      { data: [], error: null },                                   // getDraft: nenhum
      { data: linha({ rules: [regraPelaMetade] }), error: null },  // insert
    ];

    const salvo = await ApplicabilityRevisionService.saveDraft('tpl-estetica-v1', {
      rules: [regraPelaMetade],
      routingQuestions: [],
    });

    expect(salvo.status).toBe('draft');
    const insert = chamadas.find((c) => c.metodo === 'insert');
    expect(insert?.argumentos[0]).toMatchObject({
      template_id: 'tpl-estetica-v1',
      tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    // Publicar é transição explícita: o insert nunca manda status.
    expect(insert?.argumentos[0]).not.toHaveProperty('status');
  });

  test('rascunho existente é atualizado no lugar, sem criar revisão nova', async () => {
    respostas = [
      { data: [linha()], error: null },                       // getDraft
      { data: linha({ rules: [regraValida] }), error: null }, // update
    ];

    await ApplicabilityRevisionService.saveDraft('tpl-estetica-v1', {
      rules: [regraValida],
      routingQuestions: [perguntaProcessamento],
    });

    expect(chamadas.some((c) => c.metodo === 'insert')).toBe(false);
    const update = chamadas.find((c) => c.metodo === 'update');
    expect(update?.argumentos[0]).toMatchObject({ rules: [regraValida] });
    expect(update?.argumentos[0]).not.toHaveProperty('status');
  });

  test('publicar recusa regra que aponta para item inexistente', async () => {
    const regraOrfa = {
      ...regraValida,
      target: { type: 'item' as const, id: 'item-que-nao-existe-mais' },
    };
    respostas = [{ data: [linha({ rules: [regraOrfa], routing_questions: [perguntaProcessamento] })], error: null }];

    await expect(ApplicabilityRevisionService.publishDraft(roteiro))
      .rejects.toBeInstanceOf(ApplicabilityValidationError);

    // E nada foi publicado.
    expect(chamadas.some((c) => c.metodo === 'update')).toBe(false);
  });

  test('publicar recusa regra que referencia pergunta inexistente', async () => {
    respostas = [{ data: [linha({ rules: [regraValida], routing_questions: [] })], error: null }];

    await expect(ApplicabilityRevisionService.publishDraft(roteiro)).rejects.toThrow(/pergunta/i);
    expect(chamadas.some((c) => c.metodo === 'update')).toBe(false);
  });

  test('rascunho válido é publicado por transição de status', async () => {
    respostas = [
      { data: [linha({ rules: [regraValida], routing_questions: [perguntaProcessamento] })], error: null },
      {
        data: linha({
          status: 'published',
          published_at: '2026-08-19T09:30:00Z',
          rules: [regraValida],
          routing_questions: [perguntaProcessamento],
        }),
        error: null,
      },
    ];

    const publicada = await ApplicabilityRevisionService.publishDraft(roteiro);

    expect(publicada.status).toBe('published');
    expect(publicada.publishedAt).toBe('2026-08-19T09:30:00Z');
    expect(chamadas.find((c) => c.metodo === 'update')?.argumentos[0]).toEqual({ status: 'published' });
  });

  test('publicar sem rascunho não inventa revisão', async () => {
    respostas = [{ data: [], error: null }];
    await expect(ApplicabilityRevisionService.publishDraft(roteiro)).rejects.toThrow(/rascunho/i);
  });

  test('descartar sem rascunho não apaga nada', async () => {
    respostas = [{ data: [], error: null }];
    await ApplicabilityRevisionService.discardDraft('tpl-estetica-v1');
    expect(chamadas.some((c) => c.metodo === 'delete')).toBe(false);
  });
});
