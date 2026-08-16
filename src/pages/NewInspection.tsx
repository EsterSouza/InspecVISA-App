import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, WifiOff, Loader2, AlertTriangle, FileText, Search, CalendarDays, CheckCircle2 } from 'lucide-react';
import { db, initializeDatabase } from '../db/database';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { getTemplates, getEffectiveTemplate } from '../data/templates';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { getLocalActor } from '../utils/localActor';
import type { Client, ChecklistTemplate, Inspection } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { generateId } from '../utils/imageUtils';
import { ProfileModal } from '../components/profile/ProfileModal';
import { ScheduleService } from '../services/scheduleService';
import type { Schedule } from '../types';
import { isInspectionAppointment } from '../utils/appointmentType';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';

/** Rótulo + controle + ajuda — o campo composto do Artefato D. */
function Field({ label, htmlFor, hint, optional, children }: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-navy-3">opcional</span>}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-navy-3">{hint}</p>}
    </div>
  );
}

/** Cartão numerado de um dos três blocos da página. */
function Block({ n, title, aside, children }: {
  n: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy">{n} · {title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function countItems(template: ChecklistTemplate) {
  const items = template.sections.flatMap((s) => s.items);
  return { total: items.length, critical: items.filter((i) => i.isCritical).length };
}

export function NewInspection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedClientId = searchParams.get('clientId');
  const preSelectedScheduleId = searchParams.get('scheduleId') || undefined;

  const settings = useSettingsStore((s) => s.settings);
  const tenantInfo = useAuthStore((s) => s.tenantInfo);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [clientQuery, setClientQuery] = useState('');

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(!settings.name);
  const [matchingSchedule, setMatchingSchedule] = useState<Schedule | null>(null);
  const [existingVisits, setExistingVisits] = useState<Inspection[]>([]);
  const [checkingExistingVisits, setCheckingExistingVisits] = useState(false);
  const [confirmedSeparateVisit, setConfirmedSeparateVisit] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const [accompanistName, setAccompanistName] = useState('');
  const [accompanistRole, setAccompanistRole] = useState('');
  const [ilpiCapacity, setIlpiCapacity] = useState('');
  const [residentsTotal, setResidentsTotal] = useState('');
  const [dep1, setDep1] = useState('');
  const [dep2, setDep2] = useState('');
  const [dep3, setDep3] = useState('');

  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Decisão 23 aplicada ao `/new`: os três blocos ficam na mesma página e o de
  // baixo só acorda quando o de cima está resolvido. Não há passo 1/2/3.
  const readyForVisit = Boolean(selectedClient && selectedTemplate);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const cList = await ClientService.getClients();
        setClients(cList);

        if (preSelectedClientId) {
          const found = cList.find(c => c.id === preSelectedClientId);
          if (found) setSelectedClient(found);
        }
        if (preSelectedScheduleId) {
          const schedules = await ScheduleService.getSchedules();
          const schedule = schedules.find(s => s.id === preSelectedScheduleId);
          if (schedule) {
            setInspectionDate(schedule.scheduledAt.toISOString().split('T')[0]);
          }
        }

        let dbTemplates = await db.templates.toArray();

        // Roteiro do servidor tem id UUID; os empacotados começam com 'tpl-'. Sem nenhum
        // roteiro remoto em cache (aparelho novo, ou antes do sync de fundo, que só roda
        // 6s depois do boot), a inspeção nasceria presa ao roteiro empacotado e cada
        // resposta gravaria um id de código (`fed-001`…) que não existe em
        // `checklist_items`. Foi assim que 6 inspeções concluídas ficaram com o relatório
        // dependendo de um roteiro que depois sumiu do app. Esperar o sync é melhor do que
        // criar a inspeção presa ao roteiro errado — offline, o empacotado segue valendo.
        if (navigator.onLine && !dbTemplates.some(t => !t.id.startsWith('tpl-'))) {
          try {
            const { TemplateService } = await import('../services/templateService');
            const remotos = await TemplateService.syncAllTemplatesToDexie();
            if (remotos.length > 0) {
              await initializeDatabase([...getTemplates(), ...remotos]);
              dbTemplates = await db.templates.toArray();
            }
          } catch (err) {
            console.warn('[NewInspection] Sync de roteiros falhou; seguindo com o empacotado:', err);
          }
        }

        const staticTemplates = getTemplates();
        const dbNames = new Set(dbTemplates.map(t => t.name));
        const mergedTemplates = [
          ...dbTemplates,
          ...staticTemplates.filter(t => !dbNames.has(t.name)),
        ];
        setTemplates(mergedTemplates.length > 0 ? mergedTemplates : staticTemplates);
      } catch (err) {
        console.error('Error initializing new inspection:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [preSelectedClientId, preSelectedScheduleId]);

  // Detect matching schedule
  useEffect(() => {
    if (selectedClient && inspectionDate && readyForVisit) {
      void (async () => {
        try {
          const schedules = await ScheduleService.getSchedules();
          const targetDateStr = inspectionDate; // "YYYY-MM-DD"

          const forcedMatch = preSelectedScheduleId
            ? schedules.find(s => s.id === preSelectedScheduleId && s.clientId === selectedClient.id && s.status === 'pending' && isInspectionAppointment(s.appointmentType))
            : undefined;
          const match = forcedMatch || schedules.find(s => {
            const sDateStr = s.scheduledAt.toISOString().split('T')[0];
            return s.clientId === selectedClient.id && sDateStr === targetDateStr && s.status === 'pending' && isInspectionAppointment(s.appointmentType);
          });

          setMatchingSchedule(match || null);
        } catch (err) {
          console.error('Error checking for matching schedule:', err);
        }
      })();
    } else {
      setMatchingSchedule(null);
    }
  }, [selectedClient, inspectionDate, readyForVisit, preSelectedScheduleId]);

  useEffect(() => {
    setConfirmedSeparateVisit(false);
    if (!selectedClient || !inspectionDate || !readyForVisit) {
      setExistingVisits([]);
      return;
    }

    let active = true;
    setCheckingExistingVisits(true);
    void InspectionService
      .getRecentInspectionCandidates(selectedClient.id, new Date(inspectionDate + 'T12:00:00'))
      .then(candidates => {
        if (active) setExistingVisits(candidates);
      })
      .catch(err => console.warn('[NewInspection] Existing report lookup failed:', err))
      .finally(() => {
        if (active) setCheckingExistingVisits(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClient, inspectionDate, readyForVisit]);

  // Pré-preenche dados ILPI (capacidade, residentes, graus) a partir do último relatório do cliente.
  useEffect(() => {
    if (!selectedClient || selectedClient.category !== 'ilpi') return;
    let active = true;
    void InspectionService.getLatestIlpiDefaults(selectedClient.id).then((d) => {
      if (!active || !d) return;
      setIlpiCapacity((prev) => prev || (d.ilpiCapacity ? String(d.ilpiCapacity) : ''));
      setResidentsTotal((prev) => prev || (d.residentsTotal ? String(d.residentsTotal) : ''));
      setDep1((prev) => prev || (d.dependencyLevel1 ? String(d.dependencyLevel1) : ''));
      setDep2((prev) => prev || (d.dependencyLevel2 ? String(d.dependencyLevel2) : ''));
      setDep3((prev) => prev || (d.dependencyLevel3 ? String(d.dependencyLevel3) : ''));
    }).catch((err) => console.warn('[NewInspection] Pré-preenchimento ILPI falhou:', err));
    return () => { active = false; };
  }, [selectedClient]);

  const grausSum = (parseInt(dep1) || 0) + (parseInt(dep2) || 0) + (parseInt(dep3) || 0);
  const residentsNum = parseInt(residentsTotal) || 0;
  const grausMismatch = residentsNum > 0 && grausSum > 0 && grausSum !== residentsNum;

  // A parede de cartões vira lista com busca: com 24 clientes e redes de 13
  // unidades, o cartão por cliente é a rolagem que este redesenho existe para acabar.
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.city, c.state, c.category].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [clients, clientQuery]);

  const availableTemplates = useMemo(() => {
    if (!selectedClient) return [];
    return templates.filter(t => t.category === selectedClient.category && !t.name.includes('[ARQUIVADO]'));
  }, [templates, selectedClient]);

  const continueExistingInspection = (inspection: Inspection) => {
    navigate('/execute', {
      state: {
        inspectionId: inspection.id,
        linkedScheduleId: matchingSchedule?.id,
      }
    });
  };

  const handleStart = async () => {
    if (!selectedClient || !selectedTemplate) return;
    setIsStarting(true);

    try {
      if (preSelectedScheduleId) {
        await ScheduleService.assertInspectionSchedule(preSelectedScheduleId);
      }
      const candidates = await InspectionService.getRecentInspectionCandidates(
        selectedClient.id,
        new Date(inspectionDate + 'T12:00:00')
      );
      setExistingVisits(candidates);

      // ── Mesma data: NUNCA cria duplicata — direciona para a inspeção já aberta.
      // (Não há escape de "visita separada" no mesmo dia: é sempre o mesmo relatório.)
      const sameDateInspection = candidates.find(
        c => c.inspectionDate.toISOString().slice(0, 10) === inspectionDate
      );
      if (sameDateInspection) {
        const opener = sameDateInspection.consultantName || 'outra consultora';
        const openedAt = new Date(sameDateInspection.createdAt).toLocaleString('pt-BR');
        toast.warning(
          `Já existe uma inspeção para ${selectedClient.name} nesta data, aberta por ${opener} em ${openedAt}.`,
          'Para não duplicar, você será direcionada para esse relatório. Continue na mesma inspeção.'
        );
        const linkedScheduleId = matchingSchedule?.id;
        if (linkedScheduleId) {
          try { await ScheduleService.linkInspection(linkedScheduleId, sameDateInspection.id); } catch (e) { console.warn('[NewInspection] link schedule falhou:', e); }
        }
        continueExistingInspection(sameDateInspection);
        return;
      }

      const existingInspection = candidates[0];

      if (existingInspection && !confirmedSeparateVisit) {
        const existingDate = new Date(existingInspection.inspectionDate).toLocaleDateString('pt-BR');
        const ok = await confirm({
          title: 'Já existe uma inspeção para este local?',
          description: `Em ${existingDate}. Pela regra de 31 dias, todo complemento deve continuar no `
            + 'mesmo relatório. Se for uma visita realmente nova, confirme essa opção na tela.',
          confirmLabel: 'Abrir relatório existente',
          tone: 'default',
        });
        if (ok) {
          const linkedScheduleId = matchingSchedule?.id;
          if (linkedScheduleId) {
            await ScheduleService.linkInspection(linkedScheduleId, existingInspection.id);
          }
          continueExistingInspection(existingInspection);
          return;
        }
        toast.warning('Para criar outra inspeção em menos de 31 dias, confirme na tela que esta é uma visita realmente separada.');
        return;
      }

      const newInspectionId = generateId();
      const actor = getLocalActor();

      const inspectionData: Inspection = {
        id: newInspectionId,
        clientId: selectedClient.id,
        templateId: selectedTemplate.id,
        consultantName: actor.name,
        // Herda a(s) consultora(s) responsável(is) do agendamento; senão, quem está logada.
        consultantNames: (matchingSchedule?.consultantNames && matchingSchedule.consultantNames.length > 0)
          ? matchingSchedule.consultantNames
          : [actor.name],
        inspectionDate: new Date(inspectionDate + 'T12:00:00'),
        status: 'in_progress',
        createdAt: new Date(),
        city: selectedClient.city,
        state: selectedClient.state,
        accompanistName,
        accompanistRole,
        ilpiCapacity: ilpiCapacity ? parseInt(ilpiCapacity) : undefined,
        residentsTotal: residentsTotal ? parseInt(residentsTotal) : undefined,
        dependencyLevel1: dep1 ? parseInt(dep1) : undefined,
        dependencyLevel2: dep2 ? parseInt(dep2) : undefined,
        dependencyLevel3: dep3 ? parseInt(dep3) : undefined,
        updatedAt: new Date(),
        tenantId: selectedClient.tenantId || tenantInfo?.tenantId,
        localActorId: actor.id,
        syncStatus: 'pending'
      };

      // O vínculo com o agendamento é anunciado no resumo antes do clique — aqui
      // ele só é confirmado quando a consultora não veio de um agendamento.
      let linkedScheduleId = matchingSchedule?.id;
      if (matchingSchedule && !preSelectedScheduleId) {
        const linkOk = await confirm({
          title: 'Vincular agendamento existente?',
          description: `Existe um agendamento para ${selectedClient.name} hoje.`,
          confirmLabel: 'Vincular agendamento',
          tone: 'default',
        });
        if (!linkOk) {
          linkedScheduleId = undefined;
        }
      }

      // ✅ ONLINE-DIRECT: Salva direto no Supabase
      await InspectionService.createInspection(inspectionData);

      // Vincular agendamento se necessário
      if (linkedScheduleId) {
        await ScheduleService.linkInspection(linkedScheduleId, newInspectionId);
      }

      navigate('/execute', {
        state: {
          inspectionId: newInspectionId,
          linkedScheduleId: linkedScheduleId
        }
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar inspeção.');
    } finally {
      setIsStarting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const templateCounts = selectedTemplate ? countItems(selectedTemplate) : null;
  const dateLabel = new Date(inspectionDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const blockedByDuplicate = existingVisits.length > 0 && !confirmedSeparateVisit;

  return (
    <PageShell>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-3 mb-2 text-navy-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <PageHeader
        title="Nova inspeção"
        description="Escolha o local, o roteiro e confirme os dados da visita."
        actions={!isOnline && (
          <span className="inline-flex items-center gap-2 rounded-md border border-amber-soft-border bg-amber-soft px-3 py-2 text-sm font-medium text-amber-soft-ink">
            <WifiOff className="h-4 w-4" /> Sem conexão — o rascunho fica no aparelho
          </span>
        )}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── coluna do formulário ─────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {/* 1 · Estabelecimento */}
          <Block
            n={1}
            title="Estabelecimento"
            aside={selectedClient && (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> escolhido
              </Badge>
            )}
          >
            <div className="p-5 pb-3">
              <Field
                label="Buscar"
                htmlFor="busca-cliente"
                hint={clientQuery.trim()
                  ? `${filteredClients.length} de ${clients.length} locais correspondem.`
                  : `${clients.length} locais cadastrados.`}
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-3" />
                  <Input
                    id="busca-cliente"
                    type="search"
                    className="h-11 pl-9"
                    placeholder="Nome, unidade ou cidade"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div className="max-h-[22rem] overflow-y-auto border-t border-gray-200">
              {filteredClients.length === 0 ? (
                <p className="px-5 py-6 text-sm text-navy-3">
                  Nenhum local corresponde a “{clientQuery}”.{' '}
                  <button type="button" className="font-medium text-primary-700 underline" onClick={() => setClientQuery('')}>
                    Limpar a busca
                  </button>
                </p>
              ) : filteredClients.map((client) => {
                const isSelected = selectedClient?.id === client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedClient(client);
                      setSelectedTemplate(null);
                    }}
                    className={`flex w-full items-start gap-3 border-b border-gray-100 px-5 py-3 text-left last:border-b-0 hover:bg-gray-50 ${isSelected ? 'bg-primary-50' : ''}`}
                    style={{ minHeight: 44 }}
                  >
                    <Badge variant="neutral" className="mt-0.5 shrink-0 uppercase">{client.category}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy">{client.name}</span>
                      <span className="block truncate text-sm text-navy-3">
                        {[client.city, client.state].filter(Boolean).join(' · ') || 'Cidade não informada'}
                      </span>
                    </span>
                    {isSelected && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />}
                  </button>
                );
              })}
            </div>
          </Block>

          {/* 2 · Roteiro — só acorda com o estabelecimento escolhido, porque o
              roteiro depende da categoria do cliente. */}
          {selectedClient && (
            <Block
              n={2}
              title="Roteiro"
              aside={<Badge variant="neutral">categoria {selectedClient.category?.toUpperCase() || 'GERAL'}</Badge>}
            >
              <div className="space-y-3 p-5">
                {availableTemplates.length === 0 && (
                  <p className="text-sm text-navy-3">
                    Nenhum roteiro disponível para a categoria {selectedClient.category}.
                  </p>
                )}
                {availableTemplates.map((t) => {
                  const effective = getEffectiveTemplate(t, selectedClient, undefined, true, new Date());
                  const { total, critical } = countItems(effective);
                  const isSelected = selectedTemplate?.id === t.id;
                  return (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${isSelected ? 'border-primary-700 bg-primary-50' : 'border-gray-200'}`}
                      style={{ minHeight: 44 }}
                    >
                      <input
                        type="radio"
                        name="roteiro"
                        className="mt-1 h-4 w-4 shrink-0 accent-primary-700"
                        checked={isSelected}
                        onChange={() => setSelectedTemplate(t)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-navy">{effective.name}</span>
                        <span className="block text-sm text-navy-3">
                          {total} itens · {critical} críticos
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Block>
          )}

          {/* Espaço reservado do projeto COND: a pergunta de roteamento que já dá
              para responder antes da visita mora aqui, entre o roteiro e a visita.
              Ver docs/HANDOFF-CONDICIONAIS.md — nada é renderizado até o COND-08. */}

          {/* 3 · A visita */}
          {readyForVisit && selectedClient && (
            <Block n={3} title="A visita">
              <div className="space-y-6 p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <Field label="Data da visita" htmlFor="data-visita">
                    <Input
                      id="data-visita"
                      type="date"
                      className="h-11"
                      value={inspectionDate}
                      onChange={(e) => setInspectionDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Quem acompanha" htmlFor="acompanhante" optional>
                    <Input
                      id="acompanhante"
                      className="h-11"
                      placeholder="Nome de quem recebe a visita"
                      value={accompanistName}
                      onChange={(e) => setAccompanistName(e.target.value)}
                    />
                  </Field>
                  <Field label="Função" htmlFor="acompanhante-funcao" optional>
                    <Input
                      id="acompanhante-funcao"
                      className="h-11"
                      placeholder="Ex.: responsável técnica"
                      value={accompanistRole}
                      onChange={(e) => setAccompanistRole(e.target.value)}
                    />
                  </Field>
                </div>

                {selectedClient.category === 'ilpi' && (
                  <div className="border-t border-gray-100 pt-5">
                    <p className="font-medium text-navy">Dados do ILPI</p>
                    <p className="mb-3 text-xs text-navy-3">
                      Trazidos do último relatório desta unidade. Confira e ajuste.
                    </p>
                    <div className="flex flex-wrap items-start gap-4">
                      <Field label="Capacidade" htmlFor="ilpi-capacidade">
                        <Input id="ilpi-capacidade" type="number" inputMode="numeric" className="h-11" value={ilpiCapacity} onChange={(e) => setIlpiCapacity(e.target.value)} />
                      </Field>
                      <Field label="Residentes" htmlFor="ilpi-residentes">
                        <Input id="ilpi-residentes" type="number" inputMode="numeric" className="h-11" value={residentsTotal} onChange={(e) => setResidentsTotal(e.target.value)} />
                      </Field>
                    </div>
                    <p className="mb-2 mt-4 text-sm font-medium text-navy">Residentes por grau de dependência</p>
                    <div className="flex flex-wrap items-start gap-4">
                      <Field label="Grau I" htmlFor="ilpi-grau-1">
                        <Input id="ilpi-grau-1" type="number" inputMode="numeric" className="h-11" value={dep1} onChange={(e) => setDep1(e.target.value)} />
                      </Field>
                      <Field label="Grau II" htmlFor="ilpi-grau-2">
                        <Input id="ilpi-grau-2" type="number" inputMode="numeric" className="h-11" value={dep2} onChange={(e) => setDep2(e.target.value)} />
                      </Field>
                      <Field label="Grau III" htmlFor="ilpi-grau-3">
                        <Input id="ilpi-grau-3" type="number" inputMode="numeric" className="h-11" value={dep3} onChange={(e) => setDep3(e.target.value)} />
                      </Field>
                    </div>
                    {grausMismatch && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-soft-border bg-amber-soft p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-strong" />
                        <p className="text-sm text-amber-soft-ink">
                          A soma dos graus dá <strong>{grausSum}</strong> e o total de residentes é <strong>{residentsNum}</strong>.
                          Confira antes de começar — a calculadora de dimensionamento usa os graus.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Block>
          )}
        </div>

        {/* ── coluna do resumo ─────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <div className="border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-navy">Antes de começar</h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="text-sm text-navy-3">Local</p>
                <p className="font-medium text-navy">{selectedClient?.name || '— escolha no bloco 1 —'}</p>
              </div>
              <div>
                <p className="text-sm text-navy-3">Roteiro</p>
                <p className="font-medium text-navy">
                  {selectedTemplate && templateCounts
                    ? `${selectedTemplate.name} · ${templateCounts.total} itens`
                    : '— escolha no bloco 2 —'}
                </p>
              </div>
              <div>
                <p className="text-sm text-navy-3">Data</p>
                <p className="font-medium text-navy">{dateLabel}</p>
              </div>

              <hr className="border-gray-200" />

              {/* O vínculo com o agendamento aparece ANTES de começar: é ele que
                  faz o relatório chegar ao portal do cliente no fim. */}
              {matchingSchedule && (
                <div className="flex items-start gap-2 rounded-md border border-primary-100 bg-primary-50 p-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                  <p className="text-sm text-navy-2">
                    <strong className="text-navy">Há um agendamento nesta data.</strong> A inspeção será
                    vinculada a ele — é o vínculo que faz o relatório chegar ao portal do cliente no fim.
                  </p>
                </div>
              )}

              <Button
                size="lg"
                fullWidth
                onClick={handleStart}
                disabled={!readyForVisit || isStarting || blockedByDuplicate}
              >
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar inspeção'}
              </Button>
              <p className="text-xs text-navy-3">
                {blockedByDuplicate
                  ? 'Há relatório recente para este local. Continue nele, ou confirme abaixo que esta é uma visita separada.'
                  : 'Você pode parar e voltar quando quiser. Nada é publicado agora.'}
              </p>
            </div>
          </Card>

          {/* A checagem de duplicata sai do meio do formulário e passa a viver ao
              lado do botão — é a informação que decide se deve ou não clicar. */}
          {readyForVisit && (
            <Card>
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-navy">Visitas recentes aqui</h2>
                {existingVisits.length > 0 && (
                  <Badge variant="warning">{existingVisits.length} nos últimos 31 dias</Badge>
                )}
              </div>
              <div className="space-y-3 p-5">
                {checkingExistingVisits ? (
                  <p className="flex items-center gap-2 text-sm text-navy-3">
                    <Loader2 className="h-4 w-4 animate-spin" /> Verificando relatórios recentes…
                  </p>
                ) : existingVisits.length === 0 ? (
                  <p className="text-sm text-navy-3">Nenhum relatório recente para esta unidade.</p>
                ) : (
                  <>
                    <p className="text-sm text-navy-2">
                      Pela regra dos 31 dias, complemento de visita continua no mesmo relatório.
                      Só crie outro se for uma visita realmente separada.
                    </p>
                    {existingVisits.slice(0, 4).map((inspection) => (
                      <div key={inspection.id} className="rounded-md border border-amber-soft-border bg-amber-soft p-3">
                        <p className="flex items-start gap-2 text-sm font-medium text-amber-soft-ink">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            {new Date(inspection.inspectionDate).toLocaleDateString('pt-BR')} ·{' '}
                            {inspection.status === 'completed' ? 'concluída' : 'em andamento'}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-amber-soft-ink">
                          Aberta por {inspection.consultantName || '—'}
                          {inspection.createdAt ? ` em ${new Date(inspection.createdAt).toLocaleString('pt-BR')}` : ''}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          fullWidth
                          className="mt-3 bg-white"
                          onClick={() => continueExistingInspection(inspection)}
                        >
                          Continuar este relatório
                        </Button>
                      </div>
                    ))}
                    <label className="flex cursor-pointer items-start gap-3 text-sm text-navy-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-700"
                        checked={confirmedSeparateVisit}
                        onChange={(event) => setConfirmedSeparateVisit(event.target.checked)}
                      />
                      <span>Confirmo que esta é uma visita nova e independente, mesmo em menos de 31 dias.</span>
                    </label>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
      {confirmDialog}
    </PageShell>
  );
}
