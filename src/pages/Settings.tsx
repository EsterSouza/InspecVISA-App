import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettingsStore, type ConsultantRole } from '../store/useSettingsStore';
import { SyncQueueService } from '../services/syncQueueService';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { TabPanel } from '../components/ui/Tabs';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Radio } from '../components/ui/Checkbox';
import { cn } from '../lib/utils';
import { compressImage } from '../utils/imageUtils';
import { db } from '../db/database';
import { forcePushFinalData } from '../utils/forceSync';
import {
  Save, Upload, Trash2, LogOut, RefreshCw, FileText,
  User, Calendar, Palette, Wrench, AlertTriangle, Info
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { SettingsService } from '../services/settingsService';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';
import { errorMessage, rawErrorMessage } from '../utils/errors';

type Section = 'perfil' | 'agenda' | 'aparencia' | 'sistema' | 'risco';

/** Os três perfis oferecidos na tela — `assistencia_social` é legado do store. */
const CONSULTANT_ROLES: { value: ConsultantRole; label: string }[] = [
  { value: 'ambos', label: 'Todas as áreas (Completo)' },
  { value: 'saude', label: 'Assistência à Saúde (Ester)' },
  { value: 'nutricao', label: 'Nutrição/UAN (Ana)' },
];

const SECTIONS: { value: Section; label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean }[] = [
  { value: 'perfil', label: 'Perfil', icon: User },
  { value: 'agenda', label: 'Agenda', icon: Calendar },
  { value: 'aparencia', label: 'Aparência', icon: Palette },
  { value: 'sistema', label: 'Sistema', icon: Wrench },
  { value: 'risco', label: 'Zona de risco', icon: AlertTriangle, danger: true },
];

export function Settings() {
  const { settings, currentProfile, updateSettings, replaceSettings, clearData } = useSettingsStore();
  const { signOut } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('secao') as Section) || 'perfil';
  const setActiveSection = (value: Section) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'perfil') next.delete('secao');
    else next.set('secao', value);
    setSearchParams(next);
  };
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing'>('idle');
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (!navigator.onLine) return;
    let cancelled = false;
    setLoadStatus('loading');
    SettingsService.load(currentProfile)
      .then((remoteSettings) => {
        if (cancelled) return;
        if (remoteSettings?.name) {
          replaceSettings(remoteSettings);
          setLoadStatus('loaded');
        } else {
          setLoadStatus('idle');
        }
      })
      .catch((err) => {
        console.warn('[Settings] Falha ao carregar configuracoes remotas:', err);
        if (!cancelled) setLoadStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [currentProfile, replaceSettings]);


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 400, 0.9); // smaller for logo
      updateSettings({ logoDataUrl: dataUrl });
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error('Erro ao processar logotipo.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeLogo = () => {
    updateSettings({ logoDataUrl: undefined });
  };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveStatus('saving');
    try {
      await SettingsService.save(settings, currentProfile);
      setProfileSaveStatus('saved');
      setTimeout(() => setProfileSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[Settings] Falha ao salvar perfil remoto:', err);
      setProfileSaveStatus('idle');
      toast.error(rawErrorMessage(err) || 'Nao foi possivel salvar o perfil na nuvem.');
    }
  };

  const handleForcePush = async () => {
    setSyncStatus('syncing');
    try {
      const res = await forcePushFinalData();
      toast.success('Sincronização concluída.', `Sucesso: ${res.totalSynced} · Erros: ${res.errors}`);
    } catch (e) {
      toast.error('Erro ao sincronizar', errorMessage(e));
    } finally {
      setSyncStatus('idle');
    }
  };

  const handleClearData = async () => {
    const summary = await SyncQueueService.getQueueSummary();
    const unsyncedCount = summary.pending + summary.syncing + summary.failed;
    const hasUnsynced = unsyncedCount > 0;

    const ok = await confirm({
      title: 'Apagar todos os dados deste dispositivo?',
      description: hasUnsynced
        ? `Você tem ${unsyncedCount} registro(s) que ainda não foram salvos na nuvem. Se apagar agora, esses dados serão perdidos para sempre.`
        : 'Isso apaga permanentemente os dados locais deste dispositivo.',
      consequences: ['Clientes', 'Inspeções e respostas', 'Fotos'],
      confirmLabel: 'Apagar tudo',
      confirmWord: 'APAGAR',
    });
    if (!ok) return;

    await Promise.all([
      db.clients.clear(),
      db.inspections.clear(),
      db.responses.clear(),
      db.photos.clear(),
    ]);
    clearData();
    window.location.reload();
  };


  return (
    <PageShell className="space-y-6">
      <div>
        <PageHeader title="Configurações" description="Cada seção salva sozinha — não existe um botão único no fim da página." />
        {loadStatus === 'loading' && (
          <p className="-mt-4 mb-2 text-xs text-primary-600">Carregando perfil salvo na nuvem...</p>
        )}
        {loadStatus === 'loaded' && (
          <p className="-mt-4 mb-2 text-xs text-success">Perfil carregado da nuvem.</p>
        )}
        {loadStatus === 'failed' && (
          <p className="-mt-4 mb-2 text-xs text-amber-strong">Nao foi possivel carregar o perfil remoto agora.</p>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label="Seções de configuração"
          className="flex gap-1 overflow-x-auto pb-1 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {SECTIONS.map((section) => {
            const selected = section.value === activeSection;
            const Icon = section.icon;
            return (
              <button
                key={section.value}
                type="button"
                id={`tab-${section.value}`}
                aria-controls={`tabpanel-${section.value}`}
                aria-current={selected}
                onClick={() => setActiveSection(section.value)}
                className={cn(
                  'flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors lg:w-full',
                  selected
                    ? section.danger
                      ? 'bg-danger-soft text-danger-soft-ink'
                      : 'bg-primary-50 text-primary-700'
                    : section.danger
                      ? 'text-danger hover:bg-danger-soft'
                      : 'text-navy-2 hover:bg-surface-active'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <TabPanel value="perfil" activeValue={activeSection} className="pt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Consultor</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveForm} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <Field label="Nome Completo" required>
                      <Input
                        type="text"
                        required
                        value={settings.name}
                        onChange={(e) => updateSettings({ name: e.target.value })}
                        placeholder="Seu nome"
                      />
                    </Field>

                    <Field label="Nome da Empresa" optional>
                      <Input
                        type="text"
                        value={settings.companyName || ''}
                        onChange={(e) => updateSettings({ companyName: e.target.value })}
                        placeholder="Nome exibido no rodapé do PDF"
                      />
                    </Field>

                    <Field label="Telefone de Contato">
                      <Input
                        type="tel"
                        value={settings.phone || ''}
                        onChange={(e) => updateSettings({ phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </Field>

                    <fieldset className="col-span-1 sm:col-span-2">
                      <legend className="text-sm font-semibold text-navy">Perfil de Atuação (Filtro de Roteiro)</legend>
                      <div className="mt-1.5 flex flex-wrap gap-4">
                        {CONSULTANT_ROLES.map(({ value, label }) => (
                          <Radio
                            key={value}
                            name="role"
                            value={value}
                            checked={
                              settings.consultantRole === value ||
                              (value === 'ambos' && !settings.consultantRole)
                            }
                            onChange={() => updateSettings({ consultantRole: value })}
                            className="items-center text-navy-2"
                            boxClassName="mt-0"
                            label={label}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-navy-2">Isso afetará quais seções aparecerão no roteiro ILPI.</p>
                    </fieldset>

                    <Field label="Tipo de Registro profissional">
                      <Input
                        type="text"
                        value={settings.professionalIdLabel || ''}
                        onChange={(e) => updateSettings({ professionalIdLabel: e.target.value })}
                        placeholder="Ex: CRBM, CRN, CRM..."
                      />
                    </Field>

                    <Field label="Número do Registro">
                      <Input
                        type="text"
                        value={settings.professionalId || ''}
                        onChange={(e) => updateSettings({ professionalId: e.target.value })}
                        placeholder="Ex: 123456-7"
                      />
                    </Field>
                  </div>

                  <div className="pt-4 border-t border-default">
                    <h4 className="text-sm font-medium text-navy mb-4">Logotipo para o Relatório (PDF)</h4>
                    <div className="flex items-center space-x-6">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-control bg-surface-sunken">
                        {settings.logoDataUrl ? (
                          <img src={settings.logoDataUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                        ) : (
                          <span className="text-xs text-navy-3">Sem logo</span>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex space-x-2">
                          {/* Exceção FE-24: seletor de arquivo escondido, acionado pelo botão ao lado. */}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleLogoUpload}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Fazer Upload
                          </Button>
                          {settings.logoDataUrl && (
                            <Button type="button" variant="ghost" size="sm" onClick={removeLogo} className="text-danger hover:bg-danger-soft hover:text-danger">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-navy-3">Recomendado: Imagem retangular ou quadrada c/ fundo transparente (PNG).</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-default flex justify-end">
                    <Button type="submit" disabled={profileSaveStatus === 'saving'} className="min-w-[120px]">
                      {profileSaveStatus === 'saving' ? 'Salvando...' : profileSaveStatus === 'saved' ? 'Salvo ✓' : (
                        <><Save className="mr-2 h-4 w-4" /> Salvar Perfil</>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value="agenda" activeValue={activeSection} className="pt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Margem de agenda por modalidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-navy-3">
                  Regra fixa do sistema — ainda não editável por aqui. É o que hoje reserva (ou libera) o
                  horário ao redor de um compromisso na agenda.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-default p-4">
                    <p className="text-sm font-semibold text-navy">Presencial</p>
                    <p className="mt-1 text-sm text-navy-2">1 hora antes · 3 horas depois</p>
                    <p className="mt-1 text-xs text-navy-3">Reserva o deslocamento até e a partir da visita.</p>
                  </div>
                  <div className="rounded-xl border border-default p-4">
                    <p className="text-sm font-semibold text-navy">Online</p>
                    <p className="mt-1 text-sm text-navy-2">30 minutos antes · 2 horas depois</p>
                    <p className="mt-1 text-xs text-navy-3">Só a troca entre chamadas — sem deslocamento.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-amber-soft-border bg-amber-soft p-4">
                  <Info className="h-4 w-4 shrink-0 text-amber-soft-ink mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-amber-soft-ink">
                    Compromisso criado à mão sem modalidade caía, em silêncio, na margem de presencial —
                    a mais larga das duas. A tela de <strong>Agendamentos</strong> agora pede a modalidade
                    ao criar um compromisso manual, exatamente para que essa escolha pare de ser invisível.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value="aparencia" activeValue={activeSection} className="pt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <fieldset disabled className="flex flex-wrap gap-4 opacity-60">
                  <legend className="sr-only">Tema</legend>
                  <Radio
                    name="theme"
                    checked={settings.theme !== 'dark'}
                    readOnly
                    className="items-center text-navy-2"
                    boxClassName="mt-0"
                    label="Claro"
                  />
                  <Radio
                    name="theme"
                    checked={settings.theme === 'dark'}
                    readOnly
                    className="items-center text-navy-2"
                    boxClassName="mt-0"
                    label="Escuro"
                  />
                </fieldset>
                <p className="text-xs text-navy-3">
                  Desabilitado por enquanto: o tema escuro ainda não está implementado.
                </p>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value="sistema" activeValue={activeSection} className="pt-0 space-y-6">
            <Card className="border-primary-100 bg-primary-50">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-accent-ink text-lg">Forçar Sincronização</h3>
                    <p className="text-sm text-accent-ink mt-1">Se houver inspeções pendentes presas no dispositivo, clique aqui para forçar o envio ao servidor.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="whitespace-nowrap shrink-0 border-primary-300 text-accent-ink hover:bg-primary-100"
                    disabled={syncStatus === 'syncing'}
                    onClick={handleForcePush}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    Forçar Push
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary-100 bg-primary-50">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-accent-ink text-lg">Administração</h3>
                    <p className="text-sm text-accent-ink mt-1">Gerencie os templates de inspeção e legislações disponíveis no aplicativo.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.location.href = '/templates'} className="whitespace-nowrap shrink-0 border-primary-300 text-accent-ink hover:bg-primary-100">
                      <FileText className="mr-2 h-4 w-4" />
                      Templates
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-soft-border bg-amber-soft">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-amber-soft-ink text-lg">Sessão do Usuário</h3>
                    <p className="text-sm text-amber-soft-ink mt-1">Encerrar sua sessão atual. Você precisará fazer login novamente para acessar os dados.</p>
                  </div>
                  <Button variant="outline" onClick={() => signOut()} className="whitespace-nowrap shrink-0 border-amber-soft-border text-amber-soft-ink hover:bg-amber-soft">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair da Conta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value="risco" activeValue={activeSection} className="pt-0 space-y-6">
            <Card className="border-danger-soft-border bg-danger-soft">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-danger-soft-ink text-lg">Zona de Perigo</h3>
                    <p className="text-sm text-danger-soft-ink mt-1">Apagar todos os dados locais do aplicativo. Esta ação não pode ser desfeita e os dados não sincronizados serão perdidos.</p>
                  </div>
                  <Button variant="danger" onClick={handleClearData} className="whitespace-nowrap shrink-0">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Apagar Tudo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabPanel>
        </div>
      </div>

      <div className="text-center text-xs text-navy-3 pb-10">
        InspecVISA PWA v1.0.0 • Dados salvos localmente
      </div>
      {confirmDialog}
    </PageShell>
  );
}
