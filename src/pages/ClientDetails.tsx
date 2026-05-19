import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
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
import { type Client, type Inspection, type InspectionScore, FOOD_SEGMENT_LABELS } from '../types';
import { calculateScore } from '../utils/scoring';
import { formatDateTime } from '../utils/imageUtils';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
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
  const [inspections, setInspections] = useState<(Inspection & { score: InspectionScore })[]>([]);
  const [actionPlan, setActionPlan] = useState<ClientActionPlanContext>({ latestOpenItems: [], recurringItems: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
            const score = calculateScore(responses, template?.sections || []);
            return { ...insp, score };
          })
        )).sort((a, b) => new Date(b.inspectionDate || b.createdAt).getTime() - new Date(a.inspectionDate || a.createdAt).getTime());

        setInspections(inspectionsWithScores);
        setActionPlan(await getClientActionPlanContext(id));

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
    const params = new URLSearchParams({
      clientId: client.id,
      previousInspectionId: latestActionInspection.id,
      mode: 'action-plan',
    });
    navigate(`/new?${params.toString()}`);
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
            <Button onClick={() => navigate('/new')}>
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
