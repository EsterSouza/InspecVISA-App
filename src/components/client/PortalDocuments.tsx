import { FileText, Image, Paperclip } from 'lucide-react';
import type { ClientPortalVisit } from '../../services/clientPortalService';

interface PortalDocumentsProps {
  visits: ClientPortalVisit[];
  loading?: boolean;
}

function sum(visits: ClientPortalVisit[], field: 'report_count' | 'photo_count' | 'attachment_count'): number {
  return visits.reduce((total, visit) => total + (visit[field] || 0), 0);
}

export function PortalDocuments({ visits, loading }: PortalDocumentsProps) {
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
      <section className="mb-6 rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-400">
        Nenhum relatório, foto ou anexo disponível ainda.
      </section>
    );
  }

  return (
    <section
      aria-label="Documentos"
      className="mb-6 flex items-center divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      {stats.map(({ key, label, value, icon: Icon }) => (
        <div key={key} className="flex flex-1 items-center gap-2.5 px-4 py-3">
          <Icon className="h-4 w-4 shrink-0 text-primary-600" />
          <div>
            <p className="text-lg font-black leading-none text-gray-950">{value}</p>
            <p className="text-[10px] font-bold uppercase leading-tight text-gray-400">{label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
