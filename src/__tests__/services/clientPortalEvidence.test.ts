import { beforeEach, describe, expect, test, vi } from 'vitest';

const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc,
    from: vi.fn(),
    storage: { from: vi.fn() },
    functions: { invoke },
  },
}));

import { clientPortalService } from '../../services/clientPortalService';

const TOKEN = '20000000-0000-4000-8000-000000000003';
const ITEM = '30000000-0000-4000-8000-000000000001';
const KEY = '70000000-0000-4000-8000-000000000001';
const VISIT = '50000000-0000-4000-8000-000000000002';

function pdf(name = 'protocolo.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

describe('P360-011 - envio da evidencia pelo portal', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  test('sobe como multipart, com a chave de idempotencia e o comentario', async () => {
    invoke.mockResolvedValue({ data: { ok: true, evidence_id: 'ev-1', duplicate: false }, error: null });

    const result = await clientPortalService.submitEvidence(TOKEN, {
      actionItemId: ITEM,
      uploadKey: KEY,
      file: pdf(),
      note: 'Protocolo em anexo',
      byName: 'Joana Prado',
      byRole: 'Gestora da unidade',
    });

    expect(result).toEqual({ evidenceId: 'ev-1', duplicate: false });
    const [fnName, options] = invoke.mock.calls[0];
    expect(fnName).toBe('client-action-evidence');
    const body = options.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('accountToken')).toBe(TOKEN);
    expect(body.get('actionItemId')).toBe(ITEM);
    expect(body.get('uploadKey')).toBe(KEY);
    expect(body.get('note')).toBe('Protocolo em anexo');
    expect(body.get('byName')).toBe('Joana Prado');
    expect(body.get('byRole')).toBe('Gestora da unidade');
    expect(body.get('visitToken')).toBeNull();
    expect((body.get('file') as File).name).toBe('protocolo.pdf');
  });

  test('retry com a mesma chave e reconhecido como repeticao, nao como envio novo', async () => {
    invoke.mockResolvedValue({ data: { ok: true, evidence_id: 'ev-1', duplicate: true }, error: null });

    const result = await clientPortalService.submitEvidence(TOKEN, {
      actionItemId: ITEM,
      uploadKey: KEY,
      file: pdf(),
      byName: 'Joana Prado',
      byRole: 'Gestora da unidade',
    });

    expect(result.duplicate).toBe(true);
    expect(result.evidenceId).toBe('ev-1');
  });

  test('arquivo recusado nem chega a subir', async () => {
    await expect(
      clientPortalService.submitEvidence(TOKEN, {
        actionItemId: ITEM,
        uploadKey: KEY,
        file: new File(['MZ'], 'macro.docx', { type: 'application/msword' }),
        byName: 'Joana',
        byRole: 'Gestora',
      })
    ).rejects.toThrow(/Formato não aceito/);

    expect(invoke).not.toHaveBeenCalled();
  });

  test('erro de negocio do servidor chega como mensagem, nao como sucesso silencioso', async () => {
    invoke.mockResolvedValue({ data: { error: 'item nao esta aberto para evidencia' }, error: null });

    await expect(
      clientPortalService.submitEvidence(TOKEN, {
        actionItemId: ITEM, uploadKey: KEY, file: pdf(), byName: 'Joana', byRole: 'Gestora',
      })
    ).rejects.toThrow('item nao esta aberto para evidencia');
  });

  test('a listagem devolve a URL temporaria e nunca o caminho do arquivo', async () => {
    invoke.mockResolvedValue({
      data: {
        evidence: [
          {
            id: 'ev-1',
            action_item_id: ITEM,
            file_name: 'protocolo.pdf',
            mime_type: 'application/pdf',
            file_size: 2048,
            status: 'pending',
            client_note: null,
            review_note: null,
            submitted_at: '2026-08-07T12:00:00Z',
            reviewed_at: null,
            signed_url: 'https://exemplo/assinada',
            signed_url_expires_in: 600,
          },
        ],
      },
      error: null,
    });

    const rows = await clientPortalService.evidence(TOKEN, ITEM);

    expect(rows).toHaveLength(1);
    expect(rows[0].signed_url).toBe('https://exemplo/assinada');
    expect(JSON.stringify(rows[0])).not.toMatch(/storage_path|storage_bucket/);
    expect(invoke.mock.calls[0][1].body).toEqual({ accountToken: TOKEN, actionItemId: ITEM });
  });
});

describe('PORT-02 - assinatura e envio pelo link do relatorio', () => {
  beforeEach(() => {
    invoke.mockReset();
    rpc.mockReset();
  });

  test('sem nome ou funcao o arquivo nem sai do navegador', async () => {
    await expect(
      clientPortalService.submitEvidence(TOKEN, {
        actionItemId: ITEM, uploadKey: KEY, file: pdf(), byName: '  ', byRole: 'Gestora',
      })
    ).rejects.toThrow(/nome e sua função/);

    await expect(
      clientPortalService.submitReportEvidence(VISIT, {
        actionItemId: ITEM, uploadKey: KEY, file: pdf(), byName: 'Joana', byRole: '',
      })
    ).rejects.toThrow(/nome e sua função/);

    expect(invoke).not.toHaveBeenCalled();
  });

  test('pelo link vai o token da visita, e nunca o da conta', async () => {
    invoke.mockResolvedValue({ data: { ok: true, evidence_id: 'ev-9', duplicate: false }, error: null });

    await clientPortalService.submitReportEvidence(VISIT, {
      actionItemId: ITEM,
      uploadKey: KEY,
      file: pdf(),
      byName: '  Joana Prado  ',
      byRole: '  Gestora da unidade  ',
    });

    const body = invoke.mock.calls[0][1].body as FormData;
    expect(body.get('visitToken')).toBe(VISIT);
    expect(body.get('accountToken')).toBeNull();
    // Espaço sobrando na digitação não vira assinatura torta no relatório.
    expect(body.get('byName')).toBe('Joana Prado');
    expect(body.get('byRole')).toBe('Gestora da unidade');
  });

  test('o plano de acao do link completa os campos que a RPC nao repete por item', async () => {
    rpc.mockResolvedValue({
      data: {
        unit_name: 'REDE SÊNIOR ICARAÍ',
        items: [{ id: 'item-1', title: 'Alvará', status: 'published', evidence_count: 0, accepts_evidence: true }],
      },
      error: null,
    });

    const plan = await clientPortalService.reportActionItems(VISIT);

    expect(plan.unitName).toBe('REDE SÊNIOR ICARAÍ');
    expect(plan.items[0].unit_name).toBe('REDE SÊNIOR ICARAÍ');
    expect(plan.items[0].visit_token).toBeNull();
    expect(rpc).toHaveBeenCalledWith('public_report_action_items', { p_visit_token: VISIT });
  });

  test('link invalido ou relatorio oculto vira erro, nao lista vazia', async () => {
    rpc.mockResolvedValue({ data: { error: 'relatorio indisponivel' }, error: null });

    await expect(clientPortalService.reportActionItems(VISIT)).rejects.toThrow('relatorio indisponivel');
  });
});
