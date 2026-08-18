import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import { SettingsService } from '../../services/settingsService';
import { duploDeConsulta, duploDeUsuario } from '../fixtures';

const getUser = vi.mocked(supabase.auth.getUser);
const from = vi.mocked(supabase.from);

function mockProfileSettings(consultantSettings: unknown) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { consultant_settings: consultantSettings },
      error: null,
    }),
  };
  from.mockReturnValue(duploDeConsulta(query));
}

describe('SettingsService profile isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(duploDeUsuario({ id: 'user-1', email: 'shared@example.com' }));
  });

  it('does not load legacy Ester settings for Ana', async () => {
    mockProfileSettings({
      name: 'Ester Caiafa',
      professionalId: '759.561',
      professionalIdLabel: 'COREN/RJ',
      phone: '(21) 99339-7315',
      consultantRole: 'saude',
      logoDataUrl: 'data:image/png;base64,ester',
    });

    await expect(SettingsService.load('ana')).resolves.toBeNull();
  });

  it('loads only the requested scoped profile when byProfile exists', async () => {
    mockProfileSettings({
      byProfile: {
        ester: {
          name: 'Ester Caiafa',
          professionalId: '759.561',
          consultantRole: 'saude',
          logoDataUrl: 'data:image/png;base64,ester',
        },
        ana: {
          name: 'Ana Roberta Ribeiro',
          professionalId: '10324',
          consultantRole: 'nutricao',
          logoDataUrl: 'data:image/png;base64,ana',
        },
      },
    });

    await expect(SettingsService.load('ana')).resolves.toMatchObject({
      name: 'Ana Roberta Ribeiro',
      consultantRole: 'nutricao',
      logoDataUrl: 'data:image/png;base64,ana',
    });
  });
});
