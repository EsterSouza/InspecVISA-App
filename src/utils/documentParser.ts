import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedItem {
  section: string;
  description: string;
  legislation?: string;
  weight?: number;
  isCritical?: boolean;
}

export class DocumentParser {
  /**
   * Extrai texto de um arquivo PDF
   */
  static async parsePDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: true,
        isEvalSupported: false 
      });
      
      const pdf = await loadingTask.promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
         const page = await pdf.getPage(i);
         const content = await page.getTextContent();
         const strings = content.items.map((item: any) => item.str);
         fullText += strings.join(' ') + '\n';
      }

      return fullText;
    } catch (err) {
      console.error('PDF Parsing Failure:', err);
      // Fallback: try to read without worker if possible (unlikely in browser but better error reporting)
      throw new Error(`Falha ao ler PDF: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Extrai texto de um arquivo Word (.docx)
   */
  static async parseWord(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  static async parseTextFile(file: File): Promise<string> {
    return file.text();
  }

  static parseTypeScript(text: string): ParsedItem[] {
    const lines = text.split('\n');
    const sectionById = new Map<string, string>();
    let pendingTargetSectionId = '';
    let pendingSectionId = '';

    for (const line of lines) {
      const sectionId = line.match(/targetSectionId:\s*['"`]([^'"`]+)['"`]/)?.[1];
      const targetTitle = line.match(/targetSectionTitle:\s*['"`]([^'"`]+)['"`]/)?.[1];
      if (sectionId) pendingTargetSectionId = sectionId;
      if (targetTitle && pendingTargetSectionId) sectionById.set(pendingTargetSectionId, targetTitle);

      const id = line.match(/\bid:\s*['"`]([^'"`]+)['"`]/)?.[1];
      const title = line.match(/\btitle:\s*['"`]([^'"`]+)['"`]/)?.[1];
      if (id && id.startsWith('sec-')) pendingSectionId = id;
      if (title && pendingSectionId) sectionById.set(pendingSectionId, title);
    }

    const items: ParsedItem[] = [];
    let currentSection = 'Geral';
    let pending: ParsedItem | null = null;

    for (const line of lines) {
      const sectionId = line.match(/sectionId:\s*['"`]([^'"`]+)['"`]/)?.[1];
      if (sectionId) currentSection = sectionById.get(sectionId) || currentSection;

      const title = line.match(/\btitle:\s*['"`]([^'"`]+)['"`]/)?.[1];
      if (title) currentSection = title;

      const targetTitle = line.match(/targetSectionTitle:\s*['"`]([^'"`]+)['"`]/)?.[1];
      if (targetTitle) currentSection = targetTitle;

      const description = line.match(/description:\s*(['"`])(.+?)\1/)?.[2];
      if (description) {
        if (pending) items.push(pending);
        pending = {
          section: sectionId ? sectionById.get(sectionId) || currentSection : currentSection,
          description,
        };
      }

      const legislation = line.match(/legislation:\s*(['"`])(.+?)\1/)?.[2];
      if (legislation && pending) pending.legislation = legislation;

      const weight = line.match(/weight:\s*(\d+)/)?.[1];
      if (weight && pending) pending.weight = Number(weight);

      const isCritical = line.match(/isCritical:\s*(true|false)/)?.[1];
      if (isCritical && pending) pending.isCritical = isCritical === 'true';
    }

    if (pending) items.push(pending);
    return items;
  }

  /**
   * Tenta estruturar o texto bruto em itens de inspeção
   */
  static heuristicParse(text: string): ParsedItem[] {
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5);

    const items: ParsedItem[] = [];
    let currentSection = 'Geral';

    lines.forEach(line => {
      // Tenta identificar se a linha é um título de seção
      // Padrão: Curta (<80 chars), Tudo em Caps, ou começa com número romano/ordinal
      const isHeader = (line.length < 80 && (line === line.toUpperCase()) && !line.includes(':')) || 
                       /^(I|II|III|IV|V|X|[0-9])[\.\-\)]/.test(line);

      if (isHeader) {
        currentSection = line;
        return;
      }

      // Procura possíveis referências legislativas (RDC, Lei, Portaria, CVS, Decreto, Resolução)
      const legMatch = line.match(/(RDC|LEI|PORTARIA|DECRETO|CVS|RESOLUÇÃO|IN)\s(Nº\s?)?\d+[\/\d]*/i);
      
      items.push({
        section: currentSection,
        description: line,
        legislation: legMatch ? legMatch[0].toUpperCase() : undefined
      });
    });

    return items;
  }
}
