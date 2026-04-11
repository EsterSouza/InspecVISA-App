import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Use a robust CDN worker URL that matches the bundled version precisely
// If this fails, the catch block in the importer will handle it
const PDF_WORKER_URL = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

export interface ParsedItem {
  section: string;
  description: string;
  legislation?: string;
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
