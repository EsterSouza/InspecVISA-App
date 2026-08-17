import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { ClientPortalSettings } from '../../../types';
import { AppointmentAdminService } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, errorMessage } from './shared';

interface PortalSettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const FEATURE_FLAGS: { key: 'quick_access_enabled' | 'multi_purpose_schedule' | 'action_plan_enabled' | 'service_requests_enabled'; label: string }[] = [
  { key: 'quick_access_enabled', label: 'Acessos rápidos' },
  { key: 'multi_purpose_schedule', label: 'Agenda multiuso' },
  { key: 'action_plan_enabled', label: 'Plano de ação' },
  { key: 'service_requests_enabled', label: 'Solicitações de consultoria' },
];

function SettingsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando configurações">
      <div className="h-16 animate-pulse rounded-xl bg-surface-sunken" />
      <div className="h-16 animate-pulse rounded-xl bg-surface-sunken" />
      <div className="h-24 animate-pulse rounded-xl bg-surface-sunken" />
      <span className="sr-only">Carregando configurações institucionais do portal...</span>
    </div>
  );
}

export function PortalSettingsModal({ onClose, onSaved }: PortalSettingsModalProps) {
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    void AppointmentAdminService.getPortalSettings()
      .then((value) => setSettings(value))
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.savePortalSettings({
        tutorial_pdf_url: settings.tutorial_pdf_url,
        support_whatsapp: settings.support_whatsapp,
        quick_access_enabled: settings.quick_access_enabled,
        multi_purpose_schedule: settings.multi_purpose_schedule,
        action_plan_enabled: settings.action_plan_enabled,
        service_requests_enabled: settings.service_requests_enabled,
        overdue_grace_days: settings.overdue_grace_days,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setFlag = (
    key: 'quick_access_enabled' | 'multi_purpose_schedule' | 'action_plan_enabled' | 'service_requests_enabled',
    checked: boolean
  ) => setSettings((current) => current ? { ...current, [key]: checked } : current);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="portal-settings-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 id="portal-settings-title" className="mb-1 text-xl font-bold text-navy">Configurações institucionais do portal</h3>
          <p className="mb-5 text-sm text-navy-3">
            Estes dados valem para todas as contas deste tenant e podem ser alterados sem novo deploy.
          </p>

          {loading ? (
            <SettingsSkeleton />
          ) : loadError ? (
            <div className="space-y-4">
              <div role="alert" className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">{loadError}</div>
              <Button type="button" variant="outline" className="min-h-11 w-full" onClick={load}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={onClose}>Fechar</Button>
            </div>
          ) : settings ? (
            <div className="space-y-4">
              <div className="space-y-1.5 text-sm font-medium text-navy-2">
                <label htmlFor="portal-settings-tutorial">Tutorial padrão do portal (PDF)</label>
                <input
                  id="portal-settings-tutorial"
                  type="url"
                  value={settings.tutorial_pdf_url || ''}
                  onChange={(e) => setSettings({ ...settings, tutorial_pdf_url: e.target.value || null })}
                  placeholder="https://.../tutorial.pdf"
                  className={`${TEXT_INPUT} font-normal`}
                />
                <span className="block text-xs font-normal text-navy-3">
                  Vale para quem não tem tutorial próprio. Para dar um PDF só a um cliente, use o
                  campo da conta em Editar acesso. URL HTTPS.
                </span>
              </div>

              <div className="space-y-1.5 text-sm font-medium text-navy-2">
                <label htmlFor="portal-settings-whatsapp">WhatsApp de suporte</label>
                <input
                  id="portal-settings-whatsapp"
                  type="tel"
                  value={settings.support_whatsapp || ''}
                  onChange={(e) => setSettings({ ...settings, support_whatsapp: e.target.value || null })}
                  placeholder="Ex.: +55 21 99999-9999"
                  maxLength={40}
                  className={`${TEXT_INPUT} font-normal`}
                />
                <span className="block text-xs font-normal text-navy-3">Canal institucional exibido ao cliente quando habilitado.</span>
              </div>

              <div className="space-y-2 rounded-xl border border-default bg-surface-sunken p-3">
                <p className="text-sm font-medium text-navy-2">Recursos habilitados por tenant</p>
                {FEATURE_FLAGS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-navy-2">
                    <input
                      type="checkbox"
                      checked={settings[key] === true}
                      onChange={(e) => setFlag(key, e.target.checked)}
                      className="h-4 w-4 rounded border-control text-primary-600"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="space-y-1.5 text-sm font-medium text-navy-2">
                <label htmlFor="portal-settings-grace-days">Tolerância de atraso (dias)</label>
                <input
                  id="portal-settings-grace-days"
                  type="number"
                  min={0}
                  max={180}
                  value={settings.overdue_grace_days ?? 5}
                  onChange={(e) =>
                    setSettings({ ...settings, overdue_grace_days: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className={`${TEXT_INPUT} font-normal`}
                />
                <span className="block text-xs font-normal text-navy-3">
                  Dias depois do vencimento antes de a conta contar como em atraso. Só conta quando há data de
                  vencimento cadastrada, e é o que dispara a suspensão automática de agendamento.
                </span>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
                <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar configurações
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div role="alert" className="rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
                Não foi possível carregar as configurações.
              </div>
              <Button type="button" variant="ghost" className="w-full" onClick={onClose}>Fechar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
