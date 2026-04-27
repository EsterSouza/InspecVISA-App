import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inspection, InspectionResponse, ChecklistTemplate, InspectionScore, ConsultantSettings, FoodEstablishmentType } from '../types';
import { FOOD_SEGMENT_LABELS } from '../types';
import { classificationLabel, classificationColor } from './scoring';
import { formatDate } from './imageUtils';
import { enrichTemplate } from '../data/templates';

/**
 * Extrai apenas a legislação BASE de um texto bruto de legislação,
 * descartando sub-referências como alíneas, incisos, artigos e parágrafos.
 * Ex: "RDC 216/2004, alínea a, b" → "RDC 216/2004"
 *     "Portaria 2619/2011; art. 5º, inciso I" → "Portaria 2619/2011"
 */
export function extractBaseLegislation(raw: string): string[] {
  const bases = new Set<string>();

  // Split by semicolons first (hard separators between laws)
  const bySemicolon = raw.split(';');

  for (const segment of bySemicolon) {
    const s = segment.trim();
    if (!s) continue;

    // Patterns that identify a legislation base — capture up to date/number only
    const patterns = [
      // RDC / IN / RE / RN + number + optional year
      /\b(?:RDC|IN|RE|RN|RT)\s*(?:ANVISA\s*)?(?:n[oº.]?\s*)?(\d+)(?:[/\-]\d{4})?/i,
      // Portaria + number + optional year
      /\bPortaria\s+(?:(?:GM|SVS|MS|CVS|SES|SMS)[/\s]*)?(?:n[oº.]?\s*)?(\d[\d.]*(?:[/\-]\d{4})?)/i,
      // Lei Federal/Estadual
      /\bLei\s+(?:Federal\s+|Estadual\s+|Complementar\s+)?(?:n[oº.]?\s*)?([\d.]+(?:[/\-]\d{4})?)/i,
      // Decreto
      /\bDecreto(?:-Lei)?\s+(?:n[oº.]?\s*)?([\d.]+(?:[/\-]\d{4})?)/i,
      // NR (Norma Regulamentadora)
      /\bNR[.\s-]?(\d+)/i,
      // ABNT NBR
      /\bABNT\s+NBR\s+(\d+)/i,
      // Instrução Normativa
      /\bInstru[cç][aã]o\s+Normativa\s+(?:n[oº.]?\s*)?(\d+(?:[/\-]\d{4})?)/i,
      // Nota Técnica
      /\bNota\s+T[eé]cnica\b[^;,]*/i,
      // Resolução genérica
      /\bResolu[cç][aã]o\s+(?:n[oº.]?\s*)?([\d.]+(?:[/\-]\d{4})?)/i,
    ];

    let matched = false;
    for (const pattern of patterns) {
      const m = s.match(pattern);
      if (m) {
        // Reconstruct a clean base from the full match (before any comma/alínea)
        const fullMatch = m[0].trim();
        // Remove trailing sub-clause indicators
        const clean = fullMatch
          .replace(/[,\s]+(al[íi]nea|inciso|artigo|art\.|§|parágrafo|item|subitem|cap[íi]tulo).*/i, '')
          .trim();
        if (clean) bases.add(clean);
        matched = true;
        break;
      }
    }

    // If no pattern matched, keep the original segment (but strip alíneas from it)
    if (!matched && s.length > 3) {
      const clean = s
        .replace(/[,\s]+(al[íi]nea|inciso|artigo|art\.|§|parágrafo|item|subitem).*/i, '')
        .trim();
      if (clean) bases.add(clean);
    }
  }

  return Array.from(bases);
}

export async function generatePDF(
  inspection: Inspection,
  responses: InspectionResponse[],
  template: ChecklistTemplate,
  score: InspectionScore,
  settings: ConsultantSettings,
  legislations: any[] = [],
  options: { selectedLegislations?: string[]; signatureDataUrl?: string } = {}
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primaryColor: [number, number, number] = [20, 40, 80]; // Navy Blue 
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
  drawField('Localização:', `${inspection.city || '—'} / ${inspection.state || '—'}`);
  drawField('Data da Visita:', formatDate(inspection.inspectionDate));
  drawField('Consultora:', inspection.consultantName);

  if (inspection.clientCategory === 'alimentos' && inspection.foodTypes && inspection.foodTypes.length > 0) {
    const segments = inspection.foodTypes.map(ft => FOOD_SEGMENT_LABELS[ft] || ft).join(', ');
    drawField('Segmentos:', segments);
  }

  if (inspection.accompanistName) {
    drawField('Acompanhante:', `${inspection.accompanistName} ${inspection.accompanistRole ? `(${inspection.accompanistRole})` : ''}`);
  }

  if (settings.professionalId) {
    drawField(`${settings.professionalIdLabel || 'Registro'}:`, settings.professionalId);
  }

  // ILPI Extra Information
  if (inspection.ilpiCapacity || inspection.residentsTotal) {
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
    const isRJ = (inspection as any).state === 'RJ';

    // RDC 502/2021 (federal): Grau I 1:20, Grau II 1:10, Grau III 1:6
    const reqFederal = Math.ceil(l1 / 20 + l2 / 10 + l3 / 6);
    // Lei 8.049/2018 (RJ específico): Grau I 1:20, Grau II 1:8, Grau III 1:5
    const reqRJ = isRJ ? Math.ceil(l1 / 20 + l2 / 8 + l3 / 5) : 0;
    const maxReq = isRJ ? Math.max(reqFederal, reqRJ) : reqFederal;

    const observed = (inspection as any).observedStaff || 0;
    const isCompliant = observed >= maxReq;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (isCompliant) {
      doc.setTextColor(30, 90, 60);
    } else {
      doc.setTextColor(180, 40, 40);
    }
    doc.text(`DIMENSIONAMENTO: ${observed} COLABORADORES EM TURNO (MÍNIMO EXIGIDO: ${maxReq})`, margin, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    y += 4;

    const baseLegal = isRJ
      ? 'Base legal: RDC 502/2021 e Lei 8.049/2018 (RJ)'
      : 'Base legal: RDC 502/2021';
    doc.text(`${baseLegal}. Status: ${isCompliant ? 'ADEQUADO' : 'INSUFICIENTE'}`, margin, y);

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

  // Score Box
  doc.setFillColor(...(rgb as [number, number, number]));
  doc.roundedRect(margin, y, contentW, 35, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(`${scorePercent}%`, margin + contentW / 2, y + 16, { align: 'center' });
  doc.setFontSize(10);
  doc.text('ADEQUAÇÃO SANITÁRIA GERAL', margin + contentW / 2, y + 24, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${score.evaluatedItems} de ${score.totalItems} itens avaliados nesta visita`, margin + contentW / 2, y + 30, { align: 'center' });

  y += 42;
  // Progress Bar under score box
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, y, contentW, 3, 1.5, 1.5, 'F');
  doc.setFillColor(...(rgb as [number, number, number]));
  doc.roundedRect(margin, y, (contentW * scorePercent) / 100, 3, 1.5, 1.5, 'F');
  y += 10;


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
    headStyles: { fillColor: primaryColor, fontSize: 9, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9, textColor: [30, 30, 30] },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 } },
    margin: { left: margin, right: margin },
    theme: 'striped',
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // ── NEW PAGE: PLANO DE AÇÃO RECOMENDADO ──────────────────
  doc.addPage();
  y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('PLANO DE AÇÃO RECOMENDADO', margin, y);
  y += 8;

  const allItemsList = template.sections.flatMap(s => s.items);
  const nonCompliantItems = responses.filter(r => r.result === 'not_complies');

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

  const drawActionTable = (title: string, items: any[], rowColor: [number, number, number], defaultDeadline: string) => {
    if (y > pageH - 60) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(title.toUpperCase(), margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Nº', 'Descrição da Ação (O que resolver)', 'Prazo', 'Responsável']],
      body: items.map((r, idx) => {
        const it = allItemsList.find(i => i.id === r.itemId);
        const actionDesc = [
          r.situationDescription ? `SITUAÇÃO: ${r.situationDescription}` : '',
          r.correctiveAction ? `AÇÃO: ${r.correctiveAction}` : '',
          `(${it?.description || r.customDescription || ''})`
        ].filter(Boolean).join('\n');

        return [
          idx + 1,
          actionDesc,
          r.deadline || defaultDeadline,
          r.responsible || 'RT / Gestor'
        ];
      }),
      headStyles: { fillColor: rgb as [number, number, number], fontSize: 8 },
      bodyStyles: { fontSize: 8, fillColor: rowColor as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 120 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 }
      },
      margin: { left: margin, right: margin },
      theme: 'grid'
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  if (urgentItems.length > 0) {
    drawActionTable('GRUPO 1 — AÇÕES URGENTES (ITENS CRÍTICOS)', urgentItems, [254, 242, 242], '15 dias');
  }

  if (importantItems.length > 0) {
    drawActionTable('GRUPO 2 — AÇÕES IMPORTANTES (NECESSÁRIO)', importantItems, [255, 251, 235], '60 dias');
  }

  // Summary of Conformance
  if (y > pageH - 40) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 197, 94);
  doc.text('GRUPO 3 — ITENS EM CONFORMIDADE', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`${score.compliesCount} itens foram verificados e encontram-se em conformidade na data desta inspeção.`, margin, y);
  y += 15;

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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text('NÃO CONFORMIDADES IDENTIFICADAS', margin, y);
    y += 2;
    doc.setDrawColor(...primaryColor);
    doc.line(margin, y, margin + contentW, y);
    y += 8;

    let ncNum = 1;
    for (const response of nonCompliantItems) {
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
        // Show only citation abbreviation inline, full reference is in appendix
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
      if (response.photos && response.photos.length > 0) {
        if (y > pageH - 60) { doc.addPage(); y = margin; }
        const maxImgW = (contentW - 5) / 2;
        const maxImgH = maxImgW * 0.75;
        let col = 0;
        let currentRowMaxH = 0;

        for (const photo of response.photos || []) {
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

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(`Ciente do Plano de Ação: ${inspection.accompanistName || 'Representante do Estabelecimento'}`, margin, y);
  }

  // ── PAGES: EXCELÊNCIA E MELHORIAS ──────────────────────
  const excellenceItems = responses.filter(r =>
    r.result === 'complies' && (r.situationDescription || r.correctiveAction || (r.photos && r.photos.length > 0))
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
      if (response.photos && response.photos.length > 0) {
        if (y > pageH - 60) { doc.addPage(); y = margin; }
        const maxImgW = (contentW - 5) / 2;
        const maxImgH = maxImgW * 0.75;
        let col = 0;
        let currentRowMaxH = 0;

        for (const photo of response.photos || []) {
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
    } catch (_) { /* skip */ }
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

  // ── SIGNATURE PAGE ─────────────────────────────────────
  if (options.signatureDataUrl) {
    doc.addPage();
    const sigPageW = doc.internal.pageSize.getWidth();
    const sigPageH = doc.internal.pageSize.getHeight();
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
    doc.text(inspection.consultantName || '', sigMargin, sigY);
    sigY += 5;
    if (settings.professionalId) {
      doc.text(`${settings.professionalIdLabel || 'Registro'}: ${settings.professionalId}`, sigMargin, sigY);
      sigY += 5;
    }
    sigY += 10;

    // Signature image box
    const sigBoxW = 100;
    const sigBoxH = 40;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(sigMargin, sigY, sigBoxW, sigBoxH);
    try {
      doc.addImage(options.signatureDataUrl, 'PNG', sigMargin + 2, sigY + 2, sigBoxW - 4, sigBoxH - 4);
    } catch (_) {}
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

  // Add footers to ALL pages including new signature/reference pages
  const totalPagesAfter = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPagesAfter; i++) {
    doc.setPage(i);
    addFooter(i, totalPagesAfter);
  }

  const filename = `Inspecao_${(inspection.clientName || 'cliente').replace(/\s+/g, '_')}_${formatDate(inspection.inspectionDate).replace(/\//g, '-')}.pdf`;
  doc.save(filename);
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
    const evaluatedItemIds = new Set(responses.map(r => r.itemId));
    const allItems = template.sections.flatMap(s => s.items);
    const mentionedSet = new Set<string>();

    allItems.forEach(item => {
      if (!evaluatedItemIds.has(item.id)) return;
      if (!item.legislation) return;
      
      // SANITIZATION: Check if the legislation is present in library and has summary
      const bases = extractBaseLegislation(item.legislation);
      bases.forEach(b => {
        const libEntry = allLegislations.find(l => 
          l.name.toUpperCase().includes(b.toUpperCase()) || 
          b.toUpperCase().includes(l.name.toUpperCase())
        );
        // Only include if it has a valid title (name) and summary (description) in library
        if (libEntry && libEntry.name && libEntry.summary) {
          mentionedSet.add(b);
        }
      });
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

    // Try to find in the library for enriched info
    const libraryMatch = allLegislations.find(leg => {
      const legUpper = leg.name.toUpperCase();
      const mentionUpper = mention.toUpperCase();
      return legUpper.includes(mentionUpper) || mentionUpper.includes(legUpper);
    });

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
  if (/Lei\s+Federal/i.test(m) || /Lei\s+n[oº\.]/i.test(m)) {
    const match = m.match(/Lei\s+(?:Federal\s+)?n?[oº\.]?\s*([\d.]+)[\s,/]*(\d{4})?/i);
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
