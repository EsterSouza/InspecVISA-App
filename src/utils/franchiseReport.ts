import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ClientPortalOverview } from '../services/clientPortalService';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Finalizada',
  report_available: 'Relatório disponível',
  cancelled: 'Cancelada',
};

function formatDateBR(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/**
 * Gera um PDF consolidado da rede/franquia a partir do painel do cliente:
 * resumo geral + uma linha por unidade com última visita, status,
 * conformidade e disponibilidade de relatório.
 */
export function generateFranchisePdf(overview: ClientPortalOverview): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  // Cabeçalho
  doc.setFillColor(16, 29, 69); // navy
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Resumo de inspeções sanitárias', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(overview.account_name, 14, 19);
  doc.text(`Emitido em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 14, 19, { align: 'right' });

  // Métricas
  const allVisits = overview.units.flatMap((u) => u.visits);
  const totalUnits = overview.units.length;
  const totalVisits = allVisits.length;
  const scored = allVisits.filter((v) => typeof v.compliance_score === 'number');
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, v) => s + (v.compliance_score || 0), 0) / scored.length)
    : null;

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(11);
  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo geral', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 7;
  doc.text(`Unidades: ${totalUnits}`, 14, y);
  doc.text(`Inspeções: ${totalVisits}`, 70, y);
  doc.text(`Conformidade média: ${avgScore != null ? `${avgScore}%` : '—'}`, 126, y);

  // Tabela por unidade (última visita de cada uma)
  const rows = overview.units.map((u) => {
    const visits = [...u.visits].sort((a, b) =>
      `${b.requested_date || ''}${b.requested_time || ''}`.localeCompare(`${a.requested_date || ''}${a.requested_time || ''}`)
    );
    const last = visits[0];
    const hasReport = visits.some((v) => (v.report_count || 0) > 0);
    return [
      u.client_name,
      u.city || '—',
      last ? formatDateBR(last.requested_date) : '—',
      last ? (STATUS_LABELS[last.status] || last.status) : '—',
      last && typeof last.compliance_score === 'number' ? `${last.compliance_score}%` : '—',
      hasReport ? 'Sim' : 'Não',
    ];
  });

  autoTable(doc, {
    startY: y + 8,
    head: [['Unidade', 'Cidade', 'Última inspeção', 'Status', 'Conformidade', 'Relatório']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [29, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'InspecVISA — Consultoria Sanitária. Documento informativo gerado pelo Portal do Cliente.',
    14,
    doc.internal.pageSize.getHeight() - 8
  );

  const safeName = overview.account_name.normalize('NFD').replace(/[^\w]+/g, '_').slice(0, 40);
  doc.save(`resumo_inspecoes_${safeName || 'franquia'}.pdf`);
}
