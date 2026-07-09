import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ClientPortalOverview, ClientPortalVisit } from '../services/clientPortalService';
import { classificationFromPercentAndCritical, classificationLabel } from './scoring';

function formatDateBR(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Última visita de cada unidade, ordenada por data mais recente. */
function latestVisit(visits: ClientPortalVisit[]): ClientPortalVisit | undefined {
  return [...visits].sort((a, b) =>
    `${b.requested_date || ''}${b.requested_time || ''}`.localeCompare(`${a.requested_date || ''}${a.requested_time || ''}`)
  )[0];
}

function normalizeDescription(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Gera um PDF consolidado da rede/franquia a partir do painel do cliente: resumo
 * executivo (críticos, imediatos, reincidências, unidades em atenção), itens que se
 * repetem em várias unidades e uma tabela por unidade com a última visita — pensado
 * para embasar uma reunião com a rede, não só listar datas/status.
 */
export function generateFranchisePdf(overview: ClientPortalOverview): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentW = pageWidth - marginX * 2;
  const now = new Date();

  // Cabeçalho
  doc.setFillColor(16, 29, 69); // navy
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Resumo de inspeções sanitárias', marginX, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(overview.account_name, marginX, 19);
  doc.text(`Emitido em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - marginX, 19, { align: 'right' });

  // ── Última visita de cada unidade + agregados de rede ──────────────────
  const unitsWithLatest = overview.units.map((u) => {
    const last = latestVisit(u.visits);
    const hasReport = u.visits.some((v) => (v.report_count || 0) > 0);
    return { unit: u, last, hasReport };
  });

  const scoredUnits = unitsWithLatest.filter((u) => typeof u.last?.compliance_score === 'number');
  const avgScore = scoredUnits.length
    ? Math.round(scoredUnits.reduce((s, u) => s + (u.last!.compliance_score || 0), 0) / scoredUnits.length)
    : null;

  const totalCritical = unitsWithLatest.reduce((s, u) => s + (u.last?.critical_nc_count || 0), 0);
  const totalImmediate = unitsWithLatest.reduce((s, u) => s + (u.last?.immediate_nc_count || 0), 0);
  const totalRecurringLocal = unitsWithLatest.reduce((s, u) => s + (u.last?.recurring_nc_count || 0), 0);
  const unitsInAttention = scoredUnits.filter((u) => {
    const pct = u.last!.compliance_score as number;
    const critical = u.last!.critical_nc_count || 0;
    return classificationFromPercentAndCritical(pct, critical) === 'critical'
      || classificationFromPercentAndCritical(pct, critical) === 'regular';
  });

  doc.setTextColor(31, 41, 55);
  let y = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumo executivo', marginX, y);
  y += 3;

  // Cards do resumo executivo (2 linhas x 4 cartões)
  const cardGap = 4;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 17;
  const cards: { label: string; value: string; accent: [number, number, number] }[] = [
    { label: 'Unidades', value: String(overview.units.length), accent: [29, 58, 138] },
    { label: 'Inspeções', value: String(unitsWithLatest.reduce((s, u) => s + u.unit.visits.length, 0)), accent: [29, 58, 138] },
    { label: 'Conformidade média', value: avgScore != null ? `${avgScore}%` : '—', accent: [29, 58, 138] },
    { label: 'Unidades em atenção', value: String(unitsInAttention.length), accent: unitsInAttention.length > 0 ? [185, 28, 28] : [22, 163, 74] },
    { label: 'Itens críticos (rede)', value: String(totalCritical), accent: totalCritical > 0 ? [185, 28, 28] : [22, 163, 74] },
    { label: 'Ações imediatas', value: String(totalImmediate), accent: totalImmediate > 0 ? [180, 83, 9] : [22, 163, 74] },
    { label: 'Reincidências', value: String(totalRecurringLocal), accent: totalRecurringLocal > 0 ? [180, 83, 9] : [22, 163, 74] },
    { label: 'Relatórios disponíveis', value: String(unitsWithLatest.filter((u) => u.hasReport).length), accent: [29, 58, 138] },
  ];

  y += 4;
  cards.forEach((card, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = marginX + col * (cardW + cardGap);
    const cardY = y + row * (cardH + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, 'FD');
    doc.setFillColor(...card.accent);
    doc.roundedRect(x, cardY, 2, cardH, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...card.accent);
    doc.text(card.value, x + 5, cardY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label.toUpperCase(), x + 5, cardY + 14, { maxWidth: cardW - 7 });
  });
  y += cardH * 2 + cardGap + 8;

  // ── Unidades em atenção ────────────────────────────────────────────────
  if (unitsInAttention.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text('Unidades em atenção', marginX, y);
    y += 6;

    const attentionRows = unitsInAttention
      .sort((a, b) => (a.last!.compliance_score || 0) - (b.last!.compliance_score || 0))
      .slice(0, 8)
      .map((u) => {
        const topFinding = (u.last?.nc_items || []).find((item) => item.c) || (u.last?.nc_items || [])[0];
        const pct = u.last!.compliance_score as number;
        return [
          u.unit.client_name,
          `${pct}%`,
          classificationLabel(classificationFromPercentAndCritical(pct, u.last!.critical_nc_count || 0)),
          String(u.last!.critical_nc_count || 0),
          String(u.last!.immediate_nc_count || 0),
          topFinding ? topFinding.d : '—',
        ];
      });

    autoTable(doc, {
      startY: y,
      head: [['Unidade', 'Conform.', 'Classificação', 'Críticos', 'Imediatos', 'Principal achado']],
      body: attentionRows,
      styles: { fontSize: 8, cellPadding: 2.2, textColor: [31, 41, 55] },
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Itens recorrentes na rede (mesmo achado em várias unidades) ────────
  const byDescription = new Map<string, { label: string; critical: boolean; units: Set<string> }>();
  for (const u of unitsWithLatest) {
    for (const item of u.last?.nc_items || []) {
      // "Item avaliado" é o fallback genérico quando a descrição não pôde ser
      // resolvida (item não encontrado no roteiro); agrupar por esse texto criaria
      // uma falsa "recorrência" juntando achados que não têm nada em comum.
      if (!item.d || normalizeDescription(item.d) === 'item avaliado') continue;
      const key = normalizeDescription(item.d);
      const entry = byDescription.get(key) || { label: item.d, critical: false, units: new Set<string>() };
      entry.critical = entry.critical || item.c;
      entry.units.add(u.unit.client_name);
      byDescription.set(key, entry);
    }
  }
  const networkRecurring = Array.from(byDescription.values())
    .filter((entry) => entry.units.size >= 2)
    .sort((a, b) => b.units.size - a.units.size || Number(b.critical) - Number(a.critical))
    .slice(0, 8);

  if (networkRecurring.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text('Itens recorrentes na rede', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Mesmo achado de não conformidade presente em 2 ou mais unidades na última visita.', marginX, y + 4.5);
    y += 9;

    autoTable(doc, {
      startY: y,
      head: [['Achado', 'Unidades afetadas', 'Crítico']],
      body: networkRecurring.map((entry) => [
        entry.label,
        `${entry.units.size} (${Array.from(entry.units).join(', ')})`,
        entry.critical ? 'Sim' : 'Não',
      ]),
      styles: { fontSize: 8, cellPadding: 2.2, textColor: [31, 41, 55] },
      headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 70 },
        2: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Tabela por unidade (última visita de cada uma) ─────────────────────
  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text('Todas as unidades', marginX, y);
  y += 6;

  const rows = unitsWithLatest.map(({ unit: u, last, hasReport }) => {
    const pct = last && typeof last.compliance_score === 'number' ? last.compliance_score : null;
    return [
      u.client_name,
      u.city || '—',
      last ? formatDateBR(last.requested_date) : '—',
      pct != null ? `${pct}%` : '—',
      pct != null ? classificationLabel(classificationFromPercentAndCritical(pct, last?.critical_nc_count || 0)) : '—',
      last ? String(last.critical_nc_count ?? '—') : '—',
      last ? String(last.immediate_nc_count ?? '—') : '—',
      hasReport ? 'Sim' : 'Não',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Unidade', 'Cidade', 'Última inspeção', 'Conform.', 'Classificação', 'Críticos', 'Imediatos', 'Relatório']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.3 },
    headStyles: { fillColor: [29, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: marginX, right: marginX },
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'InspecVISA — Consultoria Sanitária. Documento informativo gerado pelo Portal do Cliente.',
    marginX,
    doc.internal.pageSize.getHeight() - 8
  );

  const safeName = overview.account_name.normalize('NFD').replace(/[^\w]+/g, '_').slice(0, 40);
  doc.save(`resumo_inspecoes_${safeName || 'franquia'}.pdf`);
}
