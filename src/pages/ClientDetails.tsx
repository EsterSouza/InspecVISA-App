import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { db } from '../db/database';
import type { Client, Inspection, InspectionScore } from '../types';
import { calculateScore } from '../utils/scoring';
import { formatDateTime } from '../utils/imageUtils';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [inspections, setInspections] = useState<(Inspection & { score: InspectionScore })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      const clientData = await db.clients.get(id);
      if (!clientData) {
        navigate('/clients');
        return;
      }
      setClient(clientData);

      // Load all inspections for this client
      const rawInspections = await db.inspections
        .where('clientId').equals(id)
        .reverse()
        .toArray();

      const inspectionsWithScores = await Promise.all(
        rawInspections.map(async (insp) => {
          const responses = await db.responses.where('inspectionId').equals(insp.id).toArray();
          const template = await db.templates.get(insp.templateId);
          const score = calculateScore(responses, template?.sections || []);
          return { ...insp, score };
        })
      );

      setInspections(inspectionsWithScores.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
      setLoading(false);
    };

    loadData();
  }, [id, navigate]);

  if (loading || !client) {
    return <div className="p-8 text-center text-gray-500">Carregando detalhes...</div>;
  }

  const chartData = [...inspections]
    .reverse()
    .filter(i => i.status === 'completed')
    .map(i => ({
      date: new Date(i.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      score: Math.round(i.score.scorePercentage),
    }));

  const latestInspection = inspections.find(i => i.status === 'completed');

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
              <Badge variant="default">{client.category.toUpperCase()}</Badge>
              <span className="text-sm text-gray-500">Cód: {client.id.substring(0, 8)}</span>
            </div>
          </div>
          <Button onClick={() => navigate('/new')}>
            <Calendar className="mr-2 h-4 w-4" /> Nova Inspeção
          </Button>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        style={{ fontSize: '12px', fill: '#94a3b8' }} 
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        axisLine={false} 
                        tickLine={false} 
                        style={{ fontSize: '12px', fill: '#94a3b8' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [`${value}%`, 'Conformidade']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#1e6b5e" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#1e6b5e', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
              {!latestInspection ? (
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Aguardando primeira inspeção concluída.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-2">Baseado na última visita ({latestInspection.score.notCompliesCount} itens pendentes):</p>
                  <ul className="space-y-2">
                    {/* Simplified view of open NCs could be fetched here */}
                    <li className="text-sm text-gray-700 leading-relaxed border-l-2 border-red-200 pl-3">
                      Visualize o último relatório para ver todas as não conformidades pendentes.
                    </li>
                  </ul>
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate('/summary', { state: { inspectionId: latestInspection.id }})}>
                    Ver Último Relatório <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
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
                  <label className="text-xs opacity-60 block">Responsável</label>
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
    </div>
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
