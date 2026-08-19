import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  FileText,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Edit2,
  Loader2,
  Paperclip,
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
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Checkbox } from '../components/ui/Checkbox';
import { Drawer } from '../components/ui/Drawer';
import { PageShell } from '../components/ui/PageShell';
import { Pagination } from '../components/ui/Pagination';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Tabs, TabPanel, type TabItem } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';
import { rawErrorMessage } from '../utils/errors';

const ComplianceTrendChart = lazy(() =>
  import('../components/client/ComplianceTrendChart').then(m => ({ default: m.ComplianceTrendChart }))
);

export function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('aba') || 'visao-geral';
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'visao-geral') next.delete('aba');
    else next.set('aba', value);
    setSearchParams(next);
  };
  const [client, setClient] = useState<Client | null>(null);
  const [inspections, setInspections] = useState<(Inspection & { score: InspectionScore; areaScores: InspectionAreaScores })[]>([]);
  const [actionPlan, setActionPlan] = useState<ClientActionPlanContext>({ latestOpenItems: [], recurringItems: [] });
  const [portalAccounts, setPortalAccounts] = useState<ClientPortalAccountRow[]>([]);
  const [portalAuditEvents, setPortalAuditEvents] = useState<ClientPortalAuditEvent[]>([]);
  const [portalAuditError, setPortalAuditError] = useState<string | null>(null);
  const [clientRequests, setClientRequests] = useState<AppointmentRequest[]>([]);
  const [publishedAssets, setPublishedAssets] = useState<Record<string, AppointmentAttachment[]>>({});
  const [filesPage, setFilesPage] = useState(1);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [copiedAccess, setCopiedAccess] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | 'token' | null>(null);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState<string | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
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
        const allInspIds = rawInspections.map((i) => i.id);
        
        // Load all responses for these inspections at once
        const allResponses = allInspIds.length > 0
          ? filterByActiveTenant(await db.responses.where('inspectionId').anyOf(allInspIds).toArray()).filter(r => !r.deletedAt)
          : [];

        const inspectionsWithScores = (await Promise.all(
          rawInspections.map(async (insp) => {
            const responses = allResponses.filter((r) => r.inspectionId === insp.id);
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
          AppointmentAdminService.listPortalAuditEvents(auditAccount ? { accountId: auditAccount.id, limit: 50 } : { clientId: id, limit: 50 })
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
          try {
            const allAssets = await AppointmentAdminService.listAttachmentsForRequests(mine.map((r) => r.id));
            const assets: Record<string, AppointmentAttachment[]> = {};
            for (const asset of allAssets) {
              (assets[asset.appointment_request_id] ||= []).push(asset);
            }
            setPublishedAssets(assets);
          } catch (err) {
            console.warn('[ClientDetails] Falha ao carregar arquivos publicados:', err);
            setPublishedAssets({});
          }
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
      toast.error('Sem conexão com a internet.', 'Não é possível salvar no momento.');
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
    } catch (err) {
      console.error(err);
      toast.error(rawErrorMessage(err) || 'Erro ao atualizar cliente.');
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

  const renderAuditEvent = (event: ClientPortalAuditEvent) => {
    const detail = formatAuditPayload(event);
    return (
      <li key={event.id} className="rounded-md border border-default p-3 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-navy">
              {portalAuditLabels[event.event_type] || event.event_type}
            </p>
            {detail && <p className="mt-0.5 truncate text-navy-3">{detail}</p>}
          </div>
          <span className="shrink-0 text-right text-[10px] font-medium text-navy-3">
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

  const copyCredentialField = async (field: 'username' | 'password' | 'token', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
  };

  const refreshPortalAccounts = async () => {
    setPortalAccounts(await AppointmentAdminService.listPortalAccounts());
  };

  const createPortalAccess = async () => {
    if (!client) return;
    if (!client.email) {
      toast.error('Informe um e-mail no cadastro do cliente antes de criar o acesso.');
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
    } catch (err) {
      toast.error(rawErrorMessage(err) || 'Falha ao criar acesso do cliente.');
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
    } catch (err) {
      toast.error(rawErrorMessage(err) || 'Falha ao gerar nova senha.');
    } finally {
      setAccessBusy(false);
    }
  };

  const regeneratePortalToken = async () => {
    if (!portalAccount) return;
    const ok = await confirm({
      title: 'Gerar novo token?',
      description: 'Links diretos antigos deixam de funcionar.',
      confirmLabel: 'Gerar novo token',
    });
    if (!ok) return;
    setAccessBusy(true);
    try {
      await AppointmentAdminService.regeneratePortalToken(portalAccount.id);
      await refreshPortalAccounts();
    } catch (err) {
      toast.error(rawErrorMessage(err) || 'Falha ao gerar novo token.');
    } finally {
      setAccessBusy(false);
    }
  };

  const removePublishedAsset = async (asset: AppointmentAttachment) => {
    const ok = await confirm({
      title: 'Remover este arquivo do portal do cliente?',
      description: 'O arquivo original não será apagado.',
      confirmLabel: 'Remover arquivo',
    });
    if (!ok) return;
    setRemovingAssetId(asset.id);
    try {
      await AppointmentAdminService.removePublishedAttachment(asset.id);
      setPublishedAssets((current) => ({
        ...current,
        [asset.appointment_request_id]: (current[asset.appointment_request_id] || []).filter((item) => item.id !== asset.id),
      }));
    } catch (err) {
      toast.error(rawErrorMessage(err) || 'Falha ao remover o arquivo.');
    } finally {
      setRemovingAssetId(null);
    }
  };

  const ASSET_KIND_LABELS: Record<AppointmentAttachment['kind'], string> = {
    report_pdf: 'Relatório',
    photo: 'Foto',
    attachment: 'Anexo',
  };

  const FILES_PAGE_SIZE = 5;
  const visitFileGroups = clientRequests
    .map((request) => ({ request, assets: publishedAssets[request.id] || [] }))
    .filter((group) => group.assets.length > 0)
    .sort((a, b) => new Date(b.request.requested_date || b.request.created_at).getTime() - new Date(a.request.requested_date || a.request.created_at).getTime());
  const filesPageCount = Math.max(1, Math.ceil(visitFileGroups.length / FILES_PAGE_SIZE));
  const filesCurrentPage = Math.min(filesPage, filesPageCount);
  const pagedFileGroups = visitFileGroups.slice(
    (filesCurrentPage - 1) * FILES_PAGE_SIZE,
    filesCurrentPage * FILES_PAGE_SIZE
  );

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
    } catch (err) {
      toast.error(rawErrorMessage(err) || 'Falha ao criar nova visita.');
    }
  };


  const handleDelete = async () => {
    if (!client) return;
    if (!navigator.onLine) {
      toast.error('Sem conexão com a internet.', 'Não é possível excluir no momento.');
      return;
    }
    const ok = await confirm({
      title: `Excluir o cliente "${client.name}"?`,
      description: 'Todas as inspeções e fotos associadas serão apagadas permanentemente.',
      confirmLabel: 'Excluir cliente',
      confirmWord: 'EXCLUIR',
    });
    if (!ok) return;
    try {
      await ClientService.deleteClient(client.id);
      navigate('/clients');
    } catch (err) {
      console.error(err);
      toast.error(rawErrorMessage(err) || 'Erro ao excluir cliente.');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-navy-3">Carregando detalhes...</div>;
  }

  if (loadError || !client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <p className="max-w-md font-semibold text-navy-2">{loadError || 'Cliente nao encontrado.'}</p>
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

  const totalFiles = visitFileGroups.reduce((sum, group) => sum + group.assets.length, 0);
  const tabItems: TabItem[] = [
    { value: 'visao-geral', label: 'Visão geral' },
    { value: 'arquivos', label: 'Arquivos', count: totalFiles > 0 ? totalFiles : undefined },
    { value: 'portal', label: 'Portal' },
  ];
  const auditPreview = portalAuditEvents.slice(0, 5);

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="-ml-3 mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-navy">{client.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="default">{client.category?.toUpperCase() || 'SEM CATEGORIA'}</Badge>
              {client.category === 'alimentos' && client.foodTypes?.map(ft => (
                <Badge key={ft} variant="outline" className="text-[10px]">
                  {FOOD_SEGMENT_LABELS[ft] || ft}
                </Badge>
              ))}
              <span className="text-sm text-navy-3">Cód: {client.id.substring(0, 8)}</span>
              {portalAccount ? (
                <Badge variant="success">Portal ativo</Badge>
              ) : (
                <Badge variant="neutral">Sem acesso ao portal</Badge>
              )}
              {latestActionInspection && (
                openActionItems.length > 0 ? (
                  <Badge variant="warning">{openActionItems.length} pendência(s) aberta(s)</Badge>
                ) : (
                  <Badge variant="success">Sem pendências abertas</Badge>
                )
              )}
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-3">Responsável</dt>
                <dd className="mt-0.5 text-sm text-navy">{client.responsibleName || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-3">Telefone</dt>
                <dd className="mt-0.5 text-sm text-navy">{client.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-3">Endereço</dt>
                <dd className="mt-0.5 text-sm text-navy">{client.address || '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(client); setIsModalOpen(true); }}>
              <Edit2 className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="text-danger hover:text-danger-soft-ink hover:bg-danger-soft" onClick={handleDelete}>
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

      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} aria-label="Seções do cliente" />

      <TabPanel value="visao-geral" activeValue={activeTab}>
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
                  <Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-surface-sunken" />}>
                    <ComplianceTrendChart data={chartData} />
                  </Suspense>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-default px-4 py-3 text-sm text-navy-3">
                  <Activity className="h-4 w-4 shrink-0 text-navy-3" />
                  <p>Dados insuficientes para gerar gráfico — realize pelo menos 2 inspeções concluídas.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center px-1">
              <FileText className="mr-2 h-5 w-5 text-navy-3" />
              Histórico de Visitas
            </h2>
            {inspections.length === 0 ? (
              <p className="p-8 text-center text-navy-3 bg-surface-sunken rounded-xl border border-dashed">Nenhuma visita registrada.</p>
            ) : (
              <div className="space-y-3">
                {inspections.map((insp) => (
                  <Card key={insp.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => navigate(insp.status === 'in_progress' ? '/execute' : '/summary', { state: { inspectionId: insp.id }})}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-on-accent font-bold ${
                          insp.status === 'in_progress' ? 'bg-amber-strong' :
                          insp.score.scorePercentage >= 90 ? 'bg-success' :
                          insp.score.scorePercentage >= 70 ? 'bg-primary-700' :
                          'bg-danger'
                        }`}>
                          {insp.status === 'completed' ? `${Math.round(insp.score.scorePercentage)}%` : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-navy">{formatDateTime(insp.createdAt)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={insp.status === 'completed' ? 'success' : 'warning'}>
                              {insp.status === 'completed' ? 'Finalizada' : 'Em andamento'}
                            </Badge>
                            <span className="text-xs text-navy-3">•</span>
                            <span className="text-xs text-navy-3">{insp.score.compliesCount} conformidades</span>
                          </div>
                          {insp.status === 'completed' && client.category === 'ilpi' && insp.areaScores.isSplit && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold">
                              <span className="text-navy-2">
                                {insp.areaScores.sanitary.areaLabel}
                                {insp.areaScores.sanitary.consultant ? ` (${insp.areaScores.sanitary.consultant.split(/\s+/)[0]})` : ''}
                                <span className="ml-1 text-navy">{Math.round(insp.areaScores.sanitary.score.scorePercentage)}%</span>
                              </span>
                              <span className="text-navy-2">
                                {insp.areaScores.nutrition.areaLabel}
                                {insp.areaScores.nutrition.consultant ? ` (${insp.areaScores.nutrition.consultant.split(/\s+/)[0]})` : ''}
                                <span className="ml-1 text-navy">{Math.round(insp.areaScores.nutrition.score.scorePercentage)}%</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-navy-3" />
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
              <h3 className="text-sm font-bold text-navy mb-4 flex items-center uppercase tracking-wider">
                <AlertCircle className="mr-2 h-4 w-4 text-amber-strong" />
                Plano de Ação Aberto
              </h3>
              {!latestActionInspection ? (
                <p className="text-sm text-navy-3 bg-surface-sunken p-3 rounded">Aguardando primeira inspeção concluída.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-navy-3 mb-2">Baseado na ultima visita ({openActionItems.length} itens pendentes):</p>
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
              <h3 className="text-sm font-bold text-navy mb-1 flex items-center uppercase tracking-wider">
                <AlertTriangle className="mr-2 h-4 w-4 text-danger" />
                NC Recorrentes
              </h3>
              <p className="text-[10px] text-navy-3 mb-4">Itens com ≥ 2 falhas neste cliente</p>
              {recurringActionItems.length === 0 ? (
                <p className="text-xs text-navy-3 bg-surface-sunken p-3 rounded text-center">
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
        </div>
      </div>
      </TabPanel>

      <TabPanel value="arquivos" activeValue={activeTab}>
        {visitFileGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Paperclip className="h-8 w-8" />}
              title="Nenhum arquivo publicado no portal"
              description="Fotos, relatórios e anexos publicados numa visita aparecem aqui."
            />
          </Card>
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead align="right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFileGroups.map(({ request, assets }) => (
                  <React.Fragment key={request.id}>
                    <TableRow group>
                      <TableCell colSpan={2}>
                        Visita {request.requested_date ? new Date(`${request.requested_date}T00:00:00`).toLocaleDateString('pt-BR') : 'sem data'} ·{' '}
                        {assets.length} arquivo(s)
                      </TableCell>
                    </TableRow>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell primary>
                          <span className="flex items-center gap-2">
                            {asset.kind === 'photo' && asset.signed_url ? (
                              <img
                                src={asset.signed_url}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary-50 text-primary-700">
                                {asset.kind === 'report_pdf' ? (
                                  <FileText className="h-4 w-4" />
                                ) : asset.kind === 'photo' ? (
                                  <ImageIcon className="h-4 w-4" />
                                ) : (
                                  <Paperclip className="h-4 w-4" />
                                )}
                              </span>
                            )}
                            <span className="min-w-0 truncate font-normal text-navy-2">
                              {asset.file_name || ASSET_KIND_LABELS[asset.kind]}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <span className="inline-flex items-center gap-1">
                            {asset.signed_url && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(asset.signed_url, '_blank', 'noopener,noreferrer')}
                                aria-label={`Abrir ${asset.file_name || ASSET_KIND_LABELS[asset.kind]}`}
                              >
                                Abrir
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={removingAssetId === asset.id}
                              onClick={() => void removePublishedAsset(asset)}
                              className="text-danger hover:bg-danger-soft"
                              aria-label={`Remover ${asset.file_name || ASSET_KIND_LABELS[asset.kind]} do portal`}
                            >
                              {removingAssetId === asset.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={filesCurrentPage}
              pageCount={filesPageCount}
              onPageChange={setFilesPage}
              totalItems={visitFileGroups.length}
              pageSize={FILES_PAGE_SIZE}
            />
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value="portal" activeValue={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center text-sm font-bold uppercase tracking-wider text-navy">
                    Portal do Cliente
                  </h3>
                  {portalAccount && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowCredentials((v) => !v)}>
                      {showCredentials ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                      {showCredentials ? 'Ocultar' : 'Mostrar'}
                    </Button>
                  )}
                </div>
                {portalAccount ? (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-md bg-surface-sunken p-3">
                      <p className="text-xs font-bold uppercase text-navy-3">Link direto</p>
                      <p className="mt-1 break-all font-mono text-xs text-navy-2">{portalDirectUrl}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-default p-2">
                        <p className="font-bold text-navy-3">Usuário</p>
                        <p className="mt-1 truncate font-mono">{portalAccount.username || '-'}</p>
                      </div>
                      <div className="rounded-md border border-default p-2">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-navy-3">Senha</p>
                          {(portalAccount.access_code_plain || newAccessCode) && (
                            <button
                              type="button"
                              onClick={() => copyCredentialField('password', portalAccount.access_code_plain || newAccessCode || '')}
                              className="text-navy-3 hover:text-navy-2"
                              aria-label="Copiar senha"
                            >
                              {copiedField === 'password' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono">
                          {showCredentials ? (portalAccount.access_code_plain || newAccessCode || '-') : '••••••••'}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-default p-2">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-navy-3">Token</p>
                        <button
                          type="button"
                          onClick={() => copyCredentialField('token', portalAccount.portal_token)}
                          className="text-navy-3 hover:text-navy-2"
                          aria-label="Copiar token"
                        >
                          {copiedField === 'token' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs">
                        {showCredentials ? portalAccount.portal_token : '••••••••••••••••'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={copyPortalAccess}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> {copiedAccess ? 'Copiado' : 'Copiar tudo'}
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
                    <p className="rounded-md bg-surface-sunken p-3 text-sm text-navy-3">
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
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy">
                    Pasta personalizada
                  </h3>
                  <a
                    href={client.personalizedSanitaryFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-success px-3 py-2 text-sm font-bold text-on-accent hover:bg-success-soft-ink"
                  >
                    Abrir Drive <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardContent>
              </Card>
            )}

            {client.hasPersonalizedSanitaryFolder && !client.personalizedSanitaryFolderUrl && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy">
                    Pasta personalizada
                  </h3>
                  <div className="flex items-start gap-2 rounded-md bg-amber-soft p-3 text-sm text-amber-soft-ink">
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
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center text-sm font-bold uppercase tracking-wider text-navy">
                    Auditoria do portal
                  </h3>
                  {portalAuditEvents.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAuditDrawerOpen(true)}>
                      Ver tudo
                    </Button>
                  )}
                </div>
                {portalAuditError ? (
                  <div className="rounded-md border border-amber-soft-border bg-amber-soft p-3 text-sm text-amber-soft-ink">
                    <p className="font-bold">Nao foi possivel ler a trilha de auditoria.</p>
                    <p className="mt-1">
                      Isto nao significa que o cliente nao usou o portal — significa que a leitura
                      falhou. Se persistir, avise no suporte.
                    </p>
                    <p className="mt-1 break-words text-xs text-amber-soft-ink">{portalAuditError}</p>
                  </div>
                ) : portalAuditEvents.length === 0 ? (
                  <p className="rounded-md bg-surface-sunken p-3 text-sm text-navy-3">
                    Nenhuma atividade registrada ainda.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {auditPreview.map((event) => renderAuditEvent(event))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </TabPanel>

      <Modal
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Editar Cliente"
      >
        <form id="edit-client-form" onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
          <Field
            label="Nome do Estabelecimento"
            required
            error={errors.name && 'Campo obrigatório'}
          >
            <Input {...register('name', { required: true })} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria" required error={errors.category && 'Campo obrigatório'}>
              <Select {...register('category', { required: true })}>
                <option value="">Selecione...</option>
                <option value="estetica">Estética e Beleza</option>
                <option value="ilpi">ILPI</option>
                <option value="alimentos">Alimentos</option>
              </Select>
            </Field>
            <Field label="CNPJ">
              <Input {...register('cnpj')} />
            </Field>
          </div>

          {selectedCategory === 'alimentos' && (
            <fieldset className="rounded-md border border-amber-soft-border bg-amber-soft p-4">
              <legend className="mb-2 text-sm font-semibold text-navy">Tipos de Serviço de Alimentação</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(FOOD_SEGMENT_LABELS).map(([value, rotulo]) => (
                  <Checkbox key={value} value={value} label={rotulo} {...register('foodTypes')} />
                ))}
              </div>
            </fieldset>
          )}

          <Field label="Responsável pelo local">
            <Input {...register('responsibleName')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefone">
              <Input {...register('phone')} type="tel" />
            </Field>
            <Field label="E-mail">
              <Input {...register('email')} type="email" />
            </Field>
          </div>

          <div className="rounded-md border border-default bg-surface-sunken/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-navy">Responsáveis e contatos</p>
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
                <div key={index} className="grid gap-3 rounded-md border border-default bg-surface p-3 sm:grid-cols-3">
                  <Input
                    type="text"
                    value={contact.name || ''}
                    onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                    placeholder="Responsável"
                    aria-label={`Responsável ${index + 1}`}
                  />
                  <Input
                    type="tel"
                    value={contact.phone || ''}
                    onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))}
                    placeholder="Telefone"
                    aria-label={`Telefone do responsável ${index + 1}`}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={contact.email || ''}
                      onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, email: e.target.value } : item))}
                      placeholder="E-mail"
                      aria-label={`E-mail do responsável ${index + 1}`}
                      className="min-w-0 flex-1"
                    />
                    {clientContacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setClientContacts((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-md p-2 text-danger hover:bg-danger-soft"
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

          <div className="space-y-3 rounded-md border border-success-soft-border bg-success-soft/60 p-4">
            <Checkbox
              {...register('hasPersonalizedSanitaryFolder')}
              className="font-semibold"
              label="Cliente tem pasta sanitaria personalizada"
            />
            <Field label="Link do Drive da pasta personalizada">
              <Input
                {...register('personalizedSanitaryFolderUrl')}
                type="url"
                placeholder="https://drive.google.com/..."
              />
            </Field>
            <Field label="Previsão de entrega da pasta">
              <Input {...register('personalizedSanitaryFolderExpectedDeliveryDate')} type="date" />
            </Field>
          </div>

          <div className="space-y-3 rounded-md border border-success-soft-border bg-success-soft/60 p-4">
            <p className="text-sm font-semibold text-navy">Marcos do cronograma do contrato</p>
            <Checkbox {...register('hasAuditService')} label="Cliente tem auditoria contratada" />
            <Checkbox
              {...register('hasOnlineFollowup')}
              label="Cliente tem acompanhamento online contratado"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cidade">
              <Input {...register('city')} />
            </Field>
            <Field label="Estado (UF)">
              <Input {...register('state')} />
            </Field>
          </div>

          <Field label="Endereço Completo">
            <Textarea {...register('address')} rows={2} className="resize-none" />
          </Field>

          <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-default">
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
            <Field label="Data" required>
              <Input type="date" required value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </Field>
            <Field label="Hora">
              <Input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisitMode('presencial')}
              className={`h-10 rounded-md border text-sm font-bold ${
                visitMode === 'presencial' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-default text-navy-2'
              }`}
            >
              Presencial
            </button>
            <button
              type="button"
              onClick={() => setVisitMode('online')}
              className={`h-10 rounded-md border text-sm font-bold ${
                visitMode === 'online' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-default text-navy-2'
              }`}
            >
              Online
            </button>
          </div>

          {visitMode === 'presencial' && (
            <Field label="Bairro/local do atendimento">
              <Input
                value={visitDistrict}
                onChange={(e) => setVisitDistrict(e.target.value)}
                placeholder={client.city || 'Bairro'}
              />
            </Field>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-default pt-4">
            <Button variant="outline" type="button" onClick={() => setIsVisitModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Criar visita confirmada
            </Button>
          </div>
        </form>
      </Modal>

      <Drawer
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        title="Auditoria do portal"
      >
        <ol className="space-y-2">
          {portalAuditEvents.map((event) => renderAuditEvent(event))}
        </ol>
      </Drawer>

      {confirmDialog}
    </PageShell>
  );
}

function RecurringNCItem({ nc }: { nc: PreviousNCContext }) {
  return (
    <details className="group rounded-lg border border-danger-soft-border bg-danger-soft p-3">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-on-accent">
          {nc.count}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug text-navy">{nc.description}</p>
          {nc.sectionTitle && <p className="mt-1 text-[10px] text-navy-3">{nc.sectionTitle}</p>}
          {(nc.correctiveAction || nc.situationDescription) && (
            <p className="mt-1 text-[10px] font-medium text-danger-soft-ink group-open:hidden">
              {nc.correctiveAction || nc.situationDescription}
            </p>
          )}
        </div>
      </summary>
      <div className="mt-3 space-y-2 border-t border-danger-soft-border pt-3 text-xs text-navy-2">
        {nc.situationDescription && (
          <div>
            <span className="font-bold text-navy">Situacao: </span>
            {nc.situationDescription}
          </div>
        )}
        {nc.correctiveAction && (
          <div>
            <span className="font-bold text-navy">Acao: </span>
            {nc.correctiveAction}
          </div>
        )}
        {(nc.responsible || nc.deadline) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-navy-3">
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
                className="aspect-square rounded-md border border-danger-soft-border object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-navy-3">
            <ImageIcon className="h-3 w-3" />
            Sem foto local anexada
          </div>
        )}
      </div>
    </details>
  );
}

function Activity(props: React.SVGProps<SVGSVGElement>) {
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
