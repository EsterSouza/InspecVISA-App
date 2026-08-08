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
const UNIT = '20000000-0000-4000-8000-000000000001';
const KEY = '70000000-0000-4000-8000-000000000002';

function pdf(name = 'contrato.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function input(overrides = {}) {
  return {
    clientId: UNIT,
    category: 'licenciamento' as const,
    subject: 'Renovação do alvará',
    description: 'Precisamos de apoio para renovar o alvará que vence no mês que vem.',
    submissionKey: KEY,
    ...overrides,
  };
}

describe('P360-012 - solicitacoes pelo portal do cliente', () => {
  beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  test('abre a solicitacao pela RPC, com a chave de submissao e a assinatura', async () => {
    rpc.mockResolvedValue({ data: { ok: true, request_id: 'req-1', request_number: 7, duplicate: false }, error: null });

    const result = await clientPortalService.createServiceRequest(
      TOKEN,
      input({ byName: 'Maria da Silva', byRole: 'Gerente' })
    );

    expect(result).toMatchObject({ requestId: 'req-1', requestNumber: 7, duplicate: false });
    const [fnName, params] = rpc.mock.calls[0];
    expect(fnName).toBe('client_portal_create_service_request');
    expect(params).toMatchObject({
      p_token: TOKEN,
      p_client_id: UNIT,
      p_category: 'licenciamento',
      p_submission_key: KEY,
      p_by_name: 'Maria da Silva',
      p_by_role: 'Gerente',
    });
  });

  test('erro do servidor vira mensagem, sem tentar anexar nada', async () => {
    rpc.mockResolvedValue({ data: { error: 'limite de 15 solicitacoes em aberto atingido' }, error: null });

    await expect(
      clientPortalService.createServiceRequest(TOKEN, input({ file: pdf() }))
    ).rejects.toThrow('limite de 15 solicitacoes em aberto atingido');
    expect(invoke).not.toHaveBeenCalled();
  });

  test('anexo vai em multipart depois que a solicitacao ja existe', async () => {
    rpc.mockResolvedValue({ data: { ok: true, request_id: 'req-2', request_number: 8, duplicate: false }, error: null });

    await clientPortalService.createServiceRequest(TOKEN, input({ file: pdf() }));

    const [fnName, options] = invoke.mock.calls[0];
    expect(fnName).toBe('client-service-request');
    const body = options.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('accountToken')).toBe(TOKEN);
    expect(body.get('requestId')).toBe('req-2');
    expect(body.get('file')).toBeInstanceOf(File);
  });

  test('anexo que nao sobe nao derruba a solicitacao ja registrada', async () => {
    rpc.mockResolvedValue({ data: { ok: true, request_id: 'req-3', request_number: 9, duplicate: false }, error: null });
    invoke.mockResolvedValue({ data: { error: 'nao foi possivel guardar o arquivo agora' }, error: null });

    const result = await clientPortalService.createServiceRequest(TOKEN, input({ file: pdf() }));

    expect(result.requestNumber).toBe(9);
    expect(result.attachmentError).toBe('nao foi possivel guardar o arquivo agora');
  });

  test('reenvio da mesma submissao nao reanexa nem reavisa a equipe', async () => {
    rpc.mockResolvedValue({ data: { ok: true, request_id: 'req-1', request_number: 7, duplicate: true }, error: null });

    const result = await clientPortalService.createServiceRequest(TOKEN, input({ file: pdf() }));

    expect(result.duplicate).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  test('arquivo fora do tipo aceito e barrado antes de abrir a solicitacao', async () => {
    const exe = new File(['MZ'], 'planta.exe', { type: 'application/octet-stream' });

    await expect(
      clientPortalService.createServiceRequest(TOKEN, input({ file: exe }))
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('a leitura devolve a lista do servidor sem reordenar', async () => {
    rpc.mockResolvedValue({
      data: { requests: [{ id: 'a', waiting_on: 'client' }, { id: 'b', waiting_on: 'team' }] },
      error: null,
    });

    const rows = await clientPortalService.serviceRequests(TOKEN);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });

  test('responder passa pela RPC de resposta, com o texto ja aparado', async () => {
    rpc.mockResolvedValue({ data: { ok: true, status: 'in_progress' }, error: null });

    await clientPortalService.replyServiceRequest(TOKEN, {
      requestId: 'req-1',
      message: '  Segue o contrato social.  ',
      byName: 'Maria',
      byRole: 'Gerente',
    });

    const [fnName, params] = rpc.mock.calls[0];
    expect(fnName).toBe('client_portal_reply_service_request');
    expect(params).toMatchObject({ p_request_id: 'req-1', p_message: 'Segue o contrato social.' });
  });

  test('recusa do servidor ao responder chega como erro na tela', async () => {
    rpc.mockResolvedValue({ data: { error: 'esta solicitacao nao esta aguardando resposta sua' }, error: null });

    await expect(
      clientPortalService.replyServiceRequest(TOKEN, { requestId: 'req-1', message: 'oi' })
    ).rejects.toThrow('esta solicitacao nao esta aguardando resposta sua');
  });
});
