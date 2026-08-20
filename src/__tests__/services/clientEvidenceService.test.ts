import { beforeEach, describe, expect, test, vi } from 'vitest';

const { from, storageFrom } = vi.hoisted(() => ({ from: vi.fn(), storageFrom: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from,
    storage: { from: storageFrom },
    functions: { invoke: vi.fn() },
  },
}));

import { ClientEvidenceService } from '../../services/clientEvidenceService';

const CLIENT = 'client-1';

/**
 * O service faz duas consultas em sequência: os itens do plano (para descobrir qual item do
 * roteiro cada um representa) e as evidências daqueles itens. O mock devolve uma por chamada.
 */
function mockQueries(items: unknown[], evidence: unknown[], checkpoints: unknown[] = []) {
  from.mockImplementation((table: string) => {
    if (table === 'client_action_items') {
      return { select: () => ({ eq: () => Promise.resolve({ data: items, error: null }) }) };
    }
    if (table === 'client_action_checkpoints') {
      return {
        select: () => ({
          in: () => ({ is: () => ({ order: () => Promise.resolve({ data: checkpoints, error: null }) }) }),
        }),
      };
    }
    return {
      select: () => ({ in: () => ({ order: () => Promise.resolve({ data: evidence, error: null }) }) }),
    };
  });
}

const itemRow = { id: 'plan-1', source_item_id: 'item-alvara', status: 'published' };

function evidenceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev-1',
    action_item_id: 'plan-1',
    status: 'approved',
    file_name: 'protocolo.pdf',
    mime_type: 'application/pdf',
    client_note: 'Protocolo aberto.',
    review_note: 'Aceito.',
    submitted_by_name: 'Joana Prado',
    submitted_by_role: 'Gestora da unidade',
    submitted_at: '2026-07-15T12:00:00.000Z',
    reviewed_at: '2026-07-16T12:00:00.000Z',
    storage_bucket: 'client-action-evidence',
    storage_path: 'tenant/cliente/plan-1/arquivo.pdf',
    ...overrides,
  };
}

describe('REL-03 - evidencia do cliente na vistoria seguinte', () => {
  beforeEach(() => {
    from.mockReset();
    storageFrom.mockReset();
  });

  test('agrupa pelo item do ROTEIRO, nao pelo id do plano de acao', async () => {
    mockQueries([itemRow], [evidenceRow()]);

    const { evidence: byItem } = await ClientEvidenceService.byItemForClient(CLIENT);

    // O elo entre os dois mundos e o `source_item_id`; sem isso a evidencia nunca acha o
    // requisito que a consultora esta avaliando na casa.
    expect([...byItem.keys()]).toEqual(['item-alvara']);
    const [row] = byItem.get('item-alvara')!;
    expect(row.byName).toBe('Joana Prado');
    expect(row.byRole).toBe('Gestora da unidade');
    expect(row.clientNote).toBe('Protocolo aberto.');
    expect(row.itemStatus).toBe('published');
  });

  test('evidencia de um item do plano que sumiu e ignorada em silencio', async () => {
    mockQueries([itemRow], [evidenceRow({ action_item_id: 'plan-que-nao-existe' })]);

    const { evidence: byItem } = await ClientEvidenceService.byItemForClient(CLIENT);

    expect(byItem.size).toBe(0);
  });

  test('cliente sem plano de acao nao dispara a segunda consulta', async () => {
    mockQueries([], []);

    const { evidence: byItem } = await ClientEvidenceService.byItemForClient(CLIENT);

    expect(byItem.size).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
  });

  test('sem clientId nem consulta o banco', async () => {
    const { evidence: byItem } = await ClientEvidenceService.byItemForClient('');
    expect(byItem.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  test('so imagem APROVADA e embutida no relatorio', async () => {
    mockQueries(
      [itemRow, { id: 'plan-2', source_item_id: 'item-pia', status: 'published' }],
      [
        evidenceRow({ id: 'ev-img-ok', mime_type: 'image/jpeg', status: 'approved' }),
        evidenceRow({ id: 'ev-img-devolvida', mime_type: 'image/jpeg', status: 'changes_requested' }),
        evidenceRow({ id: 'ev-pdf', mime_type: 'application/pdf', status: 'approved' }),
      ]
    );
    storageFrom.mockReturnValue({
      createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://exemplo/assinada' }, error: null }),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
    }));

    const { evidence: byItem } = await ClientEvidenceService.prepareForReport(CLIENT);
    const rows = byItem.get('item-alvara')!;

    // A aprovada vira figura; a devolvida fica so como registro de texto, e o PDF nao engorda
    // carregando arquivo recusado.
    expect(rows.find((r) => r.evidenceId === 'ev-img-ok')?.imageDataUrl).toMatch(/^data:/);
    expect(rows.find((r) => r.evidenceId === 'ev-img-devolvida')?.imageDataUrl).toBeUndefined();
    // PDF nao e imagem: entra como registro, nunca como figura.
    expect(rows.find((r) => r.evidenceId === 'ev-pdf')?.imageDataUrl).toBeUndefined();

    vi.unstubAllGlobals();
  });

  test('falha ao baixar a imagem nao derruba a geracao do relatorio', async () => {
    mockQueries([itemRow], [evidenceRow({ mime_type: 'image/png', status: 'approved' })]);
    storageFrom.mockReturnValue({
      createSignedUrl: () => Promise.resolve({ data: null, error: new Error('offline') }),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { evidence: byItem } = await ClientEvidenceService.prepareForReport(CLIENT);

    expect(byItem.get('item-alvara')![0].imageDataUrl).toBeUndefined();
    warn.mockRestore();
  });
});

describe('PORT-03 - o cliente declara a situacao', () => {
  beforeEach(() => {
    from.mockReset();
    storageFrom.mockReset();
  });

  test('a declaracao chega pelo item do roteiro, mesmo sem nenhum arquivo anexado', async () => {
    mockQueries(
      [{
        ...itemRow,
        client_status: 'not_done',
        client_status_note: 'A pasta sanitaria nao foi feita: responsavel tecnico de licenca.',
        client_status_at: '2026-07-20T12:00:00.000Z',
        client_status_by_name: 'Joana Prado',
        client_status_by_role: 'Gestora da unidade',
      }],
      []
    );

    const { evidence, declarations } = await ClientEvidenceService.byItemForClient(CLIENT);

    // O caso da Ester: sem anexo nenhum, mas com resposta — e e a resposta que muda a conversa
    // na proxima visita.
    expect(evidence.size).toBe(0);
    const declared = declarations.get('item-alvara')!;
    expect(declared.status).toBe('not_done');
    expect(declared.note).toMatch(/responsavel tecnico de licenca/);
    expect(declared.byName).toBe('Joana Prado');
    expect(declared.byRole).toBe('Gestora da unidade');
  });

  test('item sem declaracao nao entra no mapa', async () => {
    mockQueries([itemRow], []);

    const { declarations } = await ClientEvidenceService.byItemForClient(CLIENT);

    expect(declarations.size).toBe(0);
  });

  test('declaracao e evidencia convivem no mesmo item', async () => {
    mockQueries(
      [{ ...itemRow, client_status: 'done', client_status_note: null, client_status_at: '2026-07-20T12:00:00.000Z', client_status_by_name: 'Carlos', client_status_by_role: 'RT' }],
      [evidenceRow()]
    );

    const { evidence, declarations } = await ClientEvidenceService.byItemForClient(CLIENT);

    expect(declarations.get('item-alvara')?.status).toBe('done');
    expect(evidence.get('item-alvara')).toHaveLength(1);
  });
});

describe('PORT-05 - os topicos que o cliente marcou chegam na vistoria seguinte', () => {
  beforeEach(() => {
    from.mockReset();
    storageFrom.mockReset();
  });

  test('agrupa os topicos pelo item do ROTEIRO, com o que foi marcado', async () => {
    mockQueries([itemRow], [], [
      {
        id: 'cp-1',
        action_item_id: 'plan-1',
        text: 'Protocolar a renovacao',
        ordinal: 1,
        done_at: '2026-07-20T12:00:00.000Z',
        done_by_name: 'Carlos',
      },
      {
        id: 'cp-2',
        action_item_id: 'plan-1',
        text: 'Afixar o alvara na recepcao',
        ordinal: 2,
        done_at: null,
        done_by_name: null,
      },
    ]);

    const { checkpoints } = await ClientEvidenceService.byItemForClient(CLIENT);
    const doItem = checkpoints.get('item-alvara');

    expect(doItem).toHaveLength(2);
    // É esta a leitura que muda a conversa na porta da casa: um feito, um não.
    expect(doItem?.[0]).toMatchObject({ text: 'Protocolar a renovacao', done: true, doneByName: 'Carlos' });
    expect(doItem?.[1]).toMatchObject({ text: 'Afixar o alvara na recepcao', done: false });
  });

  test('topico de um item que nao veio na consulta e ignorado', async () => {
    mockQueries([itemRow], [], [
      { id: 'cp-9', action_item_id: 'plan-de-outro-cliente', text: 'Nao e daqui', ordinal: 1, done_at: null, done_by_name: null },
    ]);

    const { checkpoints } = await ClientEvidenceService.byItemForClient(CLIENT);

    expect(checkpoints.size).toBe(0);
  });

  test('cliente sem plano de acao devolve os tres mapas vazios', async () => {
    mockQueries([], [], []);

    const result = await ClientEvidenceService.byItemForClient(CLIENT);

    expect(result.evidence.size).toBe(0);
    expect(result.declarations.size).toBe(0);
    expect(result.checkpoints.size).toBe(0);
  });
});
