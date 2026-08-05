import { beforeEach, describe, expect, test, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc,
    from: vi.fn(),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

import { clientPortalService } from '../../services/clientPortalService';

describe('PROD-02 - falha de auditoria do portal e observavel', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  test('evento registrado com sucesso nao gera ruido e conta como ok', async () => {
    const before = clientPortalService.auditHealth();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await clientPortalService.audit('token-a', 'login');

    const after = clientPortalService.auditHealth();
    expect(after.ok).toBe(before.ok + 1);
    expect(after.failed).toBe(before.failed);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('RPC inexistente nao derruba o portal, mas fica registrada e barulhenta', async () => {
    const before = clientPortalService.auditHealth();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: new Error('function public.client_portal_audit_event does not exist'),
    });

    await expect(clientPortalService.audit('token-a', 'report_download_clicked')).resolves.toBeUndefined();

    const after = clientPortalService.auditHealth();
    expect(after.failed).toBe(before.failed + 1);
    expect(after.lastEventType).toBe('report_download_clicked');
    expect(after.lastError).toContain('does not exist');
    expect(after.lastFailureAt).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('Auditoria falhou');
    spy.mockRestore();
  });

  test('erro devolvido dentro do payload tambem conta como falha', async () => {
    const before = clientPortalService.auditHealth();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: { error: 'acesso invalido' }, error: null });

    await clientPortalService.audit('token-revogado', 'login');

    const after = clientPortalService.auditHealth();
    expect(after.failed).toBe(before.failed + 1);
    expect(after.lastError).toBe('acesso invalido');
    spy.mockRestore();
  });
});
