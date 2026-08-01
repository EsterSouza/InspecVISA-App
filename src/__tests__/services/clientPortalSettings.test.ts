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

vi.mock('../../utils/localScope', () => ({
  getActiveTenantId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}));

import {
  AppointmentAdminService,
  normalizeOptionalHttpsUrl,
} from '../../services/appointmentAdminService';
import { clientPortalService } from '../../services/clientPortalService';

describe('P360-002 - configuracao segura do portal', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  test('normaliza URL vazia e aceita somente HTTPS bem formada', () => {
    expect(normalizeOptionalHttpsUrl('  ', 'Link')).toBeNull();
    expect(normalizeOptionalHttpsUrl(' https://drive.google.com/folder ', 'Link'))
      .toBe('https://drive.google.com/folder');
    expect(() => normalizeOptionalHttpsUrl('http://drive.google.com/folder', 'Link'))
      .toThrow('URL HTTPS válida');
    expect(() => normalizeOptionalHttpsUrl('texto malformado', 'Link'))
      .toThrow('URL HTTPS válida');
  });

  test('salva pasta principal pela RPC administrativa sem alterar pastas por unidade', async () => {
    await AppointmentAdminService.updatePortalAccount('account-a', {
      email: 'cliente@example.com',
      username: 'cliente-a',
      mainDriveFolderUrl: ' https://drive.google.com/principal ',
    });

    expect(rpc).toHaveBeenCalledWith('admin_update_client_portal_account_configuration', {
      p_account_id: 'account-a',
      p_email: 'cliente@example.com',
      p_username: 'cliente-a',
      p_main_drive_folder_url: 'https://drive.google.com/principal',
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('personalized_sanitary_folder');
  });

  test('rejeita HTTP antes de chamar a RPC administrativa', async () => {
    await expect(AppointmentAdminService.updatePortalAccount('account-a', {
      email: 'cliente@example.com',
      mainDriveFolderUrl: 'http://drive.google.com/principal',
    })).rejects.toThrow('URL HTTPS válida');

    expect(rpc).not.toHaveBeenCalled();
  });

  test('envia somente configuracoes institucionais seguras para a RPC', async () => {
    await AppointmentAdminService.savePortalSettings({
      tutorial_pdf_url: 'https://example.com/tutorial.pdf',
      support_whatsapp: ' +55 21 99999-9999 ',
      quick_access_enabled: true,
      multi_purpose_schedule: false,
      action_plan_enabled: false,
      service_requests_enabled: false,
    });

    expect(rpc).toHaveBeenCalledWith('admin_save_client_portal_settings', {
      p_tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_tutorial_pdf_url: 'https://example.com/tutorial.pdf',
      p_support_whatsapp: '+55 21 99999-9999',
      p_quick_access_enabled: true,
      p_multi_purpose_schedule: false,
      p_action_plan_enabled: false,
      p_service_requests_enabled: false,
    });
  });

  test('overview preserva pagamento, scores, NCs e pasta personalizada sem campos internos', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        account_name: 'Conta A',
        main_drive_folder_url: 'https://drive.google.com/principal',
        tutorial_pdf_url: 'https://example.com/tutorial.pdf',
        support_whatsapp: '+5521999999999',
        quick_access_enabled: true,
        multi_purpose_schedule: false,
        action_plan_enabled: false,
        service_requests_enabled: false,
        scheduling_suspended: false,
        payment: { type: 'monthly', status: 'pending', link: null, links: [], due_date: null, updated_at: null },
        units: [{
          client_id: 'client-a',
          client_name: 'Unidade A',
          city: 'Rio de Janeiro',
          state: 'RJ',
          has_personalized_sanitary_folder: true,
          personalized_sanitary_folder_url: 'https://drive.google.com/personalizada',
          visits: [{
            public_token: 'visit-token',
            unit_name: 'Unidade A',
            status: 'completed',
            requested_date: '2026-07-01',
            requested_time: '09:00',
            report_due_at: null,
            compliance_score: 90,
            sanitary_score: 88,
            nutrition_score: 92,
            critical_nc_count: 1,
            important_nc_count: 2,
            total_nc_count: 3,
            recurring_nc_count: 1,
            immediate_nc_count: 1,
            nc_items: [],
            report_count: 1,
            photo_count: 2,
            attachment_count: 3,
            created_at: '2026-07-01T12:00:00Z',
          }],
        }],
      },
      error: null,
    });

    const overview = await clientPortalService.overview('valid-token');

    expect(overview.payment?.status).toBe('pending');
    expect(overview.units[0].personalized_sanitary_folder_url).toContain('/personalizada');
    expect(overview.units[0].visits[0]).toMatchObject({
      sanitary_score: 88,
      nutrition_score: 92,
      total_nc_count: 3,
      report_count: 1,
    });
    expect(JSON.stringify(overview)).not.toMatch(/service_role|storage_path|access_code|portal_token|signed_url/);
  });
});
