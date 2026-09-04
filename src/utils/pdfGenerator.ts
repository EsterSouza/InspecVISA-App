import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inspection, InspectionResponse, ChecklistTemplate, InspectionScore, ConsultantSettings, FoodEstablishmentType, ReferenceSource, ScoreClassification } from '../types';
import { FOOD_SEGMENT_LABELS } from '../types';
import { classificationLabel, getLatestResponsesByItem, calculateAreaScores } from './scoring';
import { formatDate } from './imageUtils';
import { calculateILPIStaffing } from './ilpiStaffing';
import { isRioState } from './state';
// REF-02: pdfGenerator mantinha uma cópia própria (e defasada) de
// extractBaseLegislation — sem os qualificadores do REF-01 nem as correções de
// número/ano do REF-02. Passa a usar a mesma implementação do resto do app.
import { extractBaseLegislation, canonicalLegislationKey, citedLegislations } from './legislationRefs';
import { formatAbnt as formatAbntCompartilhado, type LegislationStatus } from '@visa/legislacao';
import type { ClientDeclarationForItem, ClientEvidenceForItem } from '../services/clientEvidenceService';
import { parseCheckpoints } from './actionCheckpoints';
import { registerPdfFonts, PDF_FONT_HEAD, PDF_FONT_BODY } from './pdfFonts';
import { fimDaUltimaTabela } from './pdfAutoTable';
import type { Legislation } from '../services/legislationService';

/**
 * Verbete de legislação como o PDF pode recebê-lo: a linha da tabela (`Legislation`, que
 * usa `replaced_by`) ou o verbete embutido em `src/data/legislationLibrary.ts` (que usa
 * `replacedBy`). É por isso que `formatABNT` lê as duas grafias.
 */
type VerbeteLegislacao = Partial<Legislation> & { name: string; replacedBy?: string };
import { TREINAVISA_LOGO_PNG } from './pdfBrandLogo';

// Aliases curtos das famílias da marca, usados nos setFont de todo o arquivo.
const FH = PDF_FONT_HEAD;   // Sora — títulos
const FB = PDF_FONT_BODY;   // Source Sans 3 — corpo


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
  legislations: VerbeteLegislacao[] = [],
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
  registerPdfFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // ── Tipografia e paleta da marca (Manual de Marca 2.0 / design-inspecvisa) ──
  // Sora nos títulos, Source Sans 3 na leitura. As cores são os tokens oficiais;
  // os nomes herdados (primaryColor, mutedColor...) passam a apontar para eles,
  // então a troca propaga para o documento inteiro.
  const ink: [number, number, number] = [11, 31, 58];             // #0B1F3A texto/estrutura
  const ink2: [number, number, number] = [65, 85, 111];           // #41556F apoio
  const accent: [number, number, number] = [36, 74, 155];         // #244A9B ação/links
  const accentSoft: [number, number, number] = [234, 243, 252];   // #EAF3FC fundo de leitura
  const teal: [number, number, number] = [15, 107, 120];          // #0F6B78 operacional
  const amber: [number, number, number] = [217, 151, 33];         // #D99721 preenchimento âmbar
  const amberStrong: [number, number, number] = [174, 119, 20];   // #AE7714 texto/ícone âmbar
  const green: [number, number, number] = [31, 157, 87];          // preenchimento sucesso
  const greenInk: [number, number, number] = [21, 115, 71];       // texto sucesso
  const red: [number, number, number] = [214, 69, 69];            // preenchimento erro
  const redInk: [number, number, number] = [176, 42, 42];         // texto erro

  const primaryColor: [number, number, number] = accent;          // azul da marca — fills e cabeçalhos
  const secondaryColor: [number, number, number] = teal;
  const textColor: [number, number, number] = [31, 41, 55];       // corpo (AA sobre branco)
  const mutedColor: [number, number, number] = [84, 101, 123];    // #54657B — o tom mais claro que existe
  const borderColor: [number, number, number] = [203, 217, 234];  // #CBD9EA decorativa
  const surfaceColor: [number, number, number] = [245, 248, 252]; // #F5F8FC
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
    doc.setFillColor(...accent);
    doc.roundedRect(margin, y - 5, 3, subtitle ? 18 : 12, 1.5, 1.5, 'F');
    doc.setFont(FH, 'normal');
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text(title, margin + 9, y + 2);
    if (subtitle) {
      doc.setFont(FB,'normal');
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
    doc.setFont(FH, 'normal');
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text(value, x + 7, y + 9);
    doc.setFont(FB, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...mutedColor);
    doc.text(label.toUpperCase(), x + 7, y + 15, { charSpace: 0.2 });
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
    doc.setFont(FB,style.font || 'normal');
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

  /**
   * Os tópicos que a consultora marcou, cada um no seu retângulo fechado.
   *
   * A caixa é atômica: se não couber no que resta da página, ela inteira desce
   * para a seguinte. Partir um retângulo ao meio é pior que deixar um vão — e é
   * a caixa que diz ao cliente onde uma tarefa termina e a outra começa.
   */
  function drawCheckpointBoxes(
    points: string[],
    startY: number,
    onContinue: ContinueFlow,
    opts: { task?: boolean } = {}
  ) {
    const padX = 2.8;
    const padY = 2.2;
    const gap = 2;
    const indent = opts.task ? 5.6 : 0;
    const lineH = 5;
    const ascent = lineH * 0.72;
    const maxBoxH = flowBottom - margin;
    let cursor = startY;

    for (const point of points) {
      doc.setFont(FB,'normal');
      doc.setFontSize(9.8);
      const lines: string[] = doc.splitTextToSize(point, bodyW - padX * 2 - indent);
      const boxH = padY * 2 + lines.length * lineH;

      // Tópico que não cabe nem numa página inteira sai como texto corrido: o
      // texto tem de aparecer inteiro, a caixa é que é dispensável.
      if (boxH > maxBoxH) {
        cursor = drawFlowText(point, cursor, { size: 9.8, lineH }, onContinue) + gap;
        continue;
      }
      if (cursor + boxH > flowBottom) {
        cursor = onContinue();
        doc.setFont(FB,'normal');
        doc.setFontSize(9.8);
      }

      doc.setFillColor(...surfaceColor);
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.25);
      doc.roundedRect(bodyX, cursor, bodyW, boxH, 1.6, 1.6, 'FD');
      if (opts.task) {
        // Quadradinho vazio: no papel a lista tem de se ler como tarefa a fazer.
        doc.setDrawColor(...mutedColor);
        doc.setLineWidth(0.3);
        doc.roundedRect(bodyX + padX, cursor + padY + 0.6, 3, 3, 0.5, 0.5, 'D');
      }
      doc.setTextColor(...textColor);
      lines.forEach((line, index) => {
        doc.text(line, bodyX + padX + indent, cursor + padY + ascent + index * lineH);
      });
      cursor += boxH + gap;
    }

    // Respiro depois do último retângulo: o `+3.5` que fecha o bloco parte da
    // BORDA da caixa, e não de uma linha de base — sem isto o rótulo seguinte
    // encosta na caixa de cima.
    return points.length > 0 ? cursor - gap + 2.5 : cursor;
  }

  /**
   * Rótulo + corpo, com o rótulo sempre na mesma página da primeira linha.
   *
   * Texto em tópicos vira retângulos; texto corrido segue corrido. `task` marca
   * os tópicos que são obrigação do cliente (a ação corretiva) — só eles ganham
   * quadradinho. Observação e sugestão entram na caixa sem quadradinho: não são
   * coisas a cumprir.
   */
  function drawLabeledBlock(
    label: string,
    text: string,
    startY: number,
    labelColor: [number, number, number],
    onContinue: ContinueFlow = continueOnBlankPage,
    opts: { task?: boolean } = {}
  ) {
    let cursor = startY;
    if (cursor + 10.5 > flowBottom) cursor = onContinue();
    doc.setFont(FB,'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(...labelColor);
    doc.text(label, bodyX, cursor);
    cursor += 5.2;

    const { context, points } = parseCheckpoints(text);
    if (points.length === 0) {
      return drawFlowText(text, cursor, { size: 9.8, lineH: 5 }, onContinue) + 3.5;
    }
    if (context) cursor = drawFlowText(context, cursor, { size: 9.8, lineH: 5 }, onContinue) + 1.5;
    return drawCheckpointBoxes(points, cursor, onContinue, opts) + 3.5;
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

    doc.setFont(FB,'bold');
    doc.setFontSize(10.4);
    const titleLines: string[] = doc.splitTextToSize(title, innerW);
    doc.setFont(FB,'italic');
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
    doc.setFont(FB,'bold');
    doc.setFontSize(9);
    doc.setTextColor(...accent);
    doc.text(code, metaX, metaBase);
    metaX += doc.getTextWidth(code) + 3.5;
    tags.forEach((tag) => {
      doc.setFont(FB,'bold');
      doc.setFontSize(6.6);
      const tagW = doc.getTextWidth(tag.text) + 5;
      doc.setFillColor(...tag.fill);
      doc.roundedRect(metaX, metaBase - 3.6, tagW, 5, 1.6, 1.6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(tag.text, metaX + 2.5, metaBase - 0.2);
      metaX += tagW + 2.5;
    });

    doc.setFont(FB,'bold');
    doc.setFontSize(10.4);
    doc.setTextColor(...textColor);
    let lineY = metaBase + metaH;
    titleLines.forEach((line) => {
      doc.text(line, margin + padX, lineY);
      lineY += titleLineH;
    });

    if (legalLines.length) {
      doc.setFont(FB,'italic');
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
    doc.setFont(FB,'bold');
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
            getPdfImageFormat(entry.photo.dataUrl),
            cellX + (cellW - drawW) / 2,
            cursor + (cellH - drawH) / 2,
            drawW,
            drawH
          );
        } catch (err) {
          console.warn('[PDF] Failed to add photo, skipping', entry.photo.id, err);
        }

        if (entry.photo.caption) {
          doc.setFont(FB,'normal');
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
    doc.setFont(FB,'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(...mutedColor);
    doc.text('Fontes consultadas neste item', bodyX, cursor);
    cursor += 5;

    list.forEach((link) => {
      const { label, hint } = describeUrl(link);
      doc.setFont(FB,'normal');
      doc.setFontSize(8.6);
      const lines: string[] = doc.splitTextToSize(label, bodyW - 6);
      const blockH = lines.length * 4.5 + (hint ? 4 : 0);
      if (cursor + blockH > flowBottom) cursor = onContinue();

      doc.setFillColor(...secondaryColor);
      doc.circle(bodyX + 1, cursor - 1.2, 0.8, 'F');
      doc.setFont(FB,'normal');
      doc.setFontSize(8.6);
      lines.forEach((line, idx) => {
        drawUrlLink(doc, line, bodyX + 5, cursor + idx * 4.5, link, secondaryColor);
      });
      cursor += lines.length * 4.5;

      if (hint) {
        doc.setFont(FB,'italic');
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
    doc.setFont(FB,'normal');
    doc.text(settings.companyName || settings.name, margin, y);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW - margin, y, { align: 'right' });
    // Data da visita (que finalizou o relatório), não a data de geração do arquivo.
    doc.text(formatDate(inspection.inspectionDate), pageW / 2, y, { align: 'center' });
  }

  // ── PAGE 1: CAPA ─────────────────────────────────────────
  // Lombada de cor no lugar do antigo bloco navy: a marca pede navy como texto e
  // estrutura, não como campo de cor. O acento vertical carrega a identidade sem
  // cobrir a página de tinta escura.
  doc.setFillColor(...accent);
  doc.rect(0, 0, 7, pageH, 'F');
  doc.setFillColor(...teal);
  doc.rect(0, pageH * 0.62, 7, pageH * 0.38, 'F');

  const coverLeft = margin + 4;

  // Logo (topo direito): sempre a da TreinaVISA, por decisão da Ester.
  try {
    doc.addImage(TREINAVISA_LOGO_PNG, 'PNG', pageW - margin - 26, 15, 26, 26);
  } catch { /* skip invalid logo */ }

  doc.setFont(FH, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...teal);
  doc.text((settings.companyName || settings.name || 'Consultoria Sanitária').toUpperCase(), coverLeft, 22, { charSpace: 0.3 });

  doc.setFont(FH, 'normal');
  doc.setFontSize(23);
  doc.setTextColor(...ink);
  doc.text('Relatório de Inspeção Sanitária', coverLeft, 33);

  doc.setFont(FB, 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(...ink2);
  doc.text(template.name, coverLeft, 42);

  let y = 51;
  // Botão do portal — CTA azul da marca (âmbar nunca é ação principal). Só aparece
  // quando a inspeção tem solicitação vinculada, ou seja, quando existe link público.
  if (options.portalUrl) {
    const btnLabel = 'Ver relatório e plano de ação no portal  ›';
    doc.setFont(FB, 'bold');
    doc.setFontSize(9);
    const btnW = doc.getTextWidth(btnLabel) + 11;
    const btnH = 8;
    doc.setFillColor(...accent);
    doc.roundedRect(coverLeft, y, btnW, btnH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(btnLabel, coverLeft + 5.5, y + 5.2);
    doc.link(coverLeft, y, btnW, btnH, { url: options.portalUrl });
    y += btnH + 8;
  } else {
    y += 4;
  }

  // Establishment data
  doc.setFont(FH, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text('Dados do estabelecimento', coverLeft, y);
  y += 2.5;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(coverLeft, y, margin + contentW, y);
  y += 8;

  const drawField = (label: string, value: string) => {
    doc.setFont(FB, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text(label, coverLeft, y);
    doc.setFont(FB, 'normal');
    doc.setTextColor(...ink);
    doc.setFontSize(10);
    doc.text(value || '—', coverLeft + 35, y);
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
  // O registro profissional já sai junto do nome da consultora (reportConsultants);
  // o bloco extra repetia "COREN-RJ: ..." uma segunda vez na capa.

  // ILPI Extra Information
  if (inspection.ilpiCapacity || inspection.residentsTotal || inspection.usableAreaM2) {
    y += 5;
    doc.setFont(FH, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text('DADOS TÉCNICOS ILPI', coverLeft, y);
    y += 5;

    autoTable(doc, {
      styles: { font: FB },
      startY: y,
      head: [['Capacidade', 'Nº Residentes', 'Grau I', 'Grau II', 'Grau III']],
      body: [[
        inspection.ilpiCapacity || '—',
        inspection.residentsTotal || '—',
        inspection.dependencyLevel1 || '0',
        inspection.dependencyLevel2 || '0',
        inspection.dependencyLevel3 || '0',
      ]],
      headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 10, halign: 'center' },
      margin: { left: margin, right: margin },
      theme: 'grid',
    });
    y = fimDaUltimaTabela(doc) + 8;

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
      styles: { font: FB },
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
        // Cabeçalho segue o alinhamento das colunas (o autoTable não propaga
        // columnStyles.halign para o head): números sob os títulos.
        if (data.section === 'head') {
          data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
        }
        if (data.section === 'body' && data.column.index === 3) {
          const ok = String(data.cell.raw) === 'ADEQUADO';
          data.cell.styles.textColor = ok ? [22, 101, 52] : [185, 28, 28];
          data.cell.styles.fillColor = ok ? [240, 253, 244] : [254, 242, 242];
        }
      },
      margin: { left: margin, right: margin },
      theme: 'grid',
    });
    y = fimDaUltimaTabela(doc) + 5;

    doc.setFontSize(7.5);
    doc.setFont(FB,'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`Base legal: ${staffing.legalBase}. Técnico de enfermagem não substitui cuidador no dimensionamento.`, margin, y);
    y += 10;
  }

  // ── PAGE 1: CAPA (Score) ─────────────────────────────────
  // Decisão 27: quatro classificações, três cores (bom e excelente = verde).
  // A cor vai na barra e no ponto; número, rótulo e selo usam tinta escura —
  // texto branco sobre âmbar reprova AA (2,5:1).
  y += 6;
  const scorePercent = Math.round(score.scorePercentage);
  const bandFill = (p: number): [number, number, number] => (p >= 85 ? green : p >= 70 ? amber : red);
  // Preenchimento por classificação (barra/ponto/rail). Reusado no bloco "por área".
  const riskRgbMap: Record<string, [number, number, number]> = {
    excellent: green, good: green, regular: amber, critical: red,
  };
  const classInkMap: Record<string, [number, number, number]> = {
    excellent: greenInk, good: greenInk, regular: amberStrong, critical: redInk,
  };
  const scoreFill = bandFill(scorePercent);
  const riskFill = riskRgbMap[score.classification] || mutedColor;
  const riskInk = classInkMap[score.classification] || ink;
  const riskLabel = classificationLabel(score.classification);

  const scoreGap = 4;
  const leftW = (contentW - scoreGap) * 0.56;
  const rightW = contentW - scoreGap - leftW;
  const boxH = 34;

  // Card esquerdo — conformidade global (número em navy, barra colorida)
  doc.setFillColor(...surfaceColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, leftW, boxH, 3, 3, 'FD');
  doc.setFont(FH, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('CONFORMIDADE GLOBAL', margin + 7, y + 8, { charSpace: 0.2 });
  doc.setFontSize(34);
  doc.setTextColor(...ink);
  doc.text(`${scorePercent}%`, margin + 7, y + 21);
  doc.setFont(FB, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...ink2);
  doc.text(`${score.evaluatedItems} de ${score.totalItems} itens avaliados`, margin + 7, y + 27.5);
  const barX = margin + 7;
  const barW = leftW - 14;
  const barY = y + boxH - 5;
  doc.setFillColor(236, 240, 246);
  doc.roundedRect(barX, barY, barW, 2.6, 1.3, 1.3, 'F');
  doc.setFillColor(...scoreFill);
  doc.roundedRect(barX, barY, (barW * scorePercent) / 100, 2.6, 1.3, 1.3, 'F');

  // Card direito — classificação de risco (selo em tinta escura + ponto colorido)
  const rx = margin + leftW + scoreGap;
  doc.setFillColor(...surfaceColor);
  doc.setDrawColor(...borderColor);
  doc.roundedRect(rx, y, rightW, boxH, 3, 3, 'FD');
  doc.setFont(FH, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('CLASSIFICAÇÃO DE RISCO', rx + 7, y + 8, { charSpace: 0.2 });
  doc.setFillColor(...riskFill);
  doc.circle(rx + 8.7, y + 16.5, 2, 'F');
  doc.setFont(FH, 'normal');
  doc.setFontSize(15);
  doc.setTextColor(...riskInk);
  doc.text(riskLabel, rx + 13, y + 18.5);
  doc.setFont(FB, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...ink2);
  doc.text(`${score.criticalNotCompliesCount} não conformidade(s) crítica(s)`, rx + 7, y + 28);

  y += boxH + 8;

  const coverGap = 4;
  const coverCardW = (contentW - coverGap * 3) / 4;
  drawMetricCard(margin, coverCardW, 'Cumpre', `${score.compliesCount}`, green);
  drawMetricCard(margin + coverCardW + coverGap, coverCardW, 'Não cumpre', `${score.notCompliesCount}`, red);
  drawMetricCard(margin + (coverCardW + coverGap) * 2, coverCardW, 'Críticos', `${score.criticalNotCompliesCount}`, redInk);
  drawMetricCard(margin + (coverCardW + coverGap) * 3, coverCardW, 'Não avaliados', `${score.notEvaluatedCount}`, mutedColor);
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
  drawMetricCard(margin, summaryCardW, 'Conformidades', `${score.compliesCount}`, green);
  drawMetricCard(margin + summaryCardW + summaryGap, summaryCardW, 'Não conformidades', `${score.notCompliesCount}`, red);
  drawMetricCard(margin + (summaryCardW + summaryGap) * 2, summaryCardW, 'Urgentes', `${score.urgentActionsCount}`, amber);
  drawMetricCard(margin + (summaryCardW + summaryGap) * 3, summaryCardW, 'Não observados', `${score.notObservedCount}`, mutedColor);
  y += 27;

  // ── Conformidade por área (sanitária x nutrição) ─────────
  // Só em ILPI com as duas áreas avaliadas. O número grande da capa é o GLOBAL.
  if (areaScores.isSplit && isIlpiReport) {
    const areaCards: { label: string; consultant?: string; pct: number; classif: ScoreClassification; nc: number }[] = [
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
      doc.setFont(FB, 'bold');
      doc.setFontSize(7.5);
      const who = (card.consultant || '').trim().split(/\s+/)[0];
      doc.text(`${card.label.toUpperCase()}${who ? ` - ${who.toUpperCase()}` : ''}`, tx, y + 6);
      doc.setTextColor(...ink);
      doc.setFont(FH, 'normal');
      doc.setFontSize(18);
      doc.text(`${card.pct}%`, tx, y + 14.5);
      doc.setFont(FB, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...(classInkMap[card.classif] || mutedColor));
      doc.text(`${card.nc} NC · ${classificationLabel(card.classif)}`, tx + 21, y + 14.5);
    });
    y += 24;
  }

  // Summary table
  autoTable(doc, {
    styles: { font: FB },
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
    // footStyles precisa repetir cellPadding e valign do corpo — sem isso o TOTAL
    // usa o padding padrão do autoTable, fica com altura diferente e sai "torto".
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2.3, valign: 'middle' },
    footStyles: { fillColor: [226, 232, 240], fontStyle: 'bold', fontSize: 8.5, textColor, cellPadding: 2.3, valign: 'middle' },
    bodyStyles: { fontSize: 8.5, textColor, cellPadding: 2.3, valign: 'middle' },
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
    // Nesta versão do autoTable, columnStyles.halign alinha só o corpo; cabeçalho e
    // rodapé caem no default (esquerda) e os números não sentam sob o título. Forçamos
    // o mesmo alinhamento das colunas para cabeçalho e rodapé.
    didParseCell: (data) => {
      if (data.section === 'head' || data.section === 'foot') {
        data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
      }
      if (data.column.index === 6 && (data.section === 'body' || data.section === 'foot')) {
        const p = parseInt(String(data.cell.raw), 10) || 0;
        data.cell.styles.textColor = p >= 85 ? greenInk : p >= 70 ? amberStrong : redInk;
      }
    },
    margin: { left: margin, right: margin },
    theme: 'plain',
  });

  y = fimDaUltimaTabela(doc) + 12;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...amber);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD');
  doc.setFont(FH, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...amberStrong);
  doc.text('PRIORIDADE DE TRATAMENTO', margin + 5, y + 7);
  doc.setFont(FB,'normal');
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
    defaultDeadline: string
  ) => {
    if (items.length === 0) return;
    if (y > pageH - 35) drawPlanContinuation();

    const drawGroupHeading = (continuation = false) => {
      doc.setFillColor(...accent);
      doc.circle(margin + 1.5, y - 1.3, 1.5, 'F');
      doc.setFont(FH, 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(...accent);
      doc.text(`${title}${continuation ? ' — continuação' : ''} (${items.length})`, margin + 6, y);
      y += 9;
    };
    // Respiro antes do título do grupo, para ele não colar no card anterior.
    y += 8;
    drawGroupHeading();

    // Layout do card — igual entre os itens, então mora fora do laço.
    const cardInnerX = margin + 8;
    const cardInnerW = contentW - 20;
    const pageBottom = pageH - 24;
    const bodyFontSize = 10;
    const bodyLineHeight = 5.1;
    const requirementFontSize = 9;
    const requirementLineHeight = 4.7;
    // Retângulo de um tópico: recuo interno, respiro entre eles e a sangria que o
    // quadradinho de tarefa abre à esquerda.
    const boxPadX = 3.2;
    const boxPadY = 2.4;
    const boxGap = 2.2;
    const boxAfter = 2.5;
    const taskIndent = 6.4;

    /**
     * Um bloco do card já medido: quanto ocupa e como se divide.
     *
     * Medir e desenhar leem a MESMA estrutura de propósito. Quando as duas contas
     * moram em lugares diferentes elas divergem, e divergir aqui é texto vazando
     * da caixa depois de uma quebra de página.
     */
    interface MeasuredBlock {
      label: string;
      text: string;
      color: [number, number, number];
      isRequirement: boolean;
      /** Tarefa: cada tópico ganha quadradinho, porque é o que o cliente cumpre. */
      task: boolean;
      /** Texto corrido — é o bloco inteiro quando não há tópico marcado. */
      contextLines: string[];
      /** Um retângulo por tópico, já quebrado nas linhas que cabem dentro dele. */
      boxes: string[][];
      lineHeight: number;
      /** Só o conteúdo: rótulo e respiros já estão na constante de 58 do card. */
      contentHeight: number;
    }

    const measureBlock = (
      label: string,
      text: string,
      color: [number, number, number],
      opts: { isRequirement?: boolean; task?: boolean; plain?: boolean } = {},
    ): MeasuredBlock => {
      const isRequirement = !!opts.isRequirement;
      const lineHeight = isRequirement ? requirementLineHeight : bodyLineHeight;
      // O requisito é citação do roteiro, não lista de tarefas: nunca vira caixa.
      const parsed = isRequirement || opts.plain
        ? { context: text, points: [] as string[] }
        : parseCheckpoints(text);

      doc.setFont(FB, isRequirement ? 'italic' : 'normal');
      doc.setFontSize(isRequirement ? requirementFontSize : bodyFontSize);
      const contextLines: string[] = parsed.context ? doc.splitTextToSize(parsed.context, cardInnerW) : [];
      const boxTextW = cardInnerW - boxPadX * 2 - (opts.task ? taskIndent : 0);
      const boxes: string[][] = parsed.points.map(point => doc.splitTextToSize(point, boxTextW));

      let contentHeight = contextLines.length * lineHeight;
      if (contextLines.length > 0 && boxes.length > 0) contentHeight += 2;
      boxes.forEach((lines, index) => {
        contentHeight += boxPadY * 2 + lines.length * lineHeight;
        if (index < boxes.length - 1) contentHeight += boxGap;
      });
      // Respiro depois do último retângulo. O `+5` que fecha o bloco parte da
      // BORDA da caixa, e não de uma linha de base — sem isto o rótulo do bloco
      // seguinte encosta na caixa de cima.
      if (boxes.length > 0) contentHeight += boxAfter;

      return {
        label, text, color, isRequirement, task: !!opts.task,
        contextLines, boxes, lineHeight, contentHeight,
      };
    };

    const drawBlock = (block: MeasuredBlock, startY: number) => {
      let blockY = startY;
      if (block.isRequirement) {
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.2);
        doc.line(cardInnerX, blockY, margin + contentW - 8, blockY);
        blockY += 5;
      }
      doc.setFont(FH, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...block.color);
      doc.text(block.label, cardInnerX, blockY, { charSpace: 0.2 });
      blockY += 5;

      doc.setFont(FB, block.isRequirement ? 'italic' : 'normal');
      doc.setFontSize(block.isRequirement ? requirementFontSize : bodyFontSize);
      doc.setTextColor(...textColor);
      // Uma linha por vez, com a mesma entrelinha usada para medir o card:
      // passar o bloco inteiro com maxWidth deixava o jsPDF usar a entrelinha
      // dele (menor), então o texto ficava comprimido e sobrava vão no fim.
      block.contextLines.forEach((line, index) => {
        doc.text(line, cardInnerX, blockY + index * block.lineHeight);
      });
      blockY += block.contextLines.length * block.lineHeight;
      if (block.contextLines.length > 0 && block.boxes.length > 0) blockY += 2;

      // Daqui para baixo a conta é por caixa, e `blockY` passa a ser o TOPO dela
      // em vez da linha de base do texto.
      const ascent = block.lineHeight * 0.72;
      block.boxes.forEach((lines) => {
        const boxHeight = boxPadY * 2 + lines.length * block.lineHeight;
        doc.setFillColor(...surfaceColor);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.25);
        doc.roundedRect(cardInnerX, blockY, cardInnerW, boxHeight, 1.6, 1.6, 'FD');

        if (block.task) {
          // Quadradinho vazio: no papel a lista tem de se ler como tarefa a fazer.
          doc.setDrawColor(...mutedColor);
          doc.setLineWidth(0.3);
          doc.roundedRect(cardInnerX + boxPadX, blockY + boxPadY + 0.7, 3.2, 3.2, 0.5, 0.5, 'D');
        }

        doc.setFont(FB, 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(...textColor);
        const textX = cardInnerX + boxPadX + (block.task ? taskIndent : 0);
        lines.forEach((line, index) => {
          doc.text(line, textX, blockY + boxPadY + ascent + index * block.lineHeight);
        });
        blockY += boxHeight + boxGap;
      });
      if (block.boxes.length > 0) blockY += boxAfter - boxGap;

      return blockY + 5;
    };

    items.forEach((response) => {
      const item = allItemsList.find(candidate => candidate.id === response.itemId);
      const isRecurring = recurringItemIds.has(response.itemId);
      const cardNumber = sortedNonCompliant.indexOf(response) + 1;
      const situation = response.situationDescription || 'Achado registrado durante a visita técnica.';
      const correction = response.correctiveAction || 'Definir medida corretiva e registrar evidência de conclusão.';
      const requirement = item?.description || response.customDescription || 'Requisito avaliado.';

      // Os tópicos que ela marcou com traço ou numeração viram retângulos
      // fechados, um por tarefa — é ponto a ponto que o cliente responde. Texto
      // corrido segue bloco corrido: sem marcador, sem caixa.
      const blocks = [
        measureBlock('Situação encontrada', situation, accent),
        measureBlock('Ação recomendada', correction, teal, { task: true }),
        measureBlock('Requisito avaliado', requirement, mutedColor, { isRequirement: true }),
      ];

      const cardHeight = 58 + blocks.reduce((total, block) => total + block.contentHeight, 0);
      const fullPageCardHeight = pageBottom - margin - 8;

      if (y + cardHeight > pageBottom && cardHeight <= fullPageCardHeight) {
        drawPlanContinuation();
        drawGroupHeading(true);
      }

      const deadline = response.deadline || defaultDeadline;
      const responsible = response.responsible || 'RT / Gestor';
      const chipText = `${deadline}  ·  ${responsible}`;

      const drawCardFrame = (height: number, continuation = false) => {
        // Card branco com trilho colorido à esquerda — não mais o bloco inteiro tingido.
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW, height, 2.5, 2.5, 'FD');
        doc.setFillColor(...accent);
        doc.roundedRect(margin, y, 3, height, 1.5, 1.5, 'F');

        doc.setFont(FH, 'normal');
        doc.setFontSize(11);
        doc.setTextColor(...accent);
        const codeText = `Ação ${String(cardNumber).padStart(2, '0')}${continuation ? ' — continuação' : ''}`;
        doc.text(codeText, cardInnerX, y + 9);

        // Selo de reincidência: âmbar semântico (atenção), sempre com o rótulo escrito.
        if (!continuation && isRecurring) {
          const titleW = doc.getTextWidth(`Ação ${String(cardNumber).padStart(2, '0')}`);
          const tagText = 'REINCIDENTE';
          doc.setFont(FB, 'bold');
          doc.setFontSize(6.6);
          const tagW = doc.getTextWidth(tagText) + 6;
          const tagX = cardInnerX + titleW + 5;
          doc.setFillColor(251, 241, 222);
          doc.roundedRect(tagX, y + 4.4, tagW, 5.6, 1.8, 1.8, 'F');
          doc.setTextColor(174, 119, 20);
          doc.text(tagText, tagX + 3, y + 8.4);
        }

        // Pílula de prazo + responsável: borda leve, tinta escura, prazo em destaque.
        if (!continuation) {
          doc.setFont(FB, 'bold');
          doc.setFontSize(8);
          const chipWidth = Math.min(82, doc.getTextWidth(chipText) + 9);
          const chipX = pageW - margin - chipWidth - 5;
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(...borderColor);
          doc.setLineWidth(0.3);
          doc.roundedRect(chipX, y + 3, chipWidth, 9, 2.5, 2.5, 'FD');
          doc.setTextColor(...ink);
          doc.text(chipText, chipX + 4.5, y + 8.8);
        }
      };

      if (cardHeight <= fullPageCardHeight) {
        drawCardFrame(cardHeight);
        let cardY = y + 19;
        for (const block of blocks) cardY = drawBlock(block, cardY);
        y += cardHeight + 6;
        return;
      }

      blocks.forEach((block, blockIndex) => {
        const continuation = blockIndex > 0;
        let drawn = block;
        let blockHeight = 34 + drawn.contentHeight + (drawn.isRequirement ? 5 : 0);
        // Bloco que não cabe nem sozinho numa página: os retângulos são o que
        // sobra para cortar — o texto tem de sair inteiro de qualquer jeito.
        if (blockHeight > fullPageCardHeight && drawn.boxes.length > 0) {
          drawn = measureBlock(block.label, block.text, block.color, {
            isRequirement: block.isRequirement,
            task: block.task,
            plain: true,
          });
          blockHeight = 34 + drawn.contentHeight + (drawn.isRequirement ? 5 : 0);
        }
        if (continuation || y + blockHeight > pageBottom) {
          drawPlanContinuation();
          drawGroupHeading(true);
        }
        drawCardFrame(blockHeight, continuation);
        drawBlock(drawn, y + 19);
        y += blockHeight + 6;
      });
    });
  };

  drawActionCards('Urgentes — itens críticos', urgentItems, [176, 42, 42], '15 dias');
  drawActionCards('Importantes — necessários', importantItems, [174, 119, 20], '60 dias');

  // Summary of Conformance — visão por categoria/área (não deixa a página vazia)
  if (y > pageH - 80) { doc.addPage(); y = margin; }
  doc.setFont(FH, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(21, 115, 71);
  doc.text('Grupo 3 — itens em conformidade', margin, y);
  y += 6;
  doc.setFont(FB, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
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
      styles: { font: FB },
      startY: y,
      head: [['Área inspecionada', 'Conformes', 'Avaliados', '% Conformidade']],
      body: conformanceRows.map(r => [r.title, r.complies, r.evaluated, `${r.pct}%`]),
      foot: [['TOTAL', score.compliesCount, overallEvaluated, `${overallPct}%`]],
      // footStyles repete cellPadding/valign do corpo — sem isso o TOTAL sai torto.
      headStyles: { fillColor: [31, 157, 87], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2.2, valign: 'middle' },
      footStyles: { fillColor: [220, 252, 231], fontStyle: 'bold', fontSize: 8.5, textColor, cellPadding: 2.2, valign: 'middle' },
      bodyStyles: { fontSize: 8.5, textColor, cellPadding: 2.2, valign: 'middle' },
      alternateRowStyles: { fillColor: surfaceColor },
      columnStyles: {
        0: { cellWidth: 96 },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        // Cabeçalho/rodapé precisam do mesmo alinhamento das colunas (o autoTable
        // não propaga columnStyles.halign para eles); senão o número foge do título.
        if (data.section === 'head' || data.section === 'foot') {
          data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
        }
        if ((data.section === 'body' || data.section === 'foot') && data.column.index === 3) {
          const pctValue = parseInt(String(data.cell.raw)) || 0;
          data.cell.styles.textColor = pctValue >= 85 ? greenInk : pctValue >= 70 ? amberStrong : redInk;
        }
      },
      margin: { left: margin, right: margin },
      theme: 'plain',
    });
    y = fimDaUltimaTabela(doc) + 12;
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
    doc.setFont(FB,'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text('RELAÇÃO DOS ITENS CUMPRIDOS', margin, y);
    y += 5;
    doc.setFont(FB,'normal');
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
        styles: { font: FB },
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
      y = fimDaUltimaTabela(doc) + 6;
    });
    y += 6;
  }

  if (inspection.observations) {
    if (y + 16 > flowBottom) { doc.addPage(); y = margin; }
    doc.setFont(FB,'bold');
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
      doc.setFont(FH, 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...ink);
      doc.text(`Não conformidades identificadas${continuation ? ' — continuação' : ''}`, margin, y);
      y += 3;
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.5);
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
        doc.setFont(FB,'bold');
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

      // A orientação do roteiro é o critério objetivo do requisito — dimensão,
      // endereço na norma, enquadramento. Vem antes da situação encontrada
      // porque é contra ela que a situação é medida.
      if (item.guidance) {
        y = drawLabeledBlock('Critério da norma', item.guidance, y, mutedColor, continueItem);
      }

      if (response.situationDescription) {
        y = drawLabeledBlock('Situação encontrada', response.situationDescription, y, [153, 27, 27], continueItem);
      }

      if (response.correctiveAction) {
        y = drawLabeledBlock('Ação corretiva', response.correctiveAction, y, [21, 101, 52], continueItem, { task: true });
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
    doc.setFont(FB,'normal');
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
      doc.setFont(FH, 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...ink);
      doc.text(`Evidências apresentadas pelo cliente${continuation ? ' — continuação' : ''}`, margin, y);
      y += 3;
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);
      y += 7;
      doc.setFont(FB,'normal');
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
      doc.setFont(FH, 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...ink);
      doc.text(
        `Pontos de excelência e sugestões de melhoria${continuation ? ' — continuação' : ''}`,
        margin,
        y
      );
      y += 3;
      doc.setDrawColor(...accent);
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
        doc.setFont(FB,'bold');
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
  doc.setFont(FB,'normal');
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

    doc.setFillColor(...accentSoft);
    doc.rect(0, 0, sigPageW, 42, 'F');
    doc.setFillColor(...accent);
    doc.rect(0, 0, 4, 42, 'F');
    doc.setFont(FH, 'normal');
    doc.setFontSize(18);
    doc.setTextColor(...ink);
    doc.text('Encerramento e assinatura', sigMargin + 4, 22);
    doc.setFontSize(9);
    doc.setFont(FB,'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Declaramos que os dados acima refletem a situação encontrada na data da inspeção.', sigMargin + 4, 34);

    let sigY = 60;
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.setFont(FB,'bold');
    doc.text('Consultora Responsável:', sigMargin, sigY);
    sigY += 7;
    doc.setFont(FB,'normal');
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
    doc.setFont(FB,'bold');
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
  const totalPagesAfter = doc.getNumberOfPages();
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
  allLegislations: VerbeteLegislacao[],
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
  const primaryColor: [number, number, number] = [36, 74, 155];  // #244A9B — azul da marca

  doc.addPage();

  // Header
  doc.setFillColor(234, 243, 252);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 4, 42, 'F');

  doc.setFont(FH, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(11, 31, 58);
  doc.text('Referências legislativas', margin + 4, 22);

  doc.setFontSize(9);
  doc.setFont(FB,'normal');
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
    doc.setFont(FB,'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, margin + 3, y + 0.5, { align: 'center' });

    // Reference text
    doc.setFont(FB,'normal');
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(abntRef, contentW - 14);
    doc.text(lines, margin + 10, y);
    y += lines.length * 5.5 + 5;

    // If has URL in library
    if (libraryMatch?.url) {
      doc.setFontSize(7.5);
      doc.setTextColor(15, 107, 120);
      doc.setFont(FB, 'italic');
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
  doc.setFont(FB, 'italic');
  doc.setTextColor(84, 101, 123);
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
  const primaryColor: [number, number, number] = [36, 74, 155];  // #244A9B — azul da marca

  doc.addPage();

  doc.setFillColor(234, 243, 252);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 4, 42, 'F');

  doc.setFont(FH, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(11, 31, 58);
  doc.text('Fontes consultadas', margin + 4, 22);

  doc.setFontSize(9);
  doc.setFont(FB,'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Fontes adicionais consultadas pela consultora durante a inspeção.', margin + 4, 34);

  const linkColor: [number, number, number] = [36, 74, 155];  // #244A9B — link da marca
  const textX = margin + 11;
  const textW = contentW - 11;
  const bottom = pageH - 22;
  let y = 58;

  sources.forEach((source, idx) => {
    const { label, hint } = describeUrl(source.url);

    doc.setFont(FB,'bold');
    doc.setFontSize(9.5);
    const titleLines: string[] = doc.splitTextToSize(source.title || label, textW);
    doc.setFont(FB,'normal');
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
    doc.setFont(FB,'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, margin + 3.5, y + 0.6, { align: 'center' });

    doc.setFont(FB,'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    titleLines.forEach((line) => {
      doc.text(line, textX, y);
      y += 5;
    });

    // Endereço clicável com rótulo legível — a URL crua de busca tinha centenas
    // de caracteres de rastreamento e tomava a página inteira.
    doc.setFont(FB,'normal');
    doc.setFontSize(8.6);
    linkLines.forEach((line, lineIdx) => {
      drawUrlLink(doc, line, textX, y + lineIdx * 4.6, source.url, linkColor);
    });
    y += linkLines.length * 4.6;

    if (hint) {
      doc.setFont(FB,'italic');
      doc.setFontSize(7.4);
      doc.setTextColor(107, 114, 128);
      doc.text(hint, textX, y + 0.6);
      y += 4;
    }

    if (noteLines.length) {
      y += 1.5;
      doc.setFont(FB,'normal');
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
 * A montagem mora em @visa/legislacao para que o PDF do InspecVISA e os documentos
 * do PastaVISA citem a mesma norma da mesma forma. Quando o verbete traz `abnt`
 * (referência completa, com data do ato e "Disponível em"), ela é usada como está.
 *
 * Sem verbete, a referência sai como o item a citou: sem autoria e sem ementa.
 * Some do relatório seria pior — o item cobra uma exigência e some a base dela.
 */
function formatABNT(mention: string, libraryEntry?: VerbeteLegislacao): string {
  if (!libraryEntry) return mention.trim();

  return formatAbntCompartilhado(mention, {
    name: libraryEntry.name,
    summary: libraryEntry.summary || '',
    url: libraryEntry.url || '',
    authority: libraryEntry.authority || '',
    abnt: libraryEntry.abnt || undefined,
    status: (libraryEntry.status as LegislationStatus) || 'nao_verificado',
    replacedBy: libraryEntry.replaced_by || libraryEntry.replacedBy || undefined,
  });
}
