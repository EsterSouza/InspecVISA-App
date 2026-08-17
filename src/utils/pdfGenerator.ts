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
import { extractBaseLegislation, canonicalLegislationKey, citedLegislations } from './legislationRefs';
import type { ClientDeclarationForItem, ClientEvidenceForItem } from '../services/clientEvidenceService';


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

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trimEnd()}...`;
}

/**
 * Rótulo legível para um endereço anexado pela consultora. Links de busca chegam
 * com centenas de caracteres de rastreamento (`sca_esv`, `sxsrf`, `ved`...) e,
 * impressos crus, ocupavam meia página sem dizer nada. O rótulo vai no texto
 * clicável; `hint` é a dica curta de origem, para quem lê no papel.
 */
export function describeUrl(raw: string): { label: string; hint: string } {
  const url = (raw || '').trim();
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!parsed) return { label: truncate(url, 90), hint: '' };

  const host = parsed.hostname.replace(/^www\./i, '');
  const term = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';
  const engine = host.match(/^(google|bing|duckduckgo|yahoo)\b/i)?.[1];
  if (engine && term) {
    const engineName = engine.charAt(0).toUpperCase() + engine.slice(1).toLowerCase();
    return { label: `Busca no ${engineName}: "${truncate(term.replace(/\+/g, ' '), 68)}"`, hint: host };
  }

  let path = parsed.pathname;
  try {
    path = decodeURIComponent(path);
  } catch { /* mantém o caminho como veio */ }
  path = path.replace(/\/+$/, '');
  const withoutScheme = url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  // Endereço curto cabe inteiro; o resto vira host + caminho, sem a query.
  if (withoutScheme.length <= 85) return { label: withoutScheme, hint: '' };
  return { label: truncate(`${host}${path}`, 85), hint: host };
}

/** Escreve um texto clicável e sublinhado, e devolve a largura usada. */
function drawUrlLink(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  url: string,
  color: [number, number, number]
) {
  doc.setTextColor(...color);
  doc.textWithLink(text, x, y, { url });
  const width = doc.getTextWidth(text);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.15);
  doc.line(x, y + 0.9, x + width, y + 0.9);
  return width;
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
  options: {
    selectedLegislations?: string[];
    referenceSources?: ReferenceSource[];
    signatureDataUrl?: string;
    /** Link público (sem login) desta visita no portal — some se não houver solicitação vinculada. */
    portalUrl?: string;
    recurringItemIds?: Set<string>;
    /** REL-03 — o que o cliente alegou ter corrigido, por item do roteiro. */
    clientEvidenceByItemId?: Map<string, ClientEvidenceForItem[]>;
    /** PORT-03 — a situação que o cliente declarou, inclusive "ainda não fiz" com o motivo. */
    clientDeclarationByItemId?: Map<string, ClientDeclarationForItem>;
  } = {}
): Promise<GeneratedPdfFile> {
  const recurringItemIds = options.recurringItemIds ?? new Set<string>();
  const clientEvidenceByItemId = options.clientEvidenceByItemId ?? new Map<string, ClientEvidenceForItem[]>();
  const clientDeclarationByItemId = options.clientDeclarationByItemId ?? new Map<string, ClientDeclarationForItem>();
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

  // ── Fluxo dos itens (NC / excelência) ────────────────────
  // Todo conteúdo de item passa por estes helpers. Antes, cada bloco era
  // entregue inteiro a doc.text(): um texto mais alto que a página atravessava
  // o rodapé e as linhas seguintes eram perdidas.
  const flowBottom = pageH - 22;   // última linha possível antes do rodapé
  const bodyX = margin + 7;        // eixo de texto dos itens
  const bodyW = contentW - 14;

  type FlowStyle = {
    size?: number;
    font?: 'normal' | 'bold' | 'italic';
    color?: [number, number, number];
    lineH?: number;
    x?: number;
    width?: number;
  };

  /** Abre a página seguinte para continuar o item em curso e devolve o novo y. */
  type ContinueFlow = () => number;

  const continueOnBlankPage: ContinueFlow = () => {
    doc.addPage();
    return margin;
  };

  function applyFlowStyle(style: FlowStyle) {
    doc.setFont('helvetica', style.font || 'normal');
    doc.setFontSize(style.size ?? 9.8);
    doc.setTextColor(...(style.color || textColor));
  }

  function drawFlowText(
    text: string,
    startY: number,
    style: FlowStyle = {},
    onContinue: ContinueFlow = continueOnBlankPage
  ) {
    applyFlowStyle(style);
    const lineH = style.lineH ?? 5;
    const lines: string[] = doc.splitTextToSize(text, style.width ?? bodyW);
    let cursor = startY;
    for (const line of lines) {
      if (cursor + lineH > flowBottom) {
        cursor = onContinue();
        applyFlowStyle(style);
      }
      doc.text(line, style.x ?? bodyX, cursor);
      cursor += lineH;
    }
    return cursor;
  }

  /** Rótulo + corpo, com o rótulo sempre na mesma página da primeira linha. */
  function drawLabeledBlock(
    label: string,
    text: string,
    startY: number,
    labelColor: [number, number, number],
    onContinue: ContinueFlow = continueOnBlankPage
  ) {
    let cursor = startY;
    if (cursor + 10.5 > flowBottom) cursor = onContinue();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(...labelColor);
    doc.text(label, bodyX, cursor);
    cursor += 5.2;
    cursor = drawFlowText(text, cursor, { size: 9.8, lineH: 5 }, onContinue);
    return cursor + 3.5;
  }

  /**
   * Cabeçalho do item: código, selos, pergunta do roteiro e base legal na mesma
   * caixa. A caixa é medida a partir do texto, então não sobra área vazia nem
   * o título escapa da borda.
   */
  function drawItemHeader(opts: {
    code: string;
    title: string;
    accent: [number, number, number];
    tags?: { text: string; fill: [number, number, number] }[];
    legal?: string;
    startY: number;
    onContinue?: ContinueFlow;
  }) {
    const { code, title, accent, tags = [], legal, startY } = opts;
    const padX = 7;
    const padTop = 6;
    const padBottom = 4.4;
    const metaH = 6.4;      // do código à primeira linha do título
    const titleLineH = 5.2;
    const legalGap = 4.6;
    const legalLineH = 4.2;
    const innerW = contentW - padX * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.4);
    const titleLines: string[] = doc.splitTextToSize(title, innerW);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.2);
    const legalLines: string[] = legal ? doc.splitTextToSize(legal, innerW) : [];

    const boxH = padTop + metaH + (titleLines.length - 1) * titleLineH
      + (legalLines.length ? legalGap + (legalLines.length - 1) * legalLineH : 0)
      + padBottom;

    // O cabeçalho não se divide e não fica órfão: só é desenhado se couber
    // junto com o rótulo e as duas primeiras linhas do corpo.
    let boxY = startY;
    if (boxY + boxH + 24 > flowBottom) boxY = (opts.onContinue || continueOnBlankPage)();

    doc.setFillColor(...surfaceColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, boxY, contentW, boxH, 2, 2, 'FD');
    doc.setFillColor(...accent);
    doc.roundedRect(margin, boxY, 2.6, boxH, 1.3, 1.3, 'F');

    const metaBase = boxY + padTop;
    let metaX = margin + padX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...accent);
    doc.text(code, metaX, metaBase);
    metaX += doc.getTextWidth(code) + 3.5;
    tags.forEach((tag) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      const tagW = doc.getTextWidth(tag.text) + 5;
      doc.setFillColor(...tag.fill);
      doc.roundedRect(metaX, metaBase - 3.6, tagW, 5, 1.6, 1.6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(tag.text, metaX + 2.5, metaBase - 0.2);
      metaX += tagW + 2.5;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.4);
    doc.setTextColor(...textColor);
    let lineY = metaBase + metaH;
    titleLines.forEach((line) => {
      doc.text(line, margin + padX, lineY);
      lineY += titleLineH;
    });

    if (legalLines.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.2);
      doc.setTextColor(...mutedColor);
      let legalY = lineY - titleLineH + legalGap;
      legalLines.forEach((line) => {
        doc.text(line, margin + padX, legalY);
        legalY += legalLineH;
      });
    }

    return boxY + boxH + 5.5;
  }

  async function drawPhotoGrid(
    photos: InspectionResponse['photos'],
    startY: number,
    onContinue: ContinueFlow = continueOnBlankPage
  ) {
    const usable = (photos || []).filter((photo) => {
      if (isLocalReportImage(photo.dataUrl)) return true;
      console.warn('[PDF] Skipping unavailable local photo', photo.id);
      return false;
    });
    if (usable.length === 0) return startY;

    // Mede antes de desenhar: a célula tem tamanho fixo e a foto é centralizada
    // dentro dela, então linhas com retrato e paisagem ficam alinhadas.
    const measured: { photo: NonNullable<InspectionResponse['photos']>[number]; width: number; height: number }[] = [];
    for (const photo of usable) {
      const size = await loadImageSize(photo.dataUrl);
      if (!size || size.width <= 0 || size.height <= 0) {
        console.warn('[PDF] Skipping unreadable photo', photo.id);
        continue;
      }
      measured.push({ photo, width: size.width, height: size.height });
    }
    if (measured.length === 0) return startY;

    const gutter = 6;
    const cellW = (bodyW - gutter) / 2;
    const cellH = 54;
    const captionH = 4.8;

    let cursor = startY + 0.5;
    if (cursor + 12 > flowBottom) cursor = onContinue();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(...mutedColor);
    doc.text('Registro fotográfico', bodyX, cursor);
    cursor += 5;

    for (let i = 0; i < measured.length; i += 2) {
      const row = measured.slice(i, i + 2);
      const rowH = cellH + (row.some(entry => entry.photo.caption) ? captionH : 0);
      if (cursor + rowH > flowBottom) cursor = onContinue();

      row.forEach((entry, col) => {
        const cellX = bodyX + col * (cellW + gutter);
        doc.setFillColor(...surfaceColor);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.2);
        doc.roundedRect(cellX, cursor, cellW, cellH, 1.5, 1.5, 'FD');

        const scale = Math.min((cellW - 3) / entry.width, (cellH - 3) / entry.height);
        const drawW = entry.width * scale;
        const drawH = entry.height * scale;
        try {
          doc.addImage(
            entry.photo.dataUrl,
            getPdfImageFormat(entry.photo.dataUrl) as any,
            cellX + (cellW - drawW) / 2,
            cursor + (cellH - drawH) / 2,
            drawW,
            drawH
          );
        } catch (err) {
          console.warn('[PDF] Failed to add photo, skipping', entry.photo.id, err);
        }

        if (entry.photo.caption) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(...mutedColor);
          const caption: string = doc.splitTextToSize(entry.photo.caption, cellW)[0];
          doc.text(caption, cellX, cursor + cellH + 3.4);
        }
      });

      cursor += rowH + gutter;
    }
    return cursor;
  }

  /**
   * REL-03 — o que o cliente alegou ter corrigido neste requisito, entre uma visita e outra.
   *
   * Regra decidida pela Ester: **registro textual sempre, imagem só do que ela aprovou.** O
   * texto é o que sustenta o laudo — quem assinou, quando, o que disse ter feito e qual foi a
   * decisão técnica. A figura entra apenas para a prova aceita, senão o relatório de ILPI, que
   * já é pesado com as fotos da consultora, dobraria de tamanho carregando arquivo recusado.
   *
   * Nada disto conclui pendência: a conclusão é o resultado desta vistoria, marcado item a item.
   */
  /**
   * PORT-03 — o que o cliente declarou, inclusive quando NÃO fez.
   *
   * Vem antes da evidência de propósito: é a versão dele dos fatos, e o motivo do "ainda não
   * fiz" costuma ser o dado mais útil do relatório para a visita seguinte.
   */
  function drawClientDeclaration(
    declaration: ClientDeclarationForItem | undefined,
    startY: number,
    onContinue: ContinueFlow = continueOnBlankPage
  ) {
    if (!declaration) return startY;

    const rotulo: Record<ClientDeclarationForItem['status'], string> = {
      done: 'já corrigiu',
      in_progress: 'está providenciando',
      not_done: 'ainda não fez',
    };
    const quando = declaration.at ? new Date(declaration.at).toLocaleDateString('pt-BR') : 'sem data';
    const quem = declaration.byName
      ? `${declaration.byName}${declaration.byRole ? ` (${declaration.byRole})` : ''}`
      : 'não identificado';

    const partes = [`${quando} — ${quem} declarou que ${rotulo[declaration.status]}.`];
    if (declaration.note) partes.push(declaration.note);

    return drawLabeledBlock(
      'Resposta do estabelecimento',
      partes.join(' '),
      startY,
      declaration.status === 'not_done' ? [154, 52, 18] : [7, 89, 133],
      onContinue
    );
  }

  async function drawClientEvidence(
    evidence: ClientEvidenceForItem[] | undefined,
    startY: number,
    onContinue: ContinueFlow = continueOnBlankPage
  ) {
    if (!evidence || evidence.length === 0) return startY;

    const statusLabel: Record<ClientEvidenceForItem['status'], string> = {
      pending: 'recebida, sem revisão técnica',
      approved: 'aprovada pela consultoria',
      changes_requested: 'devolvida para ajuste',
    };

    const linhas = evidence.map((row) => {
      const quando = new Date(row.submittedAt).toLocaleDateString('pt-BR');
      const quem = row.byName
        ? `${row.byName}${row.byRole ? ` (${row.byRole})` : ''}`
        : 'não identificado';
      const partes = [`${quando} — ${quem} — ${statusLabel[row.status]}.`];
      if (row.clientNote) partes.push(`Alegação: ${row.clientNote}`);
      if (row.reviewNote) partes.push(`Parecer da consultoria: ${row.reviewNote}`);
      partes.push(`Arquivo: ${row.fileName}`);
      return partes.join(' ');
    });

    let cursor = drawLabeledBlock(
      'Evidência apresentada pelo cliente',
      linhas.join('\n'),
      startY,
      [7, 89, 133],
      onContinue
    );

    // Só imagem aprovada vira figura. `drawPhotoGrid` já pula o que não for data URL local.
    const aprovadas = evidence
      .filter((row) => row.status === 'approved' && row.imageDataUrl)
      .map((row) => ({
        id: row.evidenceId,
        responseId: '',
        dataUrl: row.imageDataUrl as string,
        caption: `Evidência do cliente — ${row.byName || 'sem assinatura'} · ${new Date(row.submittedAt).toLocaleDateString('pt-BR')}`,
        createdAt: new Date(row.submittedAt),
      })) as unknown as InspectionResponse['photos'];

    cursor = await drawPhotoGrid(aprovadas, cursor, onContinue);
    return cursor;
  }

  // Links anexados pelo consultor a este item durante a inspeção (não confundir
  // com as fontes gerais da inspeção, em drawConsultedSources).
  function drawItemLinks(
    links: string[] | undefined,
    startY: number,
    onContinue: ContinueFlow = continueOnBlankPage
  ) {
    const list = (links || []).map(link => (link || '').trim()).filter(Boolean);
    if (list.length === 0) return startY;

    let cursor = startY + 0.5;
    if (cursor + 12 > flowBottom) cursor = onContinue();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(...mutedColor);
    doc.text('Fontes consultadas neste item', bodyX, cursor);
    cursor += 5;

    list.forEach((link) => {
      const { label, hint } = describeUrl(link);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      const lines: string[] = doc.splitTextToSize(label, bodyW - 6);
      const blockH = lines.length * 4.5 + (hint ? 4 : 0);
      if (cursor + blockH > flowBottom) cursor = onContinue();

      doc.setFillColor(...secondaryColor);
      doc.circle(bodyX + 1, cursor - 1.2, 0.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      lines.forEach((line, idx) => {
        drawUrlLink(doc, line, bodyX + 5, cursor + idx * 4.5, link, secondaryColor);
      });
      cursor += lines.length * 4.5;

      if (hint) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.4);
        doc.setTextColor(...mutedColor);
        doc.text(hint, bodyX + 5, cursor + 0.6);
        cursor += 4;
      }
      cursor += 1.6;
    });

    return cursor + 2;
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

  // Botão do portal, na barra do cabeçalho (área fixa, imune à altura variável
  // do conteúdo abaixo). Só aparece se a inspeção estiver vinculada a uma
  // solicitação — sem isso não existe link público para levar.
  if (options.portalUrl) {
    const btnLabel = 'Ver relatório e plano de ação no portal';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const btnW = doc.getTextWidth(btnLabel) + 8;
    const btnY = 33;
    const btnH = 6;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, btnY, btnW, btnH, 1.5, 1.5, 'F');
    doc.setTextColor(...primaryColor);
    doc.text(btnLabel, margin + 4, btnY + 4.2);
    doc.link(margin, btnY, btnW, btnH, { url: options.portalUrl });
  }

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
        // Uma linha por vez, com a mesma entrelinha usada para medir o card:
        // passar o bloco inteiro com maxWidth deixava o jsPDF usar a entrelinha
        // dele (menor), então o texto ficava comprimido e sobrava vão no fim.
        const lineHeight = isRequirement ? requirementLineHeight : bodyLineHeight;
        lines.forEach((line, lineIdx) => {
          doc.text(line, cardInnerX, blockY + lineIdx * lineHeight);
        });
        return blockY + lines.length * lineHeight + 5;
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

  // Relação integral do que está cumprido. A tabela acima só dá o percentual por
  // área; o cliente precisa enxergar QUAIS exigências já atendeu — sem isso, o
  // relatório só mostra o que falta. Itens conformes com observação/foto seguem
  // detalhados em "Pontos de Excelência", mais adiante.
  const compliantItemIds = new Set(
    reportResponses.filter(r => r.result === 'complies').map(r => r.itemId)
  );

  if (compliantItemIds.size > 0) {
    if (y > pageH - 60) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text('RELAÇÃO DOS ITENS CUMPRIDOS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedColor);
    const compliantSubtitle = recurringItemIds.size > 0
      ? 'Exigências verificadas em campo e atendidas pelo estabelecimento. "Regularizado" marca o item que estava em não conformidade em visita anterior.'
      : 'Exigências verificadas em campo e atendidas pelo estabelecimento.';
    const compliantSubtitleLines = doc.splitTextToSize(compliantSubtitle, contentW);
    doc.text(compliantSubtitleLines, margin, y);
    y += compliantSubtitleLines.length * 4.2 + 4;

    let compliantNum = 1;
    template.sections.forEach(section => {
      const rows = section.items
        .filter(item => compliantItemIds.has(item.id))
        .map(item => {
          const basis = item.requirementType === 'good_practice'
            ? 'Boa prática'
            : (extractBaseLegislation(item.legislation || '').join('; ') || item.legislation || '—');
          // Estava em NC numa visita anterior deste cliente e agora está cumprido.
          const status = recurringItemIds.has(item.id) ? 'Regularizado' : '';
          return [`C-${String(compliantNum++).padStart(3, '0')}`, item.description, basis, status];
        });
      if (rows.length === 0) return;

      const segment = section.segmentKey
        ? (FOOD_SEGMENT_LABELS[section.segmentKey as FoodEstablishmentType] || section.segmentKey)
        : '';
      const sectionTitle = section.isExtraSection ? `${section.title} (${segment})` : section.title;

      if (y > pageH - 40) { doc.addPage(); y = margin; }
      autoTable(doc, {
        startY: y,
        head: [[{ content: `${sectionTitle} — ${rows.length} item(ns) em conformidade`, colSpan: 4 }]],
        body: rows,
        headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontSize: 8.5, fontStyle: 'bold', cellPadding: 2.3 },
        bodyStyles: { fontSize: 8.5, textColor, cellPadding: 2.2, valign: 'top' },
        alternateRowStyles: { fillColor: surfaceColor },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center', textColor: mutedColor },
          1: { cellWidth: 97 },
          2: { cellWidth: 34, fontSize: 7.5, textColor: mutedColor },
          3: { cellWidth: 24, fontSize: 7.5, fontStyle: 'bold', textColor: [22, 101, 52] },
        },
        margin: { left: margin, right: margin, top: margin, bottom: 22 },
        theme: 'plain',
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    });
    y += 6;
  }

  if (inspection.observations) {
    if (y + 16 > flowBottom) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text('Observações Gerais', margin, y);
    y += 6;
    y = drawFlowText(inspection.observations, y, { size: 10, lineH: 5, x: margin, width: contentW }) + 5;
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
      return y;
    };

    drawNonComplianceHeading();

    let ncNum = 1;
    for (const response of nonCompliantItems) {
      const item = allItems.find(i => i.id === response.itemId);
      if (!item) continue;

      const code = `NC-${String(ncNum).padStart(3, '0')}`;
      const accent: [number, number, number] = item.isCritical ? [185, 28, 28] : secondaryColor;
      // Quando o item transborda a página, a retomada se identifica: antes o
      // texto continuava no alto da página seguinte sem dizer de qual NC era.
      const continueItem: ContinueFlow = () => {
        continueNonCompliancePage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.6);
        doc.setTextColor(...accent);
        doc.text(`${code} (continuação)`, bodyX, y);
        y += 6.5;
        return y;
      };

      const tags: { text: string; fill: [number, number, number] }[] = [];
      if (item.isCritical) tags.push({ text: 'ITEM CRÍTICO', fill: [185, 28, 28] });
      if (recurringItemIds.has(response.itemId)) tags.push({ text: 'REINCIDENTE', fill: [127, 29, 29] });
      if (item.requirementType === 'good_practice') tags.push({ text: 'BOA PRÁTICA', fill: mutedColor });

      y = drawItemHeader({
        code,
        title: item.description,
        accent,
        tags,
        legal: item.legislation
          ? (item.requirementType === 'good_practice'
              ? `Boa prática — não é exigência legal. Referência: ${item.legislation}`
              : `Base legal: ${item.legislation}`)
          : undefined,
        startY: y,
        onContinue: continueNonCompliancePage,
      });

      if (response.situationDescription) {
        y = drawLabeledBlock('Situação encontrada', response.situationDescription, y, [153, 27, 27], continueItem);
      }

      if (response.correctiveAction) {
        y = drawLabeledBlock('Ação corretiva', response.correctiveAction, y, [21, 101, 52], continueItem);
      }

      y = await drawPhotoGrid(response.photos, y, continueItem);
      // REL-03/PORT-03: o item voltou a ser NC — o que o cliente respondeu e o que anexou ficam
      // registrados aqui, ao lado do achado desta visita. É a leitura que sustenta a reincidência.
      y = drawClientDeclaration(clientDeclarationByItemId.get(response.itemId), y, continueItem);
      y = await drawClientEvidence(clientEvidenceByItemId.get(response.itemId), y, continueItem);
      y = drawItemLinks(response.links, y, continueItem);

      if (ncNum < nonCompliantItems.length) {
        y += 2.5;
        if (y + 10 <= flowBottom) {
          doc.setDrawColor(...borderColor);
          doc.setLineWidth(0.2);
          doc.line(margin, y, margin + contentW, y);
          y += 7;
        }
      }
      ncNum++;
    }

    if (y + 10 > flowBottom) continueNonCompliancePage();
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(`Ciente do Plano de Ação: ${inspection.accompanistName || 'Representante do Estabelecimento'}`, margin, y);
  }

  // ── REL-03: EVIDÊNCIAS DO CLIENTE EM ITENS JÁ REGULARIZADOS ──
  //
  // O item que voltou a ser NC já mostra a alegação junto do achado, lá em cima. Aqui ficam os
  // que o cliente disse ter corrigido e que ESTA vistoria confirmou — é a parte que fecha o
  // ciclo: a pendência não fechou porque chegou anexo, fechou porque foi verificada em campo, e
  // o relatório guarda as duas coisas lado a lado.
  const respondedItemIds = new Set<string>([
    ...clientEvidenceByItemId.keys(),
    ...clientDeclarationByItemId.keys(),
  ]);
  const evidenceOnResolved = [...respondedItemIds]
    .filter((itemId) => !nonCompliantItems.some((response) => response.itemId === itemId))
    .map((itemId) => ({
      item: allItems.find((i) => i.id === itemId),
      list: clientEvidenceByItemId.get(itemId) || [],
      declaration: clientDeclarationByItemId.get(itemId),
    }))
    .filter((entry): entry is {
      item: NonNullable<typeof entry.item>;
      list: ClientEvidenceForItem[];
      declaration: ClientDeclarationForItem | undefined;
    } => !!entry.item);

  if (evidenceOnResolved.length > 0) {
    doc.addPage();
    y = margin;
    const evidenceAccent: [number, number, number] = [7, 89, 133];
    const drawEvidenceHeading = (continuation = false) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...primaryColor);
      doc.text(`EVIDÊNCIAS APRESENTADAS PELO CLIENTE${continuation ? ' - CONTINUAÇÃO' : ''}`, margin, y);
      y += 3;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin + contentW, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...mutedColor);
      const nota = doc.splitTextToSize(
        'Registro do que o estabelecimento respondeu e apresentou como prova de correção entre uma '
        + 'visita e outra. A conclusão de cada pendência é a verificação em campo desta inspeção, e '
        + 'não a resposta nem o recebimento do arquivo.',
        contentW
      );
      doc.text(nota, margin, y);
      y += nota.length * 4.2 + 5;
    };
    const continueEvidencePage = () => {
      doc.addPage();
      y = margin;
      drawEvidenceHeading(true);
      return y;
    };

    drawEvidenceHeading();

    let evidenceNum = 1;
    for (const { item, list, declaration } of evidenceOnResolved) {
      const code = `EV-${String(evidenceNum).padStart(3, '0')}`;
      y = drawItemHeader({
        code,
        title: item.description,
        accent: evidenceAccent,
        tags: recurringItemIds.has(item.id) ? [{ text: 'REGULARIZADO', fill: [22, 101, 52] }] : [],
        startY: y,
        onContinue: continueEvidencePage,
      });
      y = drawClientDeclaration(declaration, y, continueEvidencePage);
      y = await drawClientEvidence(list, y, continueEvidencePage);
      evidenceNum++;
    }
  }

  // ── PAGES: EXCELÊNCIA E MELHORIAS ──────────────────────
  const excellenceItems = reportResponses.filter(r =>
    r.result === 'complies' && (r.situationDescription || r.correctiveAction || (r.photos && r.photos.length > 0) || (r.links && r.links.length > 0))
  );

  if (excellenceItems.length > 0) {
    doc.addPage();
    y = margin;
    const excellenceAccent: [number, number, number] = [21, 101, 52];
    const drawExcellenceHeading = (continuation = false) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...primaryColor);
      doc.text(
        `PONTOS DE EXCELÊNCIA E SUGESTÕES DE MELHORIA${continuation ? ' - CONTINUAÇÃO' : ''}`,
        margin,
        y
      );
      y += 3;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin + contentW, y);
      y += 10;
    };
    const continueExcellencePage = () => {
      doc.addPage();
      y = margin;
      drawExcellenceHeading(true);
      return y;
    };

    drawExcellenceHeading();

    let exNum = 1;
    for (const response of excellenceItems) {
      const item = allItems.find(i => i.id === response.itemId);
      if (!item) continue;

      const code = `EX-${String(exNum).padStart(3, '0')}`;
      const continueItem: ContinueFlow = () => {
        continueExcellencePage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.6);
        doc.setTextColor(...excellenceAccent);
        doc.text(`${code} (continuação)`, bodyX, y);
        y += 6.5;
        return y;
      };

      // A pergunta do roteiro vai inteira no cabeçalho: antes era cortada em 90
      // caracteres e o resto reaparecia como parágrafo solto.
      y = drawItemHeader({
        code,
        title: item.description,
        accent: excellenceAccent,
        legal: item.legislation ? `Base legal: ${item.legislation}` : undefined,
        startY: y,
        onContinue: continueExcellencePage,
      });

      if (response.situationDescription) {
        y = drawLabeledBlock('Destaque / observação', response.situationDescription, y, secondaryColor, continueItem);
      }

      if (response.correctiveAction) {
        y = drawLabeledBlock('Sugestão de alto padrão', response.correctiveAction, y, excellenceAccent, continueItem);
      }

      y = await drawPhotoGrid(response.photos, y, continueItem);
      y = drawItemLinks(response.links, y, continueItem);

      if (exNum < excellenceItems.length) {
        y += 2.5;
        if (y + 10 <= flowBottom) {
          doc.setDrawColor(...borderColor);
          doc.setLineWidth(0.2);
          doc.line(margin, y, margin + contentW, y);
          y += 7;
        }
      }
      exNum++;
    }
  }

  // ── SIGNATURE + DISCLAIMER ──────────────────────────────
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  y += 10;
  const disclaimer = 'Este relatório foi elaborado com base nas legislações sanitárias vigentes, durante visita técnica realizada na data indicada. As referências legislativas completas constam na última seção deste documento.';
  y = drawFlowText(disclaimer, y, {
    size: 9, font: 'italic', color: mutedColor, lineH: 5, x: margin, width: contentW,
  }) + 15;

  // Acompanhante. Decisão 31 do FE-23: a assinatura deixou de ser capturada no
  // aparelho — o relatório é fechado em casa, quando não há mais ninguém para
  // assinar. Relatório antigo que já tem a assinatura gravada continua
  // imprimindo a dele; sem ela, sai uma linha em branco sobre o nome, para
  // assinatura no papel se alguém pedir.
  if (inspection.signatureDataUrl) {
    try {
      doc.addImage(inspection.signatureDataUrl, 'PNG', margin, y - 15, 60, 15);
    } catch { /* skip */ }
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y - 4, margin + 80, y - 4);
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

  // O rodapé de todas as páginas é desenhado uma única vez, depois das páginas de
  // assinatura e referências. Desenhar aqui também imprimia "Página 1 de 8" por
  // baixo de "Página 1 de 9" — dois totais sobrepostos em cada página.

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
 * Lista as normas citadas pelos itens avaliados que tenham verbete curado na
 * biblioteca. `selectedLegislations` (do modal) restringe ainda mais essa lista.
 */
function drawReferencesABNT(
  doc: jsPDF,
  template: ChecklistTemplate,
  responses: InspectionResponse[],
  allLegislations: any[],
  _inspection: Inspection,
  selectedLegislations?: string[]
) {
  const candidates = selectedLegislations && selectedLegislations.length > 0
    ? selectedLegislations
    : citedLegislations(template, responses);

  // Só entra na seção quem tem verbete curado: é o verbete que traz autoria, ementa,
  // link e vigência conferida. Sem ele a citação seria inventada — que é justamente
  // o que fazia "Critério técnico de higiene das mãos" virar norma no relatório.
  // O fundamento do item continua visível no corpo, e o modal avisa o que ficou de fora.
  const uniqueRefs = Array.from(new Set(candidates))
    .filter(ref => allLegislations.some(leg => canonicalLegislationKey(leg.name) === canonicalLegislationKey(ref)))
    .sort();

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

  // Nota de encerramento da seção, acima da régua do rodapé (que fica em pageH-16).
  const noteY = pageH - 24;
  if (y < noteY) {
    y = noteY;
  } else {
    doc.addPage();
    y = noteY;
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

  const linkColor: [number, number, number] = [45, 90, 142];
  const textX = margin + 11;
  const textW = contentW - 11;
  const bottom = pageH - 22;
  let y = 58;

  sources.forEach((source, idx) => {
    const { label, hint } = describeUrl(source.url);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const titleLines: string[] = doc.splitTextToSize(source.title || label, textW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    const linkLines: string[] = doc.splitTextToSize(label, textW);
    doc.setFontSize(8.4);
    const noteLines: string[] = source.note ? doc.splitTextToSize(source.note, textW) : [];

    const blockH = titleLines.length * 5 + linkLines.length * 4.6 + (hint ? 4 : 0)
      + (noteLines.length ? 1.5 + noteLines.length * 4.4 : 0) + 8;
    if (y + blockH > bottom) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(...linkColor);
    doc.circle(margin + 3.5, y - 1.2, 2.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, margin + 3.5, y + 0.6, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    titleLines.forEach((line) => {
      doc.text(line, textX, y);
      y += 5;
    });

    // Endereço clicável com rótulo legível — a URL crua de busca tinha centenas
    // de caracteres de rastreamento e tomava a página inteira.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    linkLines.forEach((line, lineIdx) => {
      drawUrlLink(doc, line, textX, y + lineIdx * 4.6, source.url, linkColor);
    });
    y += linkLines.length * 4.6;

    if (hint) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.4);
      doc.setTextColor(107, 114, 128);
      doc.text(hint, textX, y + 0.6);
      y += 4;
    }

    if (noteLines.length) {
      y += 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(107, 114, 128);
      noteLines.forEach((line) => {
        doc.text(line, textX, y);
        y += 4.4;
      });
    }

    y += 3;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(textX, y, margin + contentW, y);
    y += 6;
  });
}

/**
 * Formata uma citação legislativa no padrão ABNT NBR 6023.
 *
 * Autoria, ementa e vigência vêm do verbete curado da biblioteca — nunca são
 * deduzidas do texto. A versão anterior adivinhava o órgão por regex e carimbava
 * "BRASIL." em qualquer string, o que produzia citações de normas inexistentes
 * ("BRASIL. Critério técnico de higiene das mãos.") e atribuía ao Ministério da
 * Saúde atos municipais como a Portaria IVISA-RIO 002/2020.
 *
 * Sem verbete, a referência sai como o item a citou: sem autoria e sem ementa.
 * Some do relatório seria pior — o item cobra uma exigência e some a base dela.
 */
function formatABNT(mention: string, libraryEntry?: any): string {
  const m = mention.trim();
  if (!libraryEntry) return m;

  const name = libraryEntry.name || m;
  const authority = (libraryEntry.authority || '').trim().replace(/\.$/, '');
  const summary = (libraryEntry.summary || '').trim().replace(/\.$/, '');
  const revokedBy = libraryEntry.status === 'revogada'
    ? (libraryEntry.replaced_by || libraryEntry.replacedBy)
    : '';

  return [
    authority ? `${authority}. ${name}.` : `${name}.`,
    summary ? `${summary}.` : '',
    libraryEntry.status === 'revogada'
      ? `[REVOGADA${revokedBy ? ` — substituída por ${revokedBy}` : ''}.]`
      : '',
  ].filter(Boolean).join(' ');
}
