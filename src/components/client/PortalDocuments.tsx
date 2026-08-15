import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Image, Paperclip } from 'lucide-react';
import type { ClientPortalVisit } from '../../services/clientPortalService';
import { formatDateBR } from '../../utils/clientPortalFormat';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';

interface PortalDocumentsProps {
  visits: ClientPortalVisit[];
  loading?: boolean;
}

const PAGE_SIZE = 10;

function sum(visits: ClientPortalVisit[], field: 'report_count' | 'photo_count' | 'attachment_count'): number {
  return visits.reduce((total, visit) => total + (visit[field] || 0), 0);
}

/**
 * `report_delivered_at` só existe pra visitas recentes (campo novo, sem backfill do histórico —
 * achado ao testar contra produção: 13 dos 15 relatórios da Rede Sênior tinham o campo nulo
 * mesmo já entregues). `requested_date` (a data da visita) é o que sobra de confiável pro
 * histórico inteiro — por isso a coluna chama "Visita", não "Entregue em".
 */
function visitReportDate(visit: ClientPortalVisit): string | null {
  return visit.report_delivered_at || visit.requested_date || visit.created_at || null;
}

function reportDateValue(visit: ClientPortalVisit): number {
  const value = visitReportDate(visit);
  return value ? new Date(value).getTime() : 0;
}

/**
 * Antes desta leva a aba só mostrava as três contagens abaixo, sem lista nenhuma — dava pra
 * saber que existiam "15 relatórios" e não dava pra abrir nenhum deles. A tabela reaproveita o
 * visualizador de visita que já funciona (`/cliente/visita/:token`, `PublicAppointmentStatus`,
 * que já mostra PDF + fotos + anexos juntos) em vez de assinar URL de novo aqui — sem RPC nova.
 */
export function PortalDocuments({ visits, loading }: PortalDocumentsProps) {
  const [page, setPage] = useState(1);

  if (loading) {
    return (
      <section className="mb-6 h-16 animate-pulse rounded-xl border border-gray-200 bg-gray-50" aria-hidden="true" />
    );
  }

  const stats = [
    { key: 'reports', label: 'Relatórios', value: sum(visits, 'report_count'), icon: FileText },
    { key: 'photos', label: 'Fotos', value: sum(visits, 'photo_count'), icon: Image },
    { key: 'attachments', label: 'Anexos', value: sum(visits, 'attachment_count'), icon: Paperclip },
  ];

  if (stats.every((s) => s.value === 0)) {
    return (
      <section className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-500">
        Nenhum relatório, foto ou anexo disponível ainda.
      </section>
    );
  }

  const reports = visits
    .filter((visit) => (visit.report_count || 0) > 0 && visit.public_token)
    .sort((a, b) => reportDateValue(b) - reportDateValue(a));

  const pageCount = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = reports.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <section
        aria-label="Documentos"
        className="flex items-center divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        {stats.map(({ key, label, value, icon: Icon }) => (
          <div key={key} className="flex flex-1 items-center gap-2.5 px-4 py-3">
            <Icon className="h-4 w-4 shrink-0 text-primary-600" />
            <div>
              <p className="text-lg font-black leading-none text-gray-950">{value}</p>
              <p className="text-[10px] font-bold uppercase leading-tight text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-title text-base font-semibold text-navy">Relatórios entregues</h2>
        {reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Nenhum relatório entregue ainda"
            description="Fotos e anexos publicados aparecem junto do relatório de cada visita."
          />
        ) : (
          <TableContainer className="rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead align="right">Visita</TableHead>
                  <TableHead align="right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((visit) => (
                  <TableRow key={visit.public_token}>
                    <TableCell primary>
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary-600" />
                        Relatório de inspeção
                      </span>
                    </TableCell>
                    <TableCell>{visit.unit_name}</TableCell>
                    <TableCell align="right">{formatDateBR(visitReportDate(visit))}</TableCell>
                    <TableCell align="right">
                      <Link
                        to={`/cliente/visita/${visit.public_token}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-900"
                      >
                        Ver relatório <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              totalItems={reports.length}
              pageSize={PAGE_SIZE}
            />
          </TableContainer>
        )}
      </section>
    </div>
  );
}
