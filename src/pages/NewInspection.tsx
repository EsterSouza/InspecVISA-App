import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ArrowLeft, WifiOff, Loader2, AlertTriangle, FileText } from 'lucide-react';
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
import { Badge } from '../components/ui/Badge';
import { generateId } from '../utils/imageUtils';
import { ProfileModal } from '../components/profile/ProfileModal';
import { ScheduleService } from '../services/scheduleService';
import type { Schedule } from '../types';
import { isInspectionAppointment } from '../utils/appointmentType';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';

export function NewInspection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedClientId = searchParams.get('clientId');
  const preSelectedScheduleId = searchParams.get('scheduleId') || undefined;
  
  const settings = useSettingsStore((s) => s.settings);
  const tenantInfo = useAuthStore((s) => s.tenantInfo);
  const [step, setStep] = useState(preSelectedClientId ? 2 : 1);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  
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
    if (selectedClient && inspectionDate && step === 3) {
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
  }, [selectedClient, inspectionDate, step, preSelectedScheduleId]);

  useEffect(() => {
    setConfirmedSeparateVisit(false);
    if (!selectedClient || !inspectionDate || step !== 3) {
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
  }, [selectedClient, inspectionDate, step]);

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

      // Se houver um agendamento compatível, pergunta se quer vincular
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

  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-3 mb-2 text-gray-500">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Nova Inspeção</h1>
        </div>
        {!isOnline && (
          <div className="flex items-center text-amber-600 bg-amber-50 px-4 py-2 rounded-xl text-sm font-bold border border-amber-100">
            <WifiOff className="mr-2 h-4 w-4" /> Modo Offline
          </div>
        )}
      </div>

      <div className="mb-10 flex gap-4 overflow-hidden rounded-2xl bg-white p-2 border border-gray-100 shadow-sm">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-2 rounded-full transition-all duration-500 ${step >= s ? 'bg-primary-500' : 'bg-gray-100'}`} />
        ))}
      </div>

      <div className="min-h-[400px]">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Selecione o estabelecimento:</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {clients.map(client => (
                <Card 
                  key={client.id}
                  className={`cursor-pointer transition-all border-2 ${selectedClient?.id === client.id ? 'border-primary-500 bg-primary-50/30' : 'border-gray-100'}`}
                  onClick={() => {
                    setSelectedClient(client);
                    setSelectedTemplate(null);
                  }}
                >
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900">{client.name}</h3>
                    <div className="flex items-center mt-2 gap-2">
                      <Badge variant="neutral" className="uppercase text-[9px]">{client.category}</Badge>
                      <span className="text-xs text-gray-400">{client.city || 'Cidade N/D'}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="pt-10 flex justify-end">
              <Button disabled={!selectedClient} onClick={() => setStep(2)} className="h-12 px-8">
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && selectedClient && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
             <h2 className="text-xl font-bold text-gray-800 mb-6">Escolha o Roteiro <span className="text-primary-600">({selectedClient.category?.toUpperCase() || 'GERAL'})</span></h2>
             <div className="grid gap-4">
               {templates.filter(t => t.category === selectedClient.category && !t.name.includes('[ARQUIVADO]')).map(t => {
                 const effectiveTemplate = getEffectiveTemplate(t, selectedClient, undefined, true, new Date());
                 return (
                 <Card 
                    key={t.id}
                    className={`cursor-pointer p-6 transition-all border-2 ${selectedTemplate?.id === t.id ? 'border-primary-500 bg-primary-50/30' : 'border-gray-100'}`}
                    onClick={() => setSelectedTemplate(t)}
                  >
                    <div className="flex justify-between items-center">
                       <div>
                          <h3 className="font-bold text-gray-900 text-lg">{effectiveTemplate.name}</h3>
                          <p className="text-sm text-gray-400 mt-1">Roteiro completo para {selectedClient.category}</p>
                       </div>
                       <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${selectedTemplate?.id === t.id ? 'border-primary-500' : 'border-gray-200'}`}>
                          {selectedTemplate?.id === t.id && <div className="h-3 w-3 rounded-full bg-primary-500" />}
                       </div>
                    </div>
                 </Card>
                 );
               })}
             </div>
             <div className="pt-10 flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="h-12">Voltar</Button>
                <Button disabled={!selectedTemplate} onClick={() => setStep(3)} className="h-12 px-8">
                  Configurar Visita <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === 3 && selectedClient && selectedTemplate && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8 space-y-8">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <h3 className="font-bold text-gray-900">Já existe inspeção deste local nos últimos 31 dias?</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Se for complemento da mesma visita, continue no relatório existente. Só crie outro relatório se for uma visita nova e independente.
                      </p>
                    </div>
                  </div>

                  {matchingSchedule && (
                    <p className="rounded-xl bg-white px-4 py-3 text-sm text-primary-800 border border-primary-100">
                      Existe um agendamento para esta unidade na data selecionada. Use o relatório vinculado, se ele já tiver sido iniciado.
                    </p>
                  )}

                  {checkingExistingVisits ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verificando relatórios recentes na nuvem...
                    </div>
                  ) : existingVisits.length > 0 ? (
                    <div className="space-y-2">
                      {existingVisits.slice(0, 4).map(inspection => (
                        <div key={inspection.id} className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 text-primary-600" />
                            <div className="text-sm">
                              <p className="font-semibold text-gray-900">
                                {new Date(inspection.inspectionDate).toLocaleDateString('pt-BR')} - {inspection.status === 'completed' ? 'Concluída' : 'Em andamento'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Aberta por <span className="font-semibold text-gray-700">{inspection.consultantName || '—'}</span>
                                {inspection.createdAt ? ` em ${new Date(inspection.createdAt).toLocaleString('pt-BR')}` : ''}
                              </p>
                              <p className="text-gray-500">Este é o relatório obrigatório para complementar a avaliação.</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => continueExistingInspection(inspection)}>
                            Continuar relatório
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhum relatório recente encontrado para esta unidade.</p>
                  )}
                  {existingVisits.length > 0 && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-4 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={confirmedSeparateVisit}
                        onChange={(event) => setConfirmedSeparateVisit(event.target.checked)}
                      />
                      <span>Confirmo que esta é uma visita nova e independente, mesmo ocorrendo em menos de 31 dias.</span>
                    </label>
                  )}
              </div>

              <div>
                 <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Responsável no Local</label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <input placeholder="Nome do acompanhante" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-primary-500 outline-none" value={accompanistName} onChange={(e) => setAccompanistName(e.target.value)} />
                    <input placeholder="Cargo/Função" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-primary-500 outline-none" value={accompanistRole} onChange={(e) => setAccompanistRole(e.target.value)} />
                 </div>
              </div>

              {selectedClient.category === 'ilpi' && (
                <div className="space-y-4 pt-4 border-t border-gray-50">
                   <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Dados do ILPI</label>
                   <p className="text-xs text-gray-400 -mt-2">Pré-preenchido a partir do último relatório, se houver. Confira e ajuste.</p>
                   <div className="grid grid-cols-2 gap-4">
                      <input type="number" placeholder="Capacidade" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary-500 outline-none" value={ilpiCapacity} onChange={(e) => setIlpiCapacity(e.target.value)} />
                      <input type="number" placeholder="Total Residentes" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary-500 outline-none" value={residentsTotal} onChange={(e) => setResidentsTotal(e.target.value)} />
                   </div>
                   <label className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">Residentes por grau de dependência</label>
                   <div className="grid grid-cols-3 gap-4">
                      <input type="number" placeholder="Grau I" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary-500 outline-none" value={dep1} onChange={(e) => setDep1(e.target.value)} />
                      <input type="number" placeholder="Grau II" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary-500 outline-none" value={dep2} onChange={(e) => setDep2(e.target.value)} />
                      <input type="number" placeholder="Grau III" className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary-500 outline-none" value={dep3} onChange={(e) => setDep3(e.target.value)} />
                   </div>
                   {grausMismatch && (
                     <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                       A soma dos graus ({grausSum}) está diferente do total de residentes ({residentsNum}). Revise antes de iniciar.
                     </p>
                   )}
                </div>
              )}

              <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-10">
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Data da Inspeção</label>
                    <input type="date" className="mt-2 block w-full text-lg font-bold text-primary-900 bg-transparent outline-none" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
                 </div>
                 <div className="text-right">
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Estabelecimento</label>
                    <div className="mt-2 text-lg font-bold text-gray-900 truncate">{selectedClient.name}</div>
                 </div>
              </div>
            </div>

            <div className="pt-10 flex flex-col sm:flex-row justify-between gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="h-14 px-8">Voltar</Button>
              <Button 
                onClick={handleStart} 
                className="h-14 px-12 bg-primary-600 hover:bg-primary-700 text-lg font-bold shadow-2xl shadow-primary-200"
                disabled={isStarting}
              >
                {isStarting ? <Loader2 className="animate-spin" /> : 'INICIAR AGORA'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
      {confirmDialog}
    </PageShell>
  );
}
