import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '../../store/useSettingsStore';

describe('useSettingsStore profile isolation', () => {
  beforeEach(async () => {
    localStorage.clear();
    await useSettingsStore.getState().clearData();
  });

  it('keeps Ana and Ester settings separated on the same device', () => {
    const store = useSettingsStore.getState();

    store.setConsultant('ester');
    useSettingsStore.getState().updateSettings({
      logoDataUrl: 'data:image/png;base64,ester',
      consultantRole: 'saude',
      companyName: 'Ester Saude',
    });

    useSettingsStore.getState().setConsultant('ana');
    expect(useSettingsStore.getState().settings.name).toBe('Ana Roberta Ribeiro');
    expect(useSettingsStore.getState().settings.consultantRole).toBe('nutricao');
    expect(useSettingsStore.getState().settings.logoDataUrl).toBeUndefined();

    useSettingsStore.getState().updateSettings({
      logoDataUrl: 'data:image/png;base64,ana',
      consultantRole: 'nutricao',
      companyName: 'Ana Nutricao',
    });

    useSettingsStore.getState().setConsultant('ester');
    expect(useSettingsStore.getState().settings.name).toBe('Ester Caiafa');
    expect(useSettingsStore.getState().settings.consultantRole).toBe('saude');
    expect(useSettingsStore.getState().settings.logoDataUrl).toBe('data:image/png;base64,ester');
    expect(useSettingsStore.getState().settings.companyName).toBe('Ester Saude');

    useSettingsStore.getState().setConsultant('ana');
    expect(useSettingsStore.getState().settings.name).toBe('Ana Roberta Ribeiro');
    expect(useSettingsStore.getState().settings.consultantRole).toBe('nutricao');
    expect(useSettingsStore.getState().settings.logoDataUrl).toBe('data:image/png;base64,ana');
    expect(useSettingsStore.getState().settings.companyName).toBe('Ana Nutricao');
  });
});
