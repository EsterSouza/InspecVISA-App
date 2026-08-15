import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  CalendarPlus,
  Copy,
  FileText, 
  TrendingUp, 
  AlertCircle, 
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Edit2,
  Trash2
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { db } from '../db/database';
import { type AppointmentAttachment, type AppointmentRequest, type Client, type ClientContact, type ClientPortalAuditEvent, type Inspection, type InspectionScore, type Schedule, FOOD_SEGMENT_LABELS } from '../types';
import { calculateScore, calculateAreaScores, type InspectionAreaScores } from '../utils/scoring';
import { formatDateTime } from '../utils/imageUtils';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../services/appointmentAdminService';
import { ScheduleService } from '../services/scheduleService';
import { filterByActiveTenant } from '../utils/localScope';
import { getClientActionPlanContext, type ClientActionPlanContext, type PreviousNCContext } from '../utils/actionPlanContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

const ComplianceTrendChart = lazy(() =>
  import('../components/client/ComplianceTrendChart').then(m => ({ default: m.ComplianceTrendChart }))
);

export function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [inspections, setInspections] = useState<(Inspection & { score: InspectionScore; areaScores: InspectionAreaScores })[]>([]);
  const [actionPlan, setActionPlan] = useState<ClientActionPlanContext>({ latestOpenItems: [], recurringItems: [] });
  const [portalAccounts, setPortalAccounts] = useState<ClientPortalAccountRow[]>([]);
  const [portalAuditEvents, setPortalAuditEvents] = useState<ClientPortalAuditEvent[]>([]);
  const [portalAuditError, setPortalAuditError] = useState<string | null>(null);
  const [clientRequests, setClientRequests] = useState<AppointmentRequest[]>([]);
  const [publishedAssets, setPublishedAssets] = useState<Record<string, AppointmentAttachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [copiedAccess, setCopiedAccess] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState<string | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('09:00');
  const [visitMode, setVisitMode] = useState<'presencial' | 'online'>('presencial');
  const [visitDistrict, setVisitDistrict] = useState('');
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([{ name: '', phone: '', email: '' }]);
  
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<Client>();
  const selectedCategory = watch('category');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const clientData = await ClientService.getClientById(id);
        if (!clientData) {
          setLoadError('Cliente nao encontrado neste perfil ou sem acesso para o tenant atual.');
          return;
        }
        setClient(clientData);
        setClientContacts(
          clientData.contacts?.length
            ? clientData.contacts
            : [{ name: clientData.responsibleName || '', phone: clientData.phone || '', email: clientData.email || '' }]
        );

        // Garante que as respostas de inspeções feitas em outro dispositivo estejam
        // no Dexie local antes de calcular scores e plano de ação (senão o desktop
        // mostra histórico/recorrentes incompletos). Ver sync-no-full-response-hydration.
        await InspectionService.hydrateTenantResponses().catch(() => {});

        // Load all inspections for this client
        const rawInspections = filterByActiveTenant(await db.inspections.where('clientId').equals(id).toArray())
          .filter(i => !i.deletedAt);
        const allInspIds = rawInspections.map((i: any) => i.id);
        
        // Load all responses for these inspections at once
        const allResponses = allInspIds.length > 0
          ? filterByActiveTenant(await db.responses.where('inspectionId').anyOf(allInspIds).toArray()).filter(r => !r.deletedAt)
          : [];

        const inspectionsWithScores = (await Promise.all(
          rawInspections.map(async (insp: any) => {
            const responses = allResponses.filter((r: any) => r.inspectionId === insp.id);
            const template = await db.templates.get(insp.templateId); // Keep templates in Dexie
            const sections = template?.sections || [];
            const score = calculateScore(responses, sections);
            const areaScores = calculateAreaScores(responses, sections);
            return { ...insp, score, areaScores };
          })
        )).sort((a, b) => new Date(b.inspectionDate || b.createdAt).getTime() - new Date(a.inspectionDate || a.createdAt).getTime());

        setInspections(inspectionsWithScores);
        setActionPlan(await getClientActionPlanContext(id));
        if (navigator.onLine) {
          const [accountsResult, requestsResult] = await Promise.allSettled([
            AppointmentAdminService.listPortalAccounts(),
            AppointmentAdminService.listRequests(),
          ]);
          const accounts = accountsResult.status === 'fulfilled' ? accountsResult.value : [];
          const requests = requestsResult.status === 'fulfilled' ? requestsResult.value : [];
          if (accountsResult.status === 'rejected') {
            console.warn('[ClientDetails] Falha ao carregar acessos do portal:', accountsResult.reason);
          }
          if (requestsResult.status === 'rejected') {
            console.warn('[ClientDetails] Falha ao carregar visitas do portal:', requestsResult.reason);
          }
          setPortalAccounts(accounts);
          const mine = requests.filter((request) => request.client_id === id);
          setClientRequests(mine);
          const auditAccount = accounts.find((account) => account.client_ids.includes(id));
          AppointmentAdminService.listPortalAuditEvents(auditAccount ? { accountId: auditAccount.id, limit: 20 } : { clientId: id, limit: 20 })
            .then((events) => {
              setPortalAuditEvents(events);
              setPortalAuditError(null);
            })
            .catch((err) => {
              // Falha de leitura tem de aparecer na tela: por meses a trilha nao existia e o painel
              // mostrava "nenhuma atividade", que e exatamente como parece estar tudo bem.
              console.error('[ClientDetails] Falha ao carregar auditoria do portal:', err);
              setPortalAuditEvents([]);
              setPortalAuditError(err instanceof Error ? err.message : String(err));
            });
          const assets: Record<string, AppointmentAttachment[]> = {};
          await Promise.allSettled(
            mine.map(async (request) => {
              assets[request.id] = await AppointmentAdminService.listAttachments(request.id);
            })
          );
          setPublishedAssets(assets);
        }

      } catch (err) {
        console.error('Error loading client details:', err);
        setLoadError('Erro ao carregar os detalhes. Verifique a conexao com a internet.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  const onEditSubmit = async (data: Client) => {
    if (!navigator.onLine) {
      alert('Sem conexão com a internet. Não é possível salvar no momento.');
      return;
    }
    try {
      if (!client) return;
      const updatedClient: Client = {
        ...client,
        ...data,
        updatedAt: new Date()
      };
      const contacts = clientContacts
        .map((contact) => ({
          name: contact.name?.trim() || undefined,
          phone: contact.phone?.trim() || undefined,
          email: contact.email?.trim() || undefined,
        }))
        .filter((contact) => contact.name || contact.phone || contact.email);
      const primaryContact = contacts[0];
      updatedClient.contacts = contacts;
      updatedClient.responsibleName = primaryContact?.name;
      updatedClient.phone = primaryContact?.phone;
      updatedClient.email = primaryContact?.email;

      if (updatedClient.category !== 'alimentos') {
        delete updatedClient.foodTypes;
      }

      await ClientService.saveClient(updatedClient);
      setClient({ ...updatedClient, syncStatus: 'synced' });
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao atualizar cliente.');
    }
  };

  const makeAccessCode = () => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  const makeUsername = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/(^\.|\.$)/g, '')
      .slice(0, 28);

  const portalAccount = client
    ? portalAccounts.find((account) => account.client_ids.includes(client.id)) || null
    : null;

  const portalUrl = `${window.location.origin}/cliente`;
  const portalDirectUrl = portalUrl;
  const portalAuditLabels: Record<string, string> = {
    login: 'Login no portal',
    overview_viewed: 'Abriu painel',
    appointment_viewed: 'Abriu visita',
    report_download_clicked: 'Clicou para baixar relatorio',
    attachment_download_clicked: 'Clicou em anexo',
    photo_download_clicked: 'Clicou em foto',
    photo_gallery_opened: 'Abriu galeria',
    payment_link_clicked: 'Clicou no pagamento',
    payment_acknowledged: 'Avisou que pagou',
    sanitary_folder_opened: 'Abriu pasta sanitaria',
    main_drive_folder_opened: 'Abriu pasta principal completa',
    portal_tutorial_opened: 'Abriu tutorial do portal',
    schedule_cta_clicked: 'Clicou para agendar horario',
    support_whatsapp_clicked: 'Clicou no WhatsApp da consultoria',
  };
  const formatAuditPayload = (event: ClientPortalAuditEvent) => {
    const payload = event.payload || {};
    const fileName = typeof payload.file_name === 'string' ? payload.file_name : '';
    const label = typeof payload.label === 'string' ? payload.label : '';
    const unitName = typeof payload.unit_name === 'string' ? payload.unit_name : '';
    return fileName || label || unitName || '';
  };

  const copyPortalAccess = async () => {
    if (!portalAccount) return;
    await navigator.clipboard.writeText([
      `Portal do Cliente: ${portalDirectUrl}`,
      `E-mail: ${portalAccount.email}`,
      portalAccount.username ? `Usuario: ${portalAccount.username}` : '',
      portalAccount.access_code_plain ? `Senha: ${portalAccount.access_code_plain}` : '',
      `Token: ${portalAccount.portal_token}`,
    ].filter(Boolean).join('\n'));
    setCopiedAccess(true);
    window.setTimeout(() => setCopiedAccess(false), 2500);
  };

  const refreshPortalAccounts = async () => {
    setPortalAccounts(await AppointmentAdminService.listPortalAccounts());
  };

  const createPortalAccess = async () => {
    if (!client) return;
    if (!client.email) {
      alert('Informe um e-mail no cadastro do cliente antes de criar o acesso.');
      return;
    }
    setAccessBusy(true);
    try {
      const code = makeAccessCode();
      await AppointmentAdminService.createPortalAccount({
        name: client.responsibleName || client.name,
        email: client.email,
        username: `${makeUsername(client.name)}.${client.id.slice(0, 4)}`,
        code,
        clientIds: [client.id],
      });
      setNewAccessCode(code);
      await refreshPortalAccounts();
    } catch (err: any) {
      alert(err.message || 'Falha ao criar acesso do cliente.');
    } finally {
      setAccessBusy(false);
    }
  };

  const regenerateAccessCode = async () => {
    if (!portalAccount) return;
    setAccessBusy(true);
    try {
      const code = makeAccessCode();
      await AppointmentAdminService.setPortalAccessCode(portalAccount.id, code);
      setNewAccessCode(code);
      await refreshPortalAccounts();
    } catch (err: any) {
      alert(err.message || 'Falha ao gerar nova senha.');
    } finally {
      setAccessBusy(false);
    }
  };

  const regeneratePortalToken = async () => {
    if (!portalAccount) return;
    if (!confirm('Gerar novo token? Links diretos antigos deixam de funcionar.')) return;
    setAccessBusy(true);
    try {
      await AppointmentAdminService.regeneratePortalToken(portalAccount.id);
      await refreshPortalAccounts();
    } catch (err: any) {
      alert(err.message || 'Falha ao gerar novo token.');
    } finally {
      setAccessBusy(false);
    }
  };

  const removePublishedAsset = async (asset: AppointmentAttachment) => {
    if (!confirm('Remover este arquivo do portal do cliente? O arquivo original nao sera apagado.')) return;
    await AppointmentAdminService.removePublishedAttachment(asset.id);
    setPublishedAssets((current) => ({
      ...current,
      [asset.appointment_request_id]: (current[asset.appointment_request_id] || []).filter((item) => item.id !== asset.id),
    }));
  };

  const createConfirmedVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !visitDate) return;
    try {
      const scheduledAt = new Date(`${visitDate}T${visitTime || '09:00'}`);
      const schedule: Schedule = {
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        scheduledAt,
        status: 'pending',
        updatedAt: new Date(),
        tenantId: client.tenantId,
        syncStatus: 'pending',
      };
      await ScheduleService.saveSchedule(schedule);
      await AppointmentAdminService.insertConfirmedRequest({
        clientId: client.id,
        unitName: client.name,
        responsibleName: client.responsibleName,
        phone: client.phone,
        email: client.email,
        scheduleId: schedule.id,
        date: visitDate,
        time: visitTime || '09:00',
        attendanceMode: visitMode,
        municipality: client.city,
        district: visitMode === 'presencial' ? visitDistrict || client.city || '' : 'Online',
      });
      setIsVisitModalOpen(false);
      setVisitDate('');
      const requests = await AppointmentAdminService.listRequests();
      setClientRequests(requests.filter((request) => request.client_id === client.id));
    } catch (err: any) {
      alert(err.message || 'Falha ao criar nova visita.');
    }
  };


  const handleDelete = async () => {
    if (!client) return;
    if (!navigator.onLine) {
      alert('Sem conexão com a internet. Não é possível excluir no momento.');
      return;
    }
    if (window.confirm(`Deseja realmente excluir o cliente "${client.name}"? Todas as inspeções e fotos associadas serão apagadas permanentemente.`)) {
      try {
        await ClientService.deleteClient(client.id);
        navigate('/clients');
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Erro ao excluir cliente.');
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Carregando detalhes...</div>;
  }

  if (loadError || !client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <p className="max-w-md font-semibold text-gray-700">{loadError || 'Cliente nao encontrado.'}</p>
        <Button variant="outline" onClick={() => navigate('/clients')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  const chartData = [...inspections]
    .reverse()
    .filter(i => i.status === 'completed')
    .map(i => ({
      date: new Date(i.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      score: Math.round(i.score?.scorePercentage || 0),
    }));

  const latestInspection = inspections.find(i => i.status === 'completed');
  const latestActionInspection = actionPlan.latestInspection || latestInspection;
  const openActionItems = actionPlan.latestOpenItems;
  const recurringActionItems = actionPlan.recurringItems;
  const openActionPlan = () => {
    if (!client || !latestActionInspection || openActionItems.length === 0) return;
    navigate(`/plano-de-acao?client=${client.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="-ml-3 mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="default">{client.category?.toUpperCase() || 'SEM CATEGORIA'}</Badge>
              <span className="text-sm text-gray-500">Cód: {client.id.substring(0, 8)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(client); setIsModalOpen(true); }}>
              <Edit2 className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsVisitModalOpen(true)}>
              <CalendarPlus className="mr-2 h-4 w-4" /> Nova visita
            </Button>
            <Button onClick={() => navigate(`/new?clientId=${client.id}`)}>
              <Calendar className="mr-2 h-4 w-4" /> Nova Inspeção
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics & Evolution */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-primary-600" />
                  Evolução da Conformidade
                </h2>
              </div>
              
              {chartData.length > 1 ? (
                <div className="h-64 w-full">
                  <Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-gray-50" />}>
                    <ComplianceTrendChart data={chartData} />
                  </Suspense>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                  <Activity className="h-10 w-10 mb-2 opacity-20" />
                  <p>Dados insuficientes para gerar gráfico.</p>
                  <p className="text-xs">Realize pelo menos 2 inspeções concluídas.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center px-1">
              <FileText className="mr-2 h-5 w-5 text-gray-500" />
              Histórico de Visitas
            </h2>
            {inspections.length === 0 ? (
              <p className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">Nenhuma visita registrada.</p>
            ) : (
              <div className="space-y-3">
                {inspections.map((insp) => (
                  <Card key={insp.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(insp.status === 'in_progress' ? '/execute' : '/summary', { state: { inspectionId: insp.id }})}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold ${
                          insp.status === 'in_progress' ? 'bg-amber-400' :
                          insp.score.scorePercentage >= 90 ? 'bg-green-500' :
                          insp.score.scorePercentage >= 70 ? 'bg-blue-500' :
                          'bg-red-500'
                        }`}>
                          {insp.status === 'completed' ? `${Math.round(insp.score.scorePercentage)}%` : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{formatDateTime(insp.createdAt)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={insp.status === 'completed' ? 'success' : 'warning'}>
                              {insp.status === 'completed' ? 'Finalizada' : 'Em andamento'}
                            </Badge>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">{insp.score.compliesCount} conformidades</span>
                          </div>
                          {insp.status === 'completed' && client.category === 'ilpi' && insp.areaScores.isSplit && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold">
                              <span className="text-gray-600">
                                {insp.areaScores.sanitary.areaLabel}
                                {insp.areaScores.sanitary.consultant ? ` (${insp.areaScores.sanitary.consultant.split(/\s+/)[0]})` : ''}
                                <span className="ml-1 text-gray-900">{Math.round(insp.areaScores.sanitary.score.scorePercentage)}%</span>
                              </span>
                              <span className="text-gray-600">
                                {insp.areaScores.nutrition.areaLabel}
                                {insp.areaScores.nutrition.consultant ? ` (${insp.areaScores.nutrition.consultant.split(/\s+/)[0]})` : ''}
                                <span className="ml-1 text-gray-900">{Math.round(insp.areaScores.nutrition.score.scorePercentage)}%</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 flex items-center text-sm font-bold uppercase tracking-wider text-gray-900">
                Portal do Cliente
              </h3>
              {portalAccount ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-bold uppercase text-gray-400">Link direto</p>
                    <p className="mt-1 break-all font-mono text-xs text-gray-700">{portalDirectUrl}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-gray-100 p-2">
                      <p className="font-bold text-gray-400">Usuario</p>
                      <p className="mt-1 truncate font-mono">{portalAccount.username || '-'}</p>
                    </div>
                    <div className="rounded-md border border-gray-100 p-2">
                      <p className="font-bold text-gray-400">Senha</p>
                      <p className="mt-1 truncate font-mono">{portalAccount.access_code_plain || newAccessCode || '-'}</p>
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-100 p-2">
                    <p className="text-xs font-bold text-gray-400">Token</p>
                    <p className="mt-1 break-all font-mono text-xs">{portalAccount.portal_token}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={copyPortalAccess}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> {copiedAccess ? 'Copiado' : 'Copiar'}
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" disabled={accessBusy} onClick={regenerateAccessCode}>
                      Nova senha
                    </Button>
                    <Button variant="outline" size="sm" className="col-span-2 text-xs" disabled={accessBusy} onClick={regeneratePortalToken}>
                      Gerar novo token/link
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">
                    Este cliente ainda nao tem acesso ao painel.
                  </p>
                  <Button size="sm" className="w-full text-xs" disabled={accessBusy} onClick={createPortalAccess}>
                    Criar acesso e link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {client.hasPersonalizedSanitaryFolder && client.personalizedSanitaryFolderUrl && (
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">
                  Pasta personalizada
                </h3>
                <a
                  href={client.personalizedSanitaryFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Abrir Drive <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardContent>
            </Card>
          )}

          {client.hasPersonalizedSanitaryFolder && !client.personalizedSanitaryFolderUrl && (
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">
                  Pasta personalizada
                </h3>
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Ainda não entregue.
                    {client.personalizedSanitaryFolderExpectedDeliveryDate && (
                      <>
                        {' '}Previsão: {(() => {
                          const [y, m, d] = client.personalizedSanitaryFolderExpectedDeliveryDate!.split('T')[0].split('-');
                          return `${d}/${m}/${y}`;
                        })()}
                      </>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {clientRequests.some((request) => (publishedAssets[request.id] || []).length > 0) && (
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">
                  Publicado no portal
                </h3>
                <div className="space-y-3">
                  {clientRequests.map((request) => {
                    const assets = publishedAssets[request.id] || [];
                    return assets.length > 0 ? (
                      <div key={request.id} className="rounded-md border border-gray-100 p-3">
                        <p className="mb-2 text-xs font-bold text-gray-500">
                          {request.requested_date || 'Sem data'} - {assets.length} arquivo(s)
                        </p>
                        <div className="space-y-1.5">
                          {assets.map((asset) => (
                            <div key={asset.id} className="flex items-center gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate">
                                {asset.kind === 'photo' ? 'Foto' : asset.file_name || asset.kind}
                              </span>
                              <button
                                type="button"
                                onClick={() => void removePublishedAsset(asset)}
                                className="rounded border border-red-100 px-2 py-1 font-bold text-red-600 hover:bg-red-50"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">
                Auditoria do portal
              </h3>
              {portalAuditError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-bold">Nao foi possivel ler a trilha de auditoria.</p>
                  <p className="mt-1">
                    Isto nao significa que o cliente nao usou o portal — significa que a leitura
                    falhou. Se persistir, avise no suporte.
                  </p>
                  <p className="mt-1 break-words text-xs text-amber-700">{portalAuditError}</p>
                </div>
              ) : portalAuditEvents.length === 0 ? (
                <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">
                  Nenhuma atividade registrada ainda.
                </p>
              ) : (
                <ol className="space-y-2">
                  {portalAuditEvents.map((event) => {
                    const detail = formatAuditPayload(event);
                    return (
                      <li key={event.id} className="rounded-md border border-gray-100 p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800">
                              {portalAuditLabels[event.event_type] || event.event_type}
                            </p>
                            {detail && <p className="mt-0.5 truncate text-gray-500">{detail}</p>}
                          </div>
                          <span className="shrink-0 text-right text-[10px] font-medium text-gray-400">
                            {new Date(event.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center uppercase tracking-wider">
                <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                Plano de Ação Aberto
              </h3>
              {!latestActionInspection ? (
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Aguardando primeira inspeção concluída.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-2">Baseado na ultima visita ({openActionItems.length} itens pendentes):</p>
                  <Button size="sm" className="w-full text-xs" disabled={openActionItems.length === 0} onClick={openActionPlan}>
                    Abrir Plano de Acao
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate('/summary', { state: { inspectionId: latestActionInspection.id }})}>
                    Ver Último Relatório <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Não Conformidades Recorrentes (≥2x neste cliente) */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center uppercase tracking-wider">
                <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
                NC Recorrentes
              </h3>
              <p className="text-[10px] text-gray-400 mb-4">Itens com ≥ 2 falhas neste cliente</p>
              {recurringActionItems.length === 0 ? (
                <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded text-center">
                  {inspections.length === 0
                    ? 'Aguardando inspeções.'
                    : '✅ Nenhuma NC repetida detectada.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {recurringActionItems.map(nc => (
                    <RecurringNCItem key={nc.itemId} nc={nc} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary-900 text-white border-none">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 opacity-80 flex items-center uppercase tracking-wider text-primary-200">
                Resumo do Cliente
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs opacity-60 block text-primary-200">Categoria Principal</label>
                  <p className="font-medium">{client.category?.toUpperCase() || 'SEM CATEGORIA'}</p>
                </div>
                {client.category === 'alimentos' && client.foodTypes && client.foodTypes.length > 0 && (
                  <div>
                    <label className="text-xs opacity-60 block text-primary-200">Segmentos</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {client.foodTypes.map(ft => (
                        <Badge key={ft} variant="outline" className="bg-white/10 text-white border-white/20 text-[10px] py-0">
                          {FOOD_SEGMENT_LABELS[ft] || ft}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs opacity-60 block text-primary-200">Responsável</label>
                  <p className="font-medium">{client.responsibleName || 'Não informado'}</p>
                </div>
                <div>
                  <label className="text-xs opacity-60 block">Telefone</label>
                  <p className="font-medium">{client.phone || '—'}</p>
                </div>
                <div>
                  <label className="text-xs opacity-60 block">Endereço</label>
                  <p className="text-sm opacity-90">{client.address || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Editar Cliente"
      >
        <form id="edit-client-form" onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome do Estabelecimento *</label>
            <input 
              {...register('name', { required: true })} 
              className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" 
            />
            {errors.name && <span className="text-xs text-red-500">Campo obrigatório</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoria *</label>
              <select 
                {...register('category', { required: true })}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Selecione...</option>
                <option value="estetica">Estética e Beleza</option>
                <option value="ilpi">ILPI</option>
                <option value="alimentos">Alimentos</option>
              </select>
              {errors.category && <span className="text-xs text-red-500">Campo obrigatório</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CNPJ</label>
              <input {...register('cnpj')} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {selectedCategory === 'alimentos' && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
              <label className="block text-sm font-medium text-gray-800 mb-2">Tipos de Serviço de Alimentação</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="servico_alimentacao" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Restaurante / Lanchonete</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="panificacao_confeitaria" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Padaria / Confeitaria</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="mercado_varejo" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Mercado / Hortifrúti</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="manipulacao_carnes" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Açougue / Peixaria</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="pescados_crus" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Japonês / Pescados Crus</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="dark_kitchen" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Dark Kitchen / Delivery</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="bebidas_sorvetes" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Sorveteria / Lanchonete / Café</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="catering_eventos" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Buffet / Catering</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" value="industria_artesanal" {...register('foodTypes')} className="rounded text-primary-600 focus:ring-primary-500" />
                  <span>Indústria Artesanal</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Responsável pelo local</label>
            <input {...register('responsibleName')} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone</label>
              <input {...register('phone')} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">E-mail</label>
              <input {...register('email')} type="email" className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="rounded-md border border-gray-100 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-gray-800">Responsáveis e contatos</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClientContacts((prev) => [...prev, { name: '', phone: '', email: '' }])}
              >
                Adicionar mais
              </Button>
            </div>
            <div className="space-y-3">
              {clientContacts.map((contact, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-gray-100 bg-white p-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={contact.name || ''}
                    onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                    placeholder="Responsável"
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="tel"
                    value={contact.phone || ''}
                    onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))}
                    placeholder="Telefone"
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={contact.email || ''}
                      onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, email: e.target.value } : item))}
                      placeholder="E-mail"
                      className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {clientContacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setClientContacts((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-md p-2 text-red-500 hover:bg-red-50"
                        title="Remover contato"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                {...register('hasPersonalizedSanitaryFolder')}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              Cliente tem pasta sanitaria personalizada
            </label>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">Link do Drive da pasta personalizada</label>
              <input
                {...register('personalizedSanitaryFolderUrl')}
                type="url"
                placeholder="https://drive.google.com/..."
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">Previsão de entrega da pasta</label>
              <input
                {...register('personalizedSanitaryFolderExpectedDeliveryDate')}
                type="date"
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Marcos do cronograma do contrato</p>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                {...register('hasAuditService')}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              Cliente tem auditoria contratada
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                {...register('hasOnlineFollowup')}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              Cliente tem acompanhamento online contratado
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cidade</label>
              <input {...register('city')} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado (UF)</label>
              <input {...register('state')} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Endereço Completo</label>
            <textarea {...register('address')} rows={2} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="edit-client-form">Salvar Alterações</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        title="Nova visita"
      >
        <form onSubmit={createConfirmedVisit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data *</label>
              <input
                type="date"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora</label>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisitMode('presencial')}
              className={`h-10 rounded-md border text-sm font-bold ${
                visitMode === 'presencial' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'
              }`}
            >
              Presencial
            </button>
            <button
              type="button"
              onClick={() => setVisitMode('online')}
              className={`h-10 rounded-md border text-sm font-bold ${
                visitMode === 'online' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'
              }`}
            >
              Online
            </button>
          </div>

          {visitMode === 'presencial' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Bairro/local do atendimento</label>
              <input
                value={visitDistrict}
                onChange={(e) => setVisitDistrict(e.target.value)}
                placeholder={client.city || 'Bairro'}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="outline" type="button" onClick={() => setIsVisitModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Criar visita confirmada
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RecurringNCItem({ nc }: { nc: PreviousNCContext }) {
  return (
    <details className="group rounded-lg border border-red-100 bg-red-50 p-3">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {nc.count}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug text-gray-800">{nc.description}</p>
          {nc.sectionTitle && <p className="mt-1 text-[10px] text-gray-500">{nc.sectionTitle}</p>}
          {(nc.correctiveAction || nc.situationDescription) && (
            <p className="mt-1 text-[10px] font-medium text-red-700 group-open:hidden">
              {nc.correctiveAction || nc.situationDescription}
            </p>
          )}
        </div>
      </summary>
      <div className="mt-3 space-y-2 border-t border-red-100 pt-3 text-xs text-gray-700">
        {nc.situationDescription && (
          <div>
            <span className="font-bold text-gray-900">Situacao: </span>
            {nc.situationDescription}
          </div>
        )}
        {nc.correctiveAction && (
          <div>
            <span className="font-bold text-gray-900">Acao: </span>
            {nc.correctiveAction}
          </div>
        )}
        {(nc.responsible || nc.deadline) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            {nc.responsible && <span>Responsavel: {nc.responsible}</span>}
            {nc.deadline && <span>Prazo: {nc.deadline}</span>}
          </div>
        )}
        {nc.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {nc.photos.slice(0, 3).map(photo => (
              <img
                key={photo.id}
                src={photo.dataUrl}
                alt="Evidencia anterior"
                className="aspect-square rounded-md border border-red-100 object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <ImageIcon className="h-3 w-3" />
            Sem foto local anexada
          </div>
        )}
      </div>
    </details>
  );
}

function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
