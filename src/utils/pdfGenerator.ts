import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inspection, InspectionResponse, ChecklistTemplate, InspectionScore, ConsultantSettings, FoodEstablishmentType, ReferenceSource } from '../types';
import { FOOD_SEGMENT_LABELS } from '../types';
import { classificationLabel, getLatestResponsesByItem, calculateAreaScores } from './scoring';
import { formatDate } from './imageUtils';
import { calculateILPIStaffing } from './ilpiStaffing';
import { isRioState } from './state';
// REF-02: pdfGenerator mantinha uma cópia própria (e defasada) de
// extractBaseLegislation — sem os qualificadores do REF-01 nem as correções de
// número/ano do REF-02. Passa a usar a mesma implementação do resto do app.
import { extractBaseLegislation, canonicalLegislationKey } from './legislationRefs';


function getPdfImageFormat(dataUrl: string) {
  if (/^data:image\/png/i.test(dataUrl)) return 'PNG';
  if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
  return 'JPEG';
}

function isLocalReportImage(dataUrl?: string | null): dataUrl is string {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl || '');
}

async function loadImageSize(dataUrl: string, timeoutMs = 8000): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (value: { width: number; height: number } | null) => {
      window.clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };
    const timeout = window.setTimeout(() => done(null), timeoutMs);

    img.onload = () => done({ width: img.width, height: img.height });
    img.onerror = () => done(null);
    img.src = dataUrl;
  });
}

export interface GeneratedPdfFile {
  blob: Blob;
  filename: string;
}

function savePdfWithFallback(doc: jsPDF, filename: string): GeneratedPdfFile {
  const blob = doc.output('blob');
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('PDF gerado vazio.');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canDownload = 'download' in link && !isIOS;

  try {
    if (canDownload) {
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { blob, filename };
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = url;
    } else {
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    return { blob, filename };
  } catch (err) {
    URL.revokeObjectURL(url);
    try {
      doc.save(filename);
      return { blob, filename };
    } catch {
      throw err;
    }
  }
}

export async function generatePDF(
  inspection: Inspection,
  responses: InspectionResponse[],
  template: ChecklistTemplate,
  score: InspectionScore,
  settings: ConsultantSettings,
  legislations: any[] = [],
  options: { selectedLegislations?: string[]; referenceSources?: ReferenceSource[]; signatureDataUrl?: string; recurringItemIds?: Set<string> } = {}
): Promise<GeneratedPdfFile> {
  const recurringItemIds = options.recurringItemIds ?? new Set<string>();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primaryColor: [number, number, number] = [20, 40, 80]; // Navy Blue 
  const secondaryColor: [number, number, number] = [45, 90, 142];
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [100, 116, 139];
  const borderColor: [number, number, number] = [226, 232, 240];
  const surfaceColor: [number, number, number] = [248, 250, 252];
  const templateItemIds = new Set(template.sections.flatMap(section => section.items.map(item => item.id)));
  const reportResponses = getLatestResponsesByItem(responses, templateItemIds);
  const isIlpiReport = template.category === 'ilpi' || inspection.clientCategory === 'ilpi';
  // Separação por área (sanitária x nutrição) para o bloco "por área" da capa.
  const areaScores = calculateAreaScores(responses, template.sections);
  const isRJInspection = isRioState(inspection.state);
  const reportConsultants = isIlpiReport
    ? [
        { name: 'Ana Roberta Ribeiro', registration: 'CRN-RJ 10324' },
        { name: 'Ester Caiafa', registration: 'COREN-RJ 759.561' },
      ]
    : [
        {
          name: inspection.consultantName || settings.name || '',
          registration: settings.professionalId ? `${settings.professionalIdLabel || 'Registro'}: ${settings.professionalId}` : '',
        },
      ];

  function drawSectionTitle(title: string, subtitle?: string) {
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, y - 5, 3, subtitle ? 18 : 12, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text(title, margin + 9, y + 2);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...mutedColor);
      doc.text(subtitle, margin + 9, y + 10);
      y += 20;
      return;
    }
    y += 15;
  }

  function drawMetricCard(
    x: number,
    width: number,
    label: string,
    value: string,
    accent: [number, number, number]
  ) {
    doc.setFillColor(...surfaceColor);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(x, y, width, 19, 2, 2, 'FD');
    doc.setFillColor(...accent);
    doc.roundedRect(x, y, 2.5, 19, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...textColor);
    doc.text(value, x + 7, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedColor);
    doc.text(label.toUpperCase(), x + 7, y + 15);
  }

  async function drawPhotoGrid(photos: InspectionResponse['photos'], startY: number) {
    if (!photos || photos.length === 0) return startY;

    let photoY = startY;
    if (photoY > pageH - 60) {
      doc.addPage();
      photoY = margin;
    }

    const maxImgW = (contentW - 5) / 2;
    const maxImgH = maxImgW * 0.75;
    let col = 0;
    let currentRowMaxH = 0;

    for (const photo of photos) {
      try {
        if (!isLocalReportImage(photo.dataUrl)) {
          console.warn('[PDF] Skipping unavailable local photo', photo.id);
          continue;
        }

        const imageSize = await loadImageSize(photo.dataUrl);
        if (!imageSize || imageSize.width <= 0 || imageSize.height <= 0) {
          console.warn('[PDF] Skipping unreadable photo', photo.id);
          continue;
        }

        const ratio = imageSize.height / imageSize.width;
        let drawW = maxImgW;
        let drawH = drawW * ratio;

        if (drawH > maxImgH) {
          drawH = maxImgH;
          drawW = drawH / ratio;
        }

        const x = margin + col * (maxImgW + 5) + (maxImgW - drawW) / 2;
        if (col === 0 && photoY + maxImgH > pageH - 20) {
          doc.addPage();
          photoY = margin;
        }

        doc.addImage(photo.dataUrl, getPdfImageFormat(photo.dataUrl) as any, x, photoY, drawW, drawH);
        currentRowMaxH = Math.max(currentRowMaxH, drawH);

        col++;
        if (col === 2) {
          col = 0;
          photoY += currentRowMaxH + 3;
          currentRowMaxH = 0;
        }
      } catch (err) {
        console.warn('[PDF] Failed to add photo, skipping', photo.id, err);
      }
    }

    if (col > 0) photoY += currentRowMaxH + 3;
    return photoY;
  }

  // Links anexados pelo consultor a este item durante a inspeção (não confundir
  // com as fontes gerais da inspeção, em drawConsultedSources).
  function drawItemLinks(links: string[] | undefined, startY: number) {
    if (!links || links.length === 0) return startY;
    let linkY = startY;
    if (linkY > pageH - 20) {
      doc.addPage();
      linkY = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedColor);
    doc.text('Fontes consultadas neste item:', margin + 8, linkY);
    linkY += 4.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(30, 107, 94);
    for (const link of links) {
      if (linkY > pageH - 15) {
        doc.addPage();
        linkY = margin;
      }
      const lines: string[] = doc.splitTextToSize(`<${link}>`, contentW - 16);
      doc.text(lines, margin + 8, linkY);
      linkY += lines.length * 4 + 1;
    }
    return linkY + 3;
  }

  // Helper: footer on every page
  function addFooter(pageNum: number, totalPages: number) {
    const y = pageH - 10;
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 6, pageW - margin, y - 6);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.companyName || settings.name, margin, y);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW - margin, y, { align: 'right' });
    // Data da visita (que finalizou o relatório), não a data de geração do arquivo.
    doc.text(formatDate(inspection.inspectionDate), pageW / 2, y, { align: 'center' });
  }

  // ── PAGE 1: CAPA ─────────────────────────────────────────
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, 40, 'F');

  // Logo if available
  if (settings.logoDataUrl) {
    try {
      doc.addImage(settings.logoDataUrl, 'JPEG', pageW - margin - 30, 5, 28, 28);
    } catch { /* skip invalid logo */ }
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
  drawField('Localização:', `${inspection.city || '—'} / ${inspection.state || '—'}`);
  drawField('Data da Visita:', formatDate(inspection.inspectionDate));
  reportConsultants.forEach((consultant, index) => {
    drawField(index === 0 ? (reportConsultants.length > 1 ? 'Consultoras:' : 'Consultora:') : '', consultant.name);
    if (consultant.registration) drawField('', consultant.registration);
  });

  if (inspection.clientCategory === 'alimentos' && inspection.foodTypes && inspection.foodTypes.length > 0) {
    const segments = inspection.foodTypes.map(ft => FOOD_SEGMENT_LABELS[ft] || ft).join(', ');
    drawField('Segmentos:', segments);
  }

  if (inspection.accompanistName) {
    drawField('Acompanhante:', `${inspection.accompanistName} ${inspection.accompanistRole ? `(${inspection.accompanistRole})` : ''}`);
  }

  if (!isIlpiReport && settings.professionalId) {
    drawField(`${settings.professionalIdLabel || 'Registro'}:`, settings.professionalId);
  }

  // ILPI Extra Information
  if (inspection.ilpiCapacity || inspection.residentsTotal || inspection.usableAreaM2) {
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('DADOS TÉCNICOS ILPI', margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Capacidade', 'Nº Residentes', 'Grau I', 'Grau II', 'Grau III']],
      body: [[
        inspection.ilpiCapacity || '—',
        inspection.residentsTotal || '—',
        inspection.dependencyLevel1 || '0',
        inspection.dependencyLevel2 || '0',
        inspection.dependencyLevel3 || '0',
      ]],
      headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontSize: 8 },
      bodyStyles: { fontSize: 10, halign: 'center' },
      margin: { left: margin, right: margin },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Staffing calculation summary — state-aware
    const l1 = inspection.dependencyLevel1 || 0;
    const l2 = inspection.dependencyLevel2 || 0;
    const l3 = inspection.dependencyLevel3 || 0;
    const staffing = calculateILPIStaffing({
      level1: l1,
      level2: l2,
      level3: l3,
      observedCaregivers: inspection.observedStaff || 0,
      observedNursingTechs: inspection.observedNursingTechs || 0,
      usableAreaM2: inspection.usableAreaM2 || 0,
      observedCleaningStaff: inspection.observedCleaningStaff || 0,
      isRJ: isRJInspection,
    });
    const status = (ok: boolean) => ok ? 'ADEQUADO' : 'INSUFICIENTE';
    const teamRows: Array<[string, number, number, string]> = [
      ['Cuidadores', staffing.observedCaregivers, staffing.caregivers.total, status(staffing.caregiversOk)],
    ];
    if (isRJInspection) {
      teamRows.push(['Técnicos de enfermagem', staffing.observedNursingTechs, staffing.nursingTechs.total, status(staffing.nursingTechsOk)]);
    }
    if (staffing.cleaningStaff.areaM2 > 0) {
      teamRows.push([
        `Limpeza (${staffing.cleaningStaff.areaM2} m²)`,
        staffing.observedCleaningStaff,
        staffing.cleaningStaff.total,
        status(staffing.cleaningStaffOk),
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [['Equipe em turno', 'Observado', 'Mínimo exigido', 'Resultado']],
      body: teamRows,
      headStyles: { fillColor: primaryColor, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor },
      columnStyles: {
        0: { cellWidth: 63 },
        1: { cellWidth: 29, halign: 'center' },
        2: { cellWidth: 33, halign: 'center' },
        3: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const ok = String(data.cell.raw) === 'ADEQUADO';
          data.cell.styles.textColor = ok ? [22, 101, 52] : [185, 28, 28];
          data.cell.styles.fillColor = ok ? [240, 253, 244] : [254, 242, 242];
        }
      },
      margin: { left: margin, right: margin },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`Base legal: ${staffing.legalBase}. Técnico de enfermagem não substitui cuidador no dimensionamento.`, margin, y);
    y += 10;
  }

  // ── PAGE 1: CAPA (Score Box) ─────────────────────────────
  y += 5;
  const scorePercent = Math.round(score.scorePercentage);
  const getScoreColor = (p: number) => {
    if (p >= 85) return [34, 197, 94]; // Green
    if (p >= 70) return [245, 158, 11]; // Yellow
    return [239, 68, 68]; // Red
  };
  const rgb = getScoreColor(scorePercent);
  // Caixa dupla: Conformidade (%) e Classificação de Risco (MARP)
  const riskRgbMap: Record<string, [number, number, number]> = {
    excellent: [34, 197, 94], good: [132, 204, 22], regular: [245, 158, 11], critical: [239, 68, 68],
  };
  const riskRgb = riskRgbMap[score.classification] || [100, 116, 139];
  const riskLabel = classificationLabel(score.classification);
  const halfW = (contentW - 4) / 2;
  const cx1 = margin + halfW / 2;
  const cx2 = margin + halfW + 4 + halfW / 2;

  // Esquerda — % de conformidade (cor pelo %)
  doc.setFillColor(...(rgb as [number, number, number]));
  doc.roundedRect(margin, y, halfW, 35, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text(`${scorePercent}%`, cx1, y + 15, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text('CONFORMIDADE', cx1, y + 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${score.evaluatedItems} de ${score.totalItems} itens avaliados`, cx1, y + 29, { align: 'center' });

  // Direita — classificação de risco (cor pelo risco)
  doc.setFillColor(...riskRgb);
  doc.roundedRect(margin + halfW + 4, y, halfW, 35, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(riskLabel, cx2, y + 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('CLASSIFICAÇÃO DE RISCO', cx2, y + 22, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`${score.criticalNotCompliesCount} não conformidade(s) crítica(s)`, cx2, y + 29, { align: 'center' });

  y += 42;
  // Progress Bar under score box
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, y, contentW, 3, 1.5, 1.5, 'F');
  doc.setFillColor(...(rgb as [number, number, number]));
  doc.roundedRect(margin, y, (contentW * scorePercent) / 100, 3, 1.5, 1.5, 'F');
  y += 10;

  const coverGap = 4;
  const coverCardW = (contentW - coverGap * 3) / 4;
  drawMetricCard(margin, coverCardW, 'Cumpre', `${score.compliesCount}`, [22, 163, 74]);
  drawMetricCard(margin + coverCardW + coverGap, coverCardW, 'Não cumpre', `${score.notCompliesCount}`, [220, 38, 38]);
  drawMetricCard(margin + (coverCardW + coverGap) * 2, coverCardW, 'Críticos', `${score.criticalNotCompliesCount}`, [185, 28, 28]);
  drawMetricCard(margin + (coverCardW + coverGap) * 3, coverCardW, 'Não avaliados', `${score.notEvaluatedCount}`, [100, 116, 139]);
  y += 25;


  // ── PAGE 2: RESUMO ───────────────────────────────────────
  doc.addPage();
  y = margin;
  drawSectionTitle(
    'RESUMO EXECUTIVO',
    'Leitura rápida dos achados e distribuição dos resultados por área inspecionada.'
  );

  const summaryGap = 4;
  const summaryCardW = (contentW - summaryGap * 3) / 4;
  drawMetricCard(margin, summaryCardW, 'Conformidades', `${score.compliesCount}`, [22, 163, 74]);
  drawMetricCard(margin + summaryCardW + summaryGap, summaryCardW, 'Não conformidades', `${score.notCompliesCount}`, [220, 38, 38]);
  drawMetricCard(margin + (summaryCardW + summaryGap) * 2, summaryCardW, 'Urgentes', `${score.urgentActionsCount}`, [234, 88, 12]);
  drawMetricCard(margin + (summaryCardW + summaryGap) * 3, summaryCardW, 'Não observados', `${score.notObservedCount}`, [71, 85, 105]);
  y += 27;

  // ── Conformidade por área (sanitária x nutrição) ─────────
  // Só em ILPI com as duas áreas avaliadas. O número grande da capa é o GLOBAL.
  if (areaScores.isSplit && isIlpiReport) {
    const areaCards: { label: string; consultant?: string; pct: number; classif: string; nc: number }[] = [
      {
        label: areaScores.sanitary.areaLabel,
        consultant: areaScores.sanitary.consultant,
        pct: Math.round(areaScores.sanitary.score.scorePercentage),
        classif: areaScores.sanitary.score.classification,
        nc: areaScores.sanitary.score.notCompliesCount,
      },
      {
        label: areaScores.nutrition.areaLabel,
        consultant: areaScores.nutrition.consultant,
        pct: Math.round(areaScores.nutrition.score.scorePercentage),
        classif: areaScores.nutrition.score.classification,
        nc: areaScores.nutrition.score.notCompliesCount,
      },
    ];
    const areaGap = 4;
    const areaW = (contentW - areaGap) / 2;
    areaCards.forEach((card, idx) => {
      const ax = margin + idx * (areaW + areaGap);
      const cardRgb = riskRgbMap[card.classif] || [100, 116, 139];
      doc.setDrawColor(...borderColor);
      doc.setFillColor(...surfaceColor);
      doc.roundedRect(ax, y, areaW, 18, 2.5, 2.5, 'FD');
      doc.setFillColor(...(cardRgb as [number, number, number]));
      doc.roundedRect(ax, y, 2.5, 18, 1, 1, 'F');
      const tx = ax + 7;
      doc.setTextColor(...mutedColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const who = (card.consultant || '').trim().split(/\s+/)[0];
      doc.text(`${card.label.toUpperCase()}${who ? ` - ${who.toUpperCase()}` : ''}`, tx, y + 6);
      doc.setTextColor(...textColor);
      doc.setFontSize(18);
      doc.text(`${card.pct}%`, tx, y + 14.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...mutedColor);
      doc.text(`${card.nc} NC · ${classificationLabel(card.classif as any)}`, tx + 21, y + 14.5);
    });
    y += 24;
  }

  // Summary table
  autoTable(doc, {
    startY: y,
    head: [['Seção', 'Total', 'Cumpre', 'Não Cumpre', 'NO', 'N/A', '%']],
    body: score.scoreBySection.map(s => {
      const sectionDef = template.sections.find(sec => sec.id === s.sectionId);
      const isExtra = sectionDef?.isExtraSection;
      const segment = sectionDef?.segmentKey ? (FOOD_SEGMENT_LABELS[sectionDef.segmentKey as FoodEstablishmentType] || sectionDef.segmentKey) : '';
      const title = isExtra ? `${s.sectionTitle} (ESPECÍFICO - ${segment.toUpperCase()})` : s.sectionTitle;

      return [
        title.length > 45 ? title.substring(0, 43) + '…' : title,
        s.totalItems,
        s.compliesCount,
        s.notCompliesCount,
        s.notObservedCount,
        s.notApplicableCount,
        `${Math.round(s.scorePercentage)}%`,
      ];
    }),
    foot: [[
      'TOTAL',
      score.totalItems,
      score.compliesCount,
      score.notCompliesCount,
      score.notObservedCount,
      score.notApplicableCount,
      `${Math.round(score.scorePercentage)}%`,
    ]],
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2.5 },
    footStyles: { fillColor: [226, 232, 240], fontStyle: 'bold', fontSize: 8.5, textColor },
    bodyStyles: { fontSize: 8.5, textColor, cellPadding: 2.3 },
    alternateRowStyles: { fillColor: surfaceColor },
    columnStyles: {
      0: { cellWidth: 77 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 17, halign: 'center' },
      3: { cellWidth: 21, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 13, halign: 'center' },
      6: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    theme: 'plain',
  });

  y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text('PRIORIDADE DE TRATAMENTO', margin + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  doc.text(
    `${score.urgentActionsCount} ação(ões) urgente(s) e ${score.importantActionsCount} importante(s) detalhadas nas páginas seguintes.`,
    margin + 5,
    y + 13
  );

  // ── NEW PAGE: PLANO DE AÇÃO RECOMENDADO ──────────────────
  doc.addPage();
  y = margin;
  drawSectionTitle(
    'PLANO DE AÇÃO RECOMENDADO',
    'Itens priorizados para correção, com achado, medida indicada, prazo e responsável.'
  );

  const allItemsList = template.sections.flatMap(s => s.items);
  const nonCompliantItems = reportResponses.filter(r => r.result === 'not_complies');

  // ── ACTION PLAN SORTING LOGIC ──
  // 1. Sort by Deadline (Immediate > 7 > 15 > 30 > 60 > 90)
  // 2. Sort by Criticality (Critical first)
  const deadlineWeights: Record<string, number> = {
    'Imediato': 1,
    '7 dias': 2,
    '15 dias': 3,
    '30 dias': 4,
    '60 dias': 5,
    '90 dias': 6,
    '120 dias': 7
  };

  const sortedNonCompliant = [...nonCompliantItems].sort((a, b) => {
    const wA = deadlineWeights[a.deadline || ''] || 99;
    const wB = deadlineWeights[b.deadline || ''] || 99;
    if (wA !== wB) return wA - wB;

    const itA = allItemsList.find(i => i.id === a.itemId);
    const itB = allItemsList.find(i => i.id === b.itemId);
    if (itA?.isCritical && !itB?.isCritical) return -1;
    if (!itA?.isCritical && itB?.isCritical) return 1;
    return 0;
  });

  // Urgent Actions (Critical Weight 10)
  const urgentItems = sortedNonCompliant.filter(r => {
    const it = allItemsList.find(i => i.id === r.itemId);
    return it?.isCritical;
  });

  // Important Actions (Necessary Weight 5+)
  const importantItems = sortedNonCompliant.filter(r => {
    const it = allItemsList.find(i => i.id === r.itemId);
    return !it?.isCritical && (it?.weight || 0) >= 5;
  });

  const drawPlanContinuation = () => {
    doc.addPage();
    y = margin;
    drawSectionTitle('PLANO DE AÇÃO', 'Continuação dos itens priorizados para correção.');
  };

  const drawActionCards = (
    title: string,
    items: InspectionResponse[],
    accent: [number, number, number],
    background: [number, number, number],
    defaultDeadline: string
  ) => {
    if (items.length === 0) return;
    if (y > pageH - 35) drawPlanContinuation();

    const drawGroupHeading = (continuation = false) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...accent);
      doc.text(`${title}${continuation ? ' - CONTINUAÇÃO' : ''} (${items.length})`, margin, y);
      y += 8;
    };
    drawGroupHeading();

    items.forEach((response) => {
      const cardInnerX = margin + 8;
      const cardInnerW = contentW - 20;
      const pageBottom = pageH - 24;
      const bodyFontSize = 10;
      const bodyLineHeight = 5.1;
      const requirementFontSize = 9;
      const requirementLineHeight = 4.7;
      const item = allItemsList.find(candidate => candidate.id === response.itemId);
      const isRecurring = recurringItemIds.has(response.itemId);
      const cardNumber = sortedNonCompliant.indexOf(response) + 1;
      const situation = response.situationDescription || 'Achado registrado durante a visita técnica.';
      const correction = response.correctiveAction || 'Definir medida corretiva e registrar evidência de conclusão.';
      const requirement = item?.description || response.customDescription || 'Requisito avaliado.';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(bodyFontSize);
      const situationLines: string[] = doc.splitTextToSize(situation, cardInnerW);
      const correctionLines: string[] = doc.splitTextToSize(correction, cardInnerW);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(requirementFontSize);
      const requirementLines: string[] = doc.splitTextToSize(requirement, cardInnerW);

      const cardHeight = 58
        + situationLines.length * bodyLineHeight
        + correctionLines.length * bodyLineHeight
        + requirementLines.length * requirementLineHeight;
      const fullPageCardHeight = pageBottom - margin - 8;

      if (y + cardHeight > pageBottom && cardHeight <= fullPageCardHeight) {
        drawPlanContinuation();
        drawGroupHeading(true);
      }

      const deadline = response.deadline || defaultDeadline;
      const responsible = response.responsible || 'RT / Gestor';
      const chipText = `${deadline}  |  ${responsible}`;

      const drawCardFrame = (height: number, continuation = false) => {
        doc.setFillColor(...background);
        doc.setDrawColor(...borderColor);
        doc.roundedRect(margin, y, contentW, height, 2.5, 2.5, 'FD');
        doc.setFillColor(...accent);
        doc.roundedRect(margin, y, 3, height, 1.5, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...textColor);
        doc.text(
          `AÇÃO ${String(cardNumber).padStart(2, '0')}${continuation ? ' - CONTINUAÇÃO' : ''}`,
          cardInnerX,
          y + 9
        );

        // Selo de reincidência: NC já registrada em visita anterior deste cliente.
        if (!continuation && isRecurring) {
          const titleW = doc.getTextWidth(`AÇÃO ${String(cardNumber).padStart(2, '0')}`);
          const tagText = 'REINCIDENTE';
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          const tagW = doc.getTextWidth(tagText) + 6;
          const tagX = cardInnerX + titleW + 4;
          doc.setFillColor(127, 29, 29); // red-900
          doc.roundedRect(tagX, y + 4.5, tagW, 6, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(tagText, tagX + 3, y + 8.9);
        }

        if (!continuation) {
          doc.setFontSize(8);
          const chipWidth = Math.min(74, doc.getTextWidth(chipText) + 8);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(pageW - margin - chipWidth - 5, y + 3, chipWidth, 9, 3, 3, 'F');
          doc.setTextColor(...accent);
          doc.text(chipText, pageW - margin - chipWidth - 1, y + 8.8);
        }
      };

      const drawTextBlock = (label: string, lines: string[], startY: number, isRequirement = false) => {
        let blockY = startY;
        if (isRequirement) {
          doc.setDrawColor(...borderColor);
          doc.line(cardInnerX, blockY, margin + contentW - 8, blockY);
          blockY += 5;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text(label, cardInnerX, blockY);
        blockY += 5;
        doc.setFont('helvetica', isRequirement ? 'italic' : 'normal');
        doc.setFontSize(isRequirement ? requirementFontSize : bodyFontSize);
        doc.setTextColor(...textColor);
        doc.text(lines, cardInnerX, blockY, { maxWidth: cardInnerW });
        return blockY + lines.length * (isRequirement ? requirementLineHeight : bodyLineHeight) + 5;
      };

      if (cardHeight <= fullPageCardHeight) {
        drawCardFrame(cardHeight);
        let cardY = y + 19;
        cardY = drawTextBlock('SITUAÇÃO ENCONTRADA', situationLines, cardY);
        cardY = drawTextBlock('AÇÃO RECOMENDADA', correctionLines, cardY);
        drawTextBlock('REQUISITO AVALIADO', requirementLines, cardY, true);
        y += cardHeight + 6;
        return;
      }

      const blocks = [
        { label: 'SITUAÇÃO ENCONTRADA', lines: situationLines, isRequirement: false },
        { label: 'AÇÃO RECOMENDADA', lines: correctionLines, isRequirement: false },
        { label: 'REQUISITO AVALIADO', lines: requirementLines, isRequirement: true },
      ];

      blocks.forEach((block, blockIndex) => {
        const continuation = blockIndex > 0;
        const lineHeight = block.isRequirement ? requirementLineHeight : bodyLineHeight;
        const blockHeight = 34 + block.lines.length * lineHeight + (block.isRequirement ? 5 : 0);
        if (continuation || y + blockHeight > pageBottom) {
          drawPlanContinuation();
          drawGroupHeading(true);
        }
        drawCardFrame(blockHeight, continuation);
        drawTextBlock(block.label, block.lines, y + 19, block.isRequirement);
        y += blockHeight + 6;
      });
    });
  };

  drawActionCards('URGENTES - ITENS CRÍTICOS', urgentItems, [185, 28, 28], [254, 242, 242], '15 dias');
  drawActionCards('IMPORTANTES - NECESSÁRIOS', importantItems, [180, 83, 9], [255, 251, 235], '60 dias');

  // Summary of Conformance — visão por categoria/área (não deixa a página vazia)
  if (y > pageH - 80) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 197, 94);
  doc.text('GRUPO 3 — ITENS EM CONFORMIDADE', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const overallEvaluated = score.compliesCount + score.notCompliesCount;
  const overallPct = overallEvaluated > 0
    ? Math.round((score.compliesCount / overallEvaluated) * 100)
    : 0;
  const conformanceIntro = `${score.compliesCount} de ${overallEvaluated} itens avaliados encontram-se em conformidade nesta inspeção (${overallPct}% de adequação). A distribuição por área inspecionada está detalhada abaixo, destacando os pontos já regularizados pelo estabelecimento.`;
  const introLines = doc.splitTextToSize(conformanceIntro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.6 + 6;

  // Tabela de conformidade por seção/categoria
  const conformanceRows = score.scoreBySection
    .map(s => {
      const sectionDef = template.sections.find(sec => sec.id === s.sectionId);
      const segment = sectionDef?.segmentKey
        ? (FOOD_SEGMENT_LABELS[sectionDef.segmentKey as FoodEstablishmentType] || sectionDef.segmentKey)
        : '';
      const rawTitle = sectionDef?.isExtraSection ? `${s.sectionTitle} (${segment})` : s.sectionTitle;
      const evaluated = s.compliesCount + s.notCompliesCount;
      const pct = evaluated > 0 ? Math.round((s.compliesCount / evaluated) * 100) : 0;
      return {
        title: rawTitle.length > 52 ? rawTitle.substring(0, 50) + '…' : rawTitle,
        complies: s.compliesCount,
        evaluated,
        pct,
      };
    })
    .filter(r => r.evaluated > 0);

  if (conformanceRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Área inspecionada', 'Conformes', 'Avaliados', '% Conformidade']],
      body: conformanceRows.map(r => [r.title, r.complies, r.evaluated, `${r.pct}%`]),
      foot: [['TOTAL', score.compliesCount, overallEvaluated, `${overallPct}%`]],
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2.3 },
      footStyles: { fillColor: [220, 252, 231], fontStyle: 'bold', fontSize: 8.5, textColor },
      bodyStyles: { fontSize: 8.5, textColor, cellPadding: 2.2 },
      alternateRowStyles: { fillColor: surfaceColor },
      columnStyles: {
        0: { cellWidth: 96 },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const pctValue = parseInt(String(data.cell.raw)) || 0;
          data.cell.styles.textColor = pctValue >= 85 ? [22, 101, 52] : pctValue >= 70 ? [180, 83, 9] : [185, 28, 28];
        }
      },
      margin: { left: margin, right: margin },
      theme: 'plain',
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    y += 4;
  }

  if (inspection.observations) {
    if (y > pageH - 40) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('Observações Gerais:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(inspection.observations, contentW);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 5 + 5;
  }

  // ── PAGES 3+: NONCONFORMANCES ────────────────────────────
  const allItems = template.sections.flatMap(s => s.items);

  if (nonCompliantItems.length > 0) {
    doc.addPage();
    y = margin;
    const drawNonComplianceHeading = (continuation = false) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...primaryColor);
      doc.text(`NÃO CONFORMIDADES IDENTIFICADAS${continuation ? ' - CONTINUAÇÃO' : ''}`, margin, y);
      y += 3;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin + contentW, y);
      y += 10;
    };
    const continueNonCompliancePage = () => {
      doc.addPage();
      y = margin;
      drawNonComplianceHeading(true);
    };
    const ensureNonComplianceSpace = (height: number) => {
      if (y + height > pageH - 22) continueNonCompliancePage();
    };

    drawNonComplianceHeading();

    let ncNum = 1;
    for (const response of nonCompliantItems) {
      const item = allItems.find(i => i.id === response.itemId);
      if (!item) continue;

      const title = `[NC-${String(ncNum).padStart(3, '0')}] ${item.description}`;
      const titleFontSize = 10.5;
      const titleLineH = 5.4;          // espaçamento real entre linhas do título
      const titleTopPad = 7;           // base da 1ª linha em relação ao topo da caixa
      const titleBottomPad = 4;        // folga abaixo da última linha
      const badgeGap = 2;
      const badgeBoxH = 6.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(titleFontSize);
      // Largura de quebra alinhada ao desenho: texto em margin+8, padding direito de 8mm.
      const titleLines: string[] = doc.splitTextToSize(title, contentW - 16);
      const badgeHeight = item.isCritical ? badgeGap + badgeBoxH : 0;
      const headerHeight =
        titleTopPad + titleLines.length * titleLineH + badgeHeight + titleBottomPad;
      ensureNonComplianceSpace(headerHeight + 12);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...borderColor);
      doc.roundedRect(margin, y, contentW, headerHeight, 2, 2, 'FD');
      const headerAccent: [number, number, number] = item.isCritical ? [185, 28, 28] : secondaryColor;
      doc.setFillColor(...headerAccent);
      doc.roundedRect(margin, y, 3, headerHeight, 1.5, 1.5, 'F');
      doc.setTextColor(...textColor);
      // Renderiza cada linha em posição explícita para a caixa caber exatamente o título.
      titleLines.forEach((line, lineIdx) => {
        doc.text(line, margin + 8, y + titleTopPad + lineIdx * titleLineH);
      });
      const headerY = y + titleTopPad + (titleLines.length - 1) * titleLineH + badgeGap + 2;
      if (item.isCritical) {
        doc.setFillColor(185, 28, 28);
        doc.roundedRect(margin + 8, headerY, 33, badgeBoxH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text('ITEM CRÍTICO', margin + 24.5, headerY + 4.4, { align: 'center' });
      }
      y += headerHeight + 4;
      if (item.legislation) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.7);
        doc.setTextColor(...mutedColor);
        const legText = item.requirementType === 'good_practice'
          ? `Boa prática — não é exigência legal: ${item.legislation}`
          : `Base legal: ${item.legislation}`;
        const legLines: string[] = doc.splitTextToSize(legText, contentW - 8);
        ensureNonComplianceSpace(legLines.length * 4.5 + 4);
        doc.text(legLines, margin + 8, y);
        y += legLines.length * 4.5 + 4;
      }

      if (response.situationDescription) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.8);
        const lines: string[] = doc.splitTextToSize(response.situationDescription, contentW - 16);
        ensureNonComplianceSpace(lines.length * 5 + 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(153, 27, 27);
        doc.text('Situação encontrada:', margin + 8, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.8);
        doc.setTextColor(...textColor);
        doc.text(lines, margin + 8, y, { maxWidth: contentW - 16 });
        y += lines.length * 5 + 5;
      }

      if (response.correctiveAction) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.8);
        const lines: string[] = doc.splitTextToSize(response.correctiveAction, contentW - 16);
        ensureNonComplianceSpace(lines.length * 5 + 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(21, 101, 52);
        doc.text('Ação corretiva:', margin + 8, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.8);
        doc.setTextColor(...textColor);
        doc.text(lines, margin + 8, y, { maxWidth: contentW - 16 });
        y += lines.length * 5 + 5;
      }

      // Photos
      y = await drawPhotoGrid(response.photos, y);
      y = drawItemLinks(response.links, y);

      y += 6;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 2, margin + contentW, y - 2);
      ncNum++;
    }

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(`Ciente do Plano de Ação: ${inspection.accompanistName || 'Representante do Estabelecimento'}`, margin, y);
  }

  // ── PAGES: EXCELÊNCIA E MELHORIAS ──────────────────────
  const excellenceItems = reportResponses.filter(r =>
    r.result === 'complies' && (r.situationDescription || r.correctiveAction || (r.photos && r.photos.length > 0) || (r.links && r.links.length > 0))
  );

  if (excellenceItems.length > 0) {
    doc.addPage();
    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...secondaryColor);
    doc.text('PONTOS DE EXCELÊNCIA E SUGESTÕES DE MELHORIA', margin, y);
    y += 2;
    doc.setDrawColor(...secondaryColor);
    doc.line(margin, y, margin + contentW, y);
    y += 8;

    let exNum = 1;
    for (const response of excellenceItems) {
      const item = allItems.find(i => i.id === response.itemId);
      if (!item) continue;

      if (y > pageH - 50) { doc.addPage(); y = margin; }

      // EX header
      doc.setFillColor(240, 245, 250);
      doc.rect(margin, y - 4, contentW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`[EX-${String(exNum).padStart(3, '0')}] ${item.description.substring(0, 90)}`, margin + 2, y);
      y += 5;

      if (item.description.length > 90) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const rest = doc.splitTextToSize(item.description.substring(90), contentW - 4);
        doc.text(rest, margin + 2, y);
        y += rest.length * 4;
      }

      if (response.situationDescription) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...secondaryColor);
        doc.text('Destaque / Observação:', margin + 2, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(response.situationDescription, contentW - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 4 + 2;
      }

      if (response.correctiveAction) {
        if (y > pageH - 30) { doc.addPage(); y = margin; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 90, 60);
        doc.text('Sugestão de Alto Padrão:', margin + 2, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(response.correctiveAction, contentW - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 4 + 2;
      }

      // Photos
      y = await drawPhotoGrid(response.photos, y);
      y = drawItemLinks(response.links, y);

      y += 6;
      doc.setDrawColor(220, 230, 240);
      doc.line(margin, y - 2, margin + contentW, y - 2);
      exNum++;
    }
  }

  // ── SIGNATURE + DISCLAIMER ──────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = margin; }
  y += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const disclaimer = 'Este relatório foi elaborado com base nas legislações sanitárias vigentes, durante visita técnica realizada na data indicada. As referências legislativas completas constam na última seção deste documento.';
  const dLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(dLines, margin, y);
  y += dLines.length * 5 + 15;

  // Accomplice Signature
  if (inspection.signatureDataUrl) {
    try {
      doc.addImage(inspection.signatureDataUrl, 'PNG', margin, y - 15, 60, 15);
    } catch { /* skip */ }
  }

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(inspection.accompanistName || '—', margin, y);
  if (inspection.accompanistRole) {
    y += 5;
    doc.text(inspection.accompanistRole, margin, y);
  }

  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + 80, y);
  y += 5;
  reportConsultants.forEach((consultant) => {
    doc.text(consultant.name, margin, y);
    if (consultant.registration) {
      y += 5;
      doc.text(consultant.registration, margin, y);
    }
    y += 5;
  });

  // Add footers
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  // ── SIGNATURE PAGE ─────────────────────────────────────
  if (options.signatureDataUrl) {
    doc.addPage();
    const sigPageW = doc.internal.pageSize.getWidth();
    const sigMargin = 20;

    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, sigPageW, 42, 'F');
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 4, 42, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(17, 24, 39);
    doc.text('ENCERRAMENTO E ASSINATURA', sigMargin + 4, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Declaramos que os dados acima refletem a situação encontrada na data da inspeção.', sigMargin + 4, 34);

    let sigY = 60;
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text('Consultora Responsável:', sigMargin, sigY);
    sigY += 7;
    doc.setFont('helvetica', 'normal');
    reportConsultants.forEach((consultant) => {
      doc.text(consultant.name || '', sigMargin, sigY);
      sigY += 5;
      if (consultant.registration) {
        doc.text(consultant.registration, sigMargin, sigY);
        sigY += 5;
      }
    });
    sigY += 10;

    // Signature image box
    const sigBoxW = 100;
    const sigBoxH = 40;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(sigMargin, sigY, sigBoxW, sigBoxH);
    try {
      doc.addImage(options.signatureDataUrl, 'PNG', sigMargin + 2, sigY + 2, sigBoxW - 4, sigBoxH - 4);
    } catch {
      // Ignore malformed optional signature images and keep generating the PDF.
    }
    sigY += sigBoxH + 4;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Assinatura da Consultora', sigMargin, sigY);
    sigY += 12;

    // Date line
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text(`Data: ${formatDate(inspection.inspectionDate)}`, sigMargin, sigY);
    sigY += 10;

    // Establishment rep signature area
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Representante do Estabelecimento:', sigMargin, sigY);
    sigY += 10;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(sigMargin, sigY, sigMargin + sigBoxW, sigY);
    sigY += 5;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Assinatura / Carimbo', sigMargin, sigY);
  }

  // ── LAST PAGE: REFERÊNCIAS ABNT ─────────────────────────
  drawReferencesABNT(doc, template, responses, legislations, inspection, options.selectedLegislations);

  // ── FONTES CONSULTADAS PELA CONSULTORA ───────────────────
  drawConsultedSources(doc, options.referenceSources);

  // Add footers to ALL pages including new signature/reference pages
  const totalPagesAfter = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPagesAfter; i++) {
    doc.setPage(i);
    addFooter(i, totalPagesAfter);
  }

  const filename = `Inspecao_${(inspection.clientName || 'cliente').replace(/\s+/g, '_')}_${formatDate(inspection.inspectionDate).replace(/\//g, '-')}.pdf`;
  return savePdfWithFallback(doc, filename);
}

/**
 * Gera página de referências legislativas no formato ABNT NBR 6023.
 * Lista apenas as legislações base (sem alíneas/incisos) citadas nos itens avaliados.
 * Se `selectedLegislations` for fornecida (do modal), usa essa lista diretamente.
 */
function drawReferencesABNT(
  doc: jsPDF,
  template: ChecklistTemplate,
  responses: InspectionResponse[],
  allLegislations: any[],
  _inspection: Inspection,
  selectedLegislations?: string[]
) {
  let uniqueRefs: string[];

  if (selectedLegislations && selectedLegislations.length > 0) {
    // Use the pre-selected list from the modal (already deduplicated and cleaned)
    uniqueRefs = [...selectedLegislations].sort();
  } else {
    // Auto-extract from template items using the smart extractor
    const allItems = template.sections.flatMap(s => s.items);
    const itemIds = new Set(allItems.map(item => item.id));
    const latestResponses = getLatestResponsesByItem(responses, itemIds);
    const evaluatedItemIds = new Set(latestResponses.map(r => r.itemId));
    const mentionedSet = new Set<string>();

    allItems.forEach(item => {
      if (!evaluatedItemIds.has(item.id)) return;
      if (!item.legislation) return;
      // Boas práticas não têm base legal vigente — não entram na seção de referências.
      if (item.requirementType === 'good_practice') return;

      // A norma citada no item entra sempre, mesmo sem verbete na biblioteca —
      // formatABNT já cobre esse caso com um texto de referência mínimo.
      // Omitir em silêncio faz o relatório citar uma exigência sem listar sua base legal.
      const bases = extractBaseLegislation(item.legislation);
      bases.forEach(b => mentionedSet.add(b));
    });

    uniqueRefs = Array.from(mentionedSet).sort();
  }

  if (uniqueRefs.length === 0) return;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primaryColor: [number, number, number] = [20, 40, 80];

  doc.addPage();

  // Header
  doc.setFillColor(243, 244, 246);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 4, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text('REFERÊNCIAS LEGISLATIVAS', margin + 4, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Legislações que fundamentam os itens avaliados neste relatório.', margin + 4, 34);

  let y = 58;

  // Render each reference as ABNT formatted entry
  uniqueRefs.forEach((mention, idx) => {
    if (y > pageH - 25) {
      doc.addPage();
      y = margin;
    }

    // REF-02: o casamento com a biblioteca era por substring do nome, o que
    // errava nos dois sentidos — "RDC 15/2012" casava com "RDC 156/2006" e
    // "RDC 502/2021" não casava com "RDC ANVISA nº 502/2021". Agora é pela mesma
    // chave canônica que a biblioteca usa.
    const mentionKey = canonicalLegislationKey(mention);
    const libraryMatch = allLegislations.find(leg => canonicalLegislationKey(leg.name) === mentionKey);

    const abntRef = formatABNT(mention, libraryMatch);

    // Reference number bullet
    doc.setFillColor(30, 107, 94);
    doc.circle(margin + 3, y - 1, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, margin + 3, y + 0.5, { align: 'center' });

    // Reference text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(abntRef, contentW - 14);
    doc.text(lines, margin + 10, y);
    y += lines.length * 5.5 + 5;

    // If has URL in library
    if (libraryMatch?.url) {
      doc.setFontSize(7.5);
      doc.setTextColor(30, 107, 94);
      doc.setFont('helvetica', 'italic');
      const urlLine = `Disponível em: <${libraryMatch.url}>`;
      const urlLines = doc.splitTextToSize(urlLine, contentW - 14);
      doc.text(urlLines, margin + 10, y);
      y += urlLines.length * 4.5 + 3;
    }

    // Separator
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin + 10, y, margin + contentW, y);
    y += 5;
  });

  // Footer note
  if (y < pageH - 25) {
    y = pageH - 18;
  } else {
    if (y > pageH - 18) { doc.addPage(); y = pageH - 18; }
  }
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(156, 163, 175);
  doc.text('Legislações vigentes na data da inspeção.', margin, y);
}

/**
 * Desenha a página "FONTES CONSULTADAS", com links extras anexados pela
 * consultora além das legislações do roteiro. Não gera página se a lista
 * estiver vazia — relatório sem fontes adicionais não ganha seção em branco.
 */
function drawConsultedSources(doc: jsPDF, sources?: ReferenceSource[]) {
  if (!sources || sources.length === 0) return;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primaryColor: [number, number, number] = [20, 40, 80];

  doc.addPage();

  doc.setFillColor(243, 244, 246);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 4, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text('FONTES CONSULTADAS', margin + 4, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Fontes adicionais consultadas pela consultora durante a inspeção.', margin + 4, 34);

  let y = 58;

  sources.forEach((source, idx) => {
    if (y > pageH - 25) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(30, 107, 94);
    doc.circle(margin + 3, y - 1, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, margin + 3, y + 0.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    const titleLines = doc.splitTextToSize(source.title || source.url, contentW - 14);
    doc.text(titleLines, margin + 10, y);
    y += titleLines.length * 5.5 + 4;

    // O PDF costuma ser impresso — o link precisa ficar legível no papel,
    // não só clicável.
    doc.setFontSize(7.5);
    doc.setTextColor(30, 107, 94);
    doc.setFont('helvetica', 'italic');
    const urlLines = doc.splitTextToSize(`Disponível em: <${source.url}>`, contentW - 14);
    doc.text(urlLines, margin + 10, y);
    y += urlLines.length * 4.5 + 3;

    if (source.note) {
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(source.note, contentW - 14);
      doc.text(noteLines, margin + 10, y);
      y += noteLines.length * 4.5 + 3;
    }

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin + 10, y, margin + contentW, y);
    y += 5;
  });
}

/**
 * Formata uma citação legislativa no padrão ABNT NBR 6023.
 */
function formatABNT(mention: string, libraryEntry?: any): string {
  const m = mention.trim();
  const summary = libraryEntry?.summary || '';

  // RDC ANVISA
  if (/RDC\s*(?:ANVISA\s*)?n?[oº]?\s*(\d+)/i.test(m)) {
    const match = m.match(/RDC\s*(?:ANVISA\s*)?n?[oº]?\s*(\d+)[\s,/]*(\d{4})?/i);
    const num = match?.[1] || '';
    const year = match?.[2] || '';
    const yearStr = year ? `, de ${year}` : '';
    const baseText = `BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA). Resolução da Diretoria Colegiada – RDC n. ${num}${yearStr}.`;
    return summary ? `${baseText} ${summary}.` : `${baseText} Brasília: ANVISA.`;
  }

  // Portaria
  if (/Portaria/i.test(m)) {
    const match = m.match(/Portaria\s+(?:(?:GM|SVS|MS|CVS)[\s/]*(?:MS|MS)?)?n?[oº]?\s*([\d.]+)[\s,/]*(\d{4})?/i);
    const num = match?.[1] || '';
    const year = match?.[2] || '';
    const yearStr = year ? `, de ${year}` : '';
    const org = /CVS/i.test(m) ? 'São Paulo. Centro de Vigilância Sanitária (CVS). Portaria CVS'
      : 'BRASIL. Ministério da Saúde. Portaria';
    const baseText = `${org} n. ${num}${yearStr}.`;
    return summary ? `${baseText} ${summary}.` : `${baseText}`;
  }

  // Lei Federal
  if (/Lei\s+Federal/i.test(m) || /Lei\s+n[oº.]/i.test(m)) {
    const match = m.match(/Lei\s+(?:Federal\s+)?n?[oº.]?\s*([\d.]+)[\s,/]*(\d{4})?/i);
    const num = match?.[1] || '';
    const year = match?.[2] || '';
    const yearStr = year ? `, de ${year}` : '';
    const baseText = `BRASIL. Lei n. ${num}${yearStr}.`;
    return summary ? `${baseText} ${summary}.` : `${baseText} Brasília: Presidência da República.`;
  }

  // Lei Estadual (ex: Lei 8.049/2018)
  if (/Lei\s+[\d.]+[/](\d{4})/i.test(m)) {
    const match = m.match(/Lei\s+([\d.]+)[/](\d{4})/i);
    const num = match?.[1] || '';
    const year = match?.[2] || '';
    const isRJ = m.includes('8049') || m.includes('8.049');
    const state = isRJ ? 'RIO DE JANEIRO (Estado)' : 'BRASIL';
    const baseText = `${state}. Lei n. ${num}, de ${year}.`;
    return summary ? `${baseText} ${summary}.` : `${baseText}`;
  }

  // NR (Norma Regulamentadora)
  if (/^NR[\s-]?(\d+)/i.test(m)) {
    const match = m.match(/^NR[\s-]?(\d+)/i);
    const num = match?.[1] || '';
    const baseText = `BRASIL. Ministério do Trabalho e Emprego. Norma Regulamentadora n. ${num} (NR-${num}).`;
    return summary ? `${baseText} ${summary}.` : `${baseText}`;
  }

  // ABNT
  if (/ABNT|NBR/i.test(m)) {
    const match = m.match(/(?:ABNT\s*)?NBR\s*([\d]+)/i);
    const num = match?.[1] || '';
    const baseText = `ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. ABNT NBR ${num}.`;
    return summary ? `${baseText} ${summary}.` : `${baseText} Rio de Janeiro: ABNT.`;
  }

  // Nota Técnica
  if (/Nota\s+Técnica/i.test(m)) {
    const baseText = `BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA). ${m}.`;
    return summary ? `${baseText} ${summary}.` : `${baseText}`;
  }

  // Generic fallback
  const baseText = `BRASIL. ${m}.`;
  return summary ? `${baseText} ${summary}.` : baseText;
}
