import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inspection, InspectionResponse, ChecklistTemplate, InspectionScore, ConsultantSettings } from '../types';
import { classificationLabel, classificationColor } from './scoring';
import { formatDate } from './imageUtils';

export async function generatePDF(
  inspection: Inspection,
  responses: InspectionResponse[],
  template: ChecklistTemplate,
  score: InspectionScore,
  settings: ConsultantSettings
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primaryColor: [number, number, number] = [30, 107, 94];
  const secondaryColor: [number, number, number] = [45, 90, 142];

  // Helper: footer on every page
  function addFooter(pageNum: number, totalPages: number) {
    const y = pageH - 10;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.companyName || settings.name, margin, y);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW - margin, y, { align: 'right' });
    doc.text(formatDate(new Date()), pageW / 2, y, { align: 'center' });
  }

  // ── PAGE 1: CAPA ─────────────────────────────────────────
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, 40, 'F');

  // Logo if available
  if (settings.logoDataUrl) {
    try {
      doc.addImage(settings.logoDataUrl, 'JPEG', pageW - margin - 30, 5, 28, 28);
    } catch (_) { /* skip invalid logo */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO DE INSPEÇÃO SANITÁRIA', margin, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(template.name, margin, 28);

  // Establishment data
  let y = 55;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO ESTABELECIMENTO', margin, y);
  y += 2;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentW, y);
  y += 8;

  const drawField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(value || '—', margin + 35, y);
    y += 7;
  };

  drawField('Estabelecimento:', inspection.clientName || '');
  drawField('Data da Visita:', formatDate(inspection.inspectionDate));
  drawField('Consultora:', inspection.consultantName);
  if (settings.professionalId) {
    drawField(`${settings.professionalIdLabel || 'Registro'}:`, settings.professionalId);
  }

  // Score box
  y += 5;
  const classification = score.classification;
  const classColor = classificationColor(classification);
  const rgb = hexToRgb(classColor);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.roundedRect(margin, y, contentW, 32, 4, 4, 'F');
  doc.setFillColor(0, 0, 0, 30);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(`${Math.round(score.scorePercentage)}%`, margin + contentW / 2, y + 14, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`de Conformidade — ${classificationLabel(classification)}`, margin + contentW / 2, y + 24, { align: 'center' });

  // ── PAGE 2: RESUMO ───────────────────────────────────────
  doc.addPage();
  y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('RESUMO EXECUTIVO', margin, y);
  y += 8;

  // Summary table
  autoTable(doc, {
    startY: y,
    head: [['Seção', 'Total', 'Cumpre', 'Não Cumpre', 'N/A', '%']],
    body: score.scoreBySection.map(s => [
      s.sectionTitle.length > 35 ? s.sectionTitle.substring(0, 33) + '…' : s.sectionTitle,
      s.totalItems,
      s.compliesCount,
      s.notCompliesCount,
      s.notApplicableCount,
      `${Math.round(s.scorePercentage)}%`,
    ]),
    foot: [[
      'TOTAL',
      score.totalItems,
      score.compliesCount,
      score.notCompliesCount,
      score.notApplicableCount,
      `${Math.round(score.scorePercentage)}%`,
    ]],
    headStyles: { fillColor: primaryColor, fontSize: 9, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 } },
    margin: { left: margin, right: margin },
    theme: 'striped',
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (inspection.observations) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('Observações Gerais:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(inspection.observations, contentW);
    doc.text(obsLines, margin, y);
  }

  // ── PAGES 3+: NONCONFORMANCES ────────────────────────────
  const allItems = template.sections.flatMap(s => s.items);
  const nonCompliant = responses.filter(r => r.result === 'not_complies');

  if (nonCompliant.length > 0) {
    doc.addPage();
    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text('NÃO CONFORMIDADES IDENTIFICADAS', margin, y);
    y += 2;
    doc.setDrawColor(...primaryColor);
    doc.line(margin, y, margin + contentW, y);
    y += 8;

    let ncNum = 1;
    for (const response of nonCompliant) {
      const item = allItems.find(i => i.id === response.itemId);
      if (!item) continue;

      if (y > pageH - 60) { doc.addPage(); y = margin; }

      // NC header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 4, contentW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`[NC-${String(ncNum).padStart(3, '0')}] ${item.description.substring(0, 90)}`, margin + 2, y);
      y += 5;
      if (item.description.length > 90) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const rest = doc.splitTextToSize(item.description.substring(90), contentW - 4);
        doc.text(rest, margin + 2, y);
        y += rest.length * 4;
      }

      if (item.legislation) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const legText = `Base legal: ${item.legislation}`;
        const legLines = doc.splitTextToSize(legText, contentW - 4);
        doc.text(legLines, margin + 2, y);
        y += legLines.length * 4;
        
        if (item.isCritical) {
          doc.setFillColor(254, 226, 226); // red-100
          doc.roundedRect(margin + 2, y, 30, 5, 2, 2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(185, 28, 28); // red-700
          doc.text('ITEM CRÍTICO', margin + 7, y + 3.5);
          y += 6;
        } else {
          y += 2;
        }
      }

      if (response.situationDescription) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(180, 50, 50);
        doc.text('Situação encontrada:', margin + 2, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(response.situationDescription, contentW - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 4 + 2;
      }

      if (response.correctiveAction) {
        if (y > pageH - 40) { doc.addPage(); y = margin; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 90, 60);
        doc.text('Ação corretiva:', margin + 2, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(response.correctiveAction, contentW - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 4 + 2;
      }

      // Photos
      if (response.photos.length > 0) {
        if (y > pageH - 60) { doc.addPage(); y = margin; }
        const maxImgW = (contentW - 5) / 2;
        const maxImgH = maxImgW * 0.75;
        let col = 0;
        let currentRowMaxH = 0;
        
        for (const photo of response.photos) {
          try {
            const img = new Image();
            img.src = photo.dataUrl;
            await new Promise(resolve => img.onload = resolve);
            
            const ratio = img.height / img.width;
            let drawW = maxImgW;
            let drawH = drawW * ratio;
            
            if (drawH > maxImgH) {
              drawH = maxImgH;
              drawW = drawH / ratio;
            }
            
            const x = margin + col * (maxImgW + 5) + (maxImgW - drawW) / 2; 
            if (col === 0 && y + maxImgH > pageH - 20) { doc.addPage(); y = margin; }
            
            doc.addImage(photo.dataUrl, 'JPEG', x, y, drawW, drawH);
            currentRowMaxH = Math.max(currentRowMaxH, drawH);
            
            col++;
            if (col === 2) { 
              col = 0; 
              y += currentRowMaxH + 3; 
              currentRowMaxH = 0;
            }
          } catch (_) { /* skip */ }
        }
        if (col > 0) y += currentRowMaxH + 3;
      }

      y += 6;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 2, margin + contentW, y - 2);
      ncNum++;
    }
  }

  // ── LAST PAGE: SIGNATURE ─────────────────────────────────
  doc.addPage();
  y = pageH - 60;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const disclaimer = 'Este relatório foi elaborado com base nas legislações sanitárias vigentes, durante visita técnica realizada na data indicada.';
  const dLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(dLines, margin, y);
  y += 20;
  doc.setDrawColor(30, 30, 30);
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(settings.name, margin, y);
  if (settings.professionalId) {
    y += 5;
    doc.text(`${settings.professionalIdLabel || 'Registro'}: ${settings.professionalId}`, margin, y);
  }

  // Add footers
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const filename = `Inspecao_${(inspection.clientName || 'cliente').replace(/\s+/g, '_')}_${formatDate(inspection.inspectionDate).replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [30, 107, 94];
}
