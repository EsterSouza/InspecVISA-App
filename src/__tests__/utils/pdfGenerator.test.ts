import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { generatePDF } from '../../utils/pdfGenerator';
import { calculateScore } from '../../utils/scoring';
import type { ChecklistTemplate, ConsultantSettings, Inspection, InspectionResponse, ReferenceSource, Section } from '../../types';
import type { ClientEvidenceForItem } from '../../services/clientEvidenceService';

// jsPDF anexa `text` como propriedade própria da instância (via mixin da API),
// não no prototype — spyOn(jsPDF.prototype, 'text') não intercepta nada. Em vez
// disso, o módulo 'jspdf' é substituído por uma subclasse que captura cada
// string desenhada, preservando o comportamento real (a subclasse chama super()
// e delega para o `text` original).
const capturedTexts: string[] = [];
/** Cada string desenhada, com a largura que ela realmente ocupa na página. */
const drawnRuns: { text: string; x: number; right: number }[] = [];
/** URLs registradas como link clicável. */
const linkedUrls: string[] = [];
/** Áreas clicáveis registradas via `doc.link(x, y, w, h, { url })`. */
const linkedRects: { url: string }[] = [];

vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  class SpyingJsPDF extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      const originalText = this.text.bind(this);
      this.text = ((...textArgs: Parameters<typeof originalText>) => {
        const value = textArgs[0];
        const x = typeof textArgs[1] === 'number' ? textArgs[1] : 0;
        const record = (line: string) => {
          capturedTexts.push(line);
          // Mede com o estado de fonte vigente no momento do desenho: é onde
          // aparecia a divergência entre a largura usada para quebrar o texto e
          // o tamanho com que ele era realmente impresso.
          const align = (textArgs[3] as { align?: string } | undefined)?.align;
          if (line.trim() && !align) drawnRuns.push({ text: line, x, right: x + this.getTextWidth(line) });
        };
        if (Array.isArray(value)) {
          value.forEach(v => { if (typeof v === 'string') record(v); });
        } else if (typeof value === 'string') {
          record(value);
        }
        return originalText(...textArgs);
      }) as typeof originalText;

      const originalTextWithLink = this.textWithLink.bind(this);
      this.textWithLink = ((...linkArgs: Parameters<typeof originalTextWithLink>) => {
        const url = (linkArgs[3] as { url?: string } | undefined)?.url;
        if (url) linkedUrls.push(url);
        return originalTextWithLink(...linkArgs);
      }) as typeof originalTextWithLink;

      const originalLink = this.link.bind(this);
      this.link = ((...args: Parameters<typeof originalLink>) => {
        const url = (args[4] as { url?: string } | undefined)?.url;
        if (url) linkedRects.push({ url });
        return originalLink(...args);
      }) as typeof originalLink;
    }
  }
  return { ...actual, default: SpyingJsPDF };
});

const sections: Section[] = [
  {
    id: 's1',
    title: 'Documentação',
    order: 1,
    items: [
      { id: 'item-1', sectionId: 's1', order: 1, description: 'Possui licença sanitária vigente?', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
    ],
  },
];

const template: ChecklistTemplate = {
  id: 'tpl-1',
  name: 'Roteiro de Teste',
  category: 'estetica',
  version: '1',
  sections,
};

const responses: InspectionResponse[] = [
  {
    id: 'resp-1',
    inspectionId: 'insp-1',
    itemId: 'item-1',
    result: 'complies',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    syncStatus: 'synced',
  },
];

const inspection: Inspection = {
  id: 'insp-1',
  clientId: 'client-1',
  templateId: 'tpl-1',
  consultantName: 'Ester Caiafa',
  clientName: 'Cliente Teste',
  clientCategory: 'estetica',
  inspectionDate: new Date('2026-08-01T00:00:00.000Z'),
  status: 'in_progress',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  syncStatus: 'synced',
};

const settings: ConsultantSettings = {
  name: 'Ester Caiafa',
  theme: 'light',
};

describe('REF-03 - drawConsultedSources (via generatePDF)', () => {
  beforeEach(() => {
    capturedTexts.length = 0;
    // savePdfWithFallback usa APIs de navegador que o jsdom não implementa
    // (ou implementa com um aviso de "navigation not implemented" no clique do link).
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('não gera a seção "FONTES CONSULTADAS" quando não há fontes', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
    });

    expect(capturedTexts).not.toContain('Fontes consultadas');
  });

  test('gera a seção "FONTES CONSULTADAS" com título, URL e nota quando há fontes', async () => {
    const referenceSources: ReferenceSource[] = [
      { id: 'src-1', url: 'https://www.gov.br/anvisa/nota-tecnica', title: 'Nota técnica ANVISA', note: 'consultado em 05/08/2026' },
    ];
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
      referenceSources,
    });

    expect(capturedTexts).toContain('Fontes consultadas');
    expect(capturedTexts).toContain('Nota técnica ANVISA');
    // O endereço vira texto clicável, sem o "Disponível em: <...>" que só servia
    // para o papel e ocupava linhas inteiras de rastreamento.
    expect(capturedTexts).toContain('www.gov.br/anvisa/nota-tecnica');
    expect(linkedUrls).toContain('https://www.gov.br/anvisa/nota-tecnica');
    expect(capturedTexts).toContain('consultado em 05/08/2026');
  });

  // REF-07: a autoria da citação passou a vir só do verbete curado. Antes, uma
  // norma sem verbete era citada assim mesmo, com autoria deduzida por regex —
  // era isso que fazia "Critério técnico de higiene das mãos" virar
  // "BRASIL. Critério técnico de higiene das mãos." na página de referências.
  test('norma sem verbete na biblioteca fica fora de REFERÊNCIAS LEGISLATIVAS', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
    });

    expect(capturedTexts).not.toContain('Referências legislativas');
  });

  test('norma com verbete é citada com a autoria curada, não deduzida', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [
      {
        name: 'RDC Anvisa nº 63/2011',
        authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
        summary: 'Boas Práticas de Funcionamento para os Serviços de Saúde',
        url: 'https://exemplo.gov.br/rdc63',
        status: 'vigente',
      },
    ], { selectedLegislations: ['RDC 63/2011'] });

    expect(capturedTexts).toContain('Referências legislativas');
    expect(capturedTexts.some(t =>
      t.includes('BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA). RDC Anvisa nº 63/2011.')
    )).toBe(true);
  });

  test('botão do portal aparece na capa quando há link público', async () => {
    linkedRects.length = 0;
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
      portalUrl: 'https://app.exemplo.com/cliente/visita/token-abc',
    });

    expect(capturedTexts.some(t => t.includes('Ver relatório e plano de ação no portal'))).toBe(true);
    expect(linkedRects).toContainEqual({ url: 'https://app.exemplo.com/cliente/visita/token-abc' });
  });

  test('sem link público, a capa não ganha botão nenhum', async () => {
    linkedRects.length = 0;
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
    });

    expect(capturedTexts).not.toContain('Ver relatório e plano de ação no portal');
    expect(linkedRects).toHaveLength(0);
  });

  test('norma revogada é citada com a substituta, não como vigente', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [
      {
        name: 'RDC Anvisa nº 306/2004',
        authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
        summary: 'Gerenciamento de resíduos de serviços de saúde',
        status: 'revogada',
        replaced_by: 'RDC Anvisa nº 222/2018',
      },
    ], { selectedLegislations: ['RDC 306/2004'] });

    expect(capturedTexts.some(t =>
      t.includes('[REVOGADA — substituída por RDC Anvisa nº 222/2018.]')
    )).toBe(true);
  });
});

describe('relação dos itens cumpridos', () => {
  beforeEach(() => {
    capturedTexts.length = 0;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Antes, o bloco "ITENS EM CONFORMIDADE" era só a tabela de percentual por
  // área: um item cumprido sem observação nenhuma não aparecia em lugar algum do
  // relatório. O cliente lia só o que faltava.
  const sectionsMistas: Section[] = [
    {
      id: 's1',
      title: 'Documentação',
      order: 1,
      items: [
        { id: 'ok-1', sectionId: 's1', order: 1, description: 'Possui licença sanitária vigente?', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
        { id: 'ok-2', sectionId: 's1', order: 2, description: 'Mantém POPs assinados pelo RT?', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
        { id: 'nc-1', sectionId: 's1', order: 3, description: 'Registra temperatura das câmaras?', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
      ],
    },
  ];

  test('lista o item cumprido mesmo sem observação registrada', async () => {
    const respostasMistas: InspectionResponse[] = [
      { ...responses[0], id: 'r-ok-1', itemId: 'ok-1', result: 'complies' },
      { ...responses[0], id: 'r-ok-2', itemId: 'ok-2', result: 'complies' },
      { ...responses[0], id: 'r-nc-1', itemId: 'nc-1', result: 'not_complies' },
    ];
    const score = calculateScore(respostasMistas, sectionsMistas);

    await generatePDF(
      inspection,
      respostasMistas,
      { ...template, sections: sectionsMistas },
      score,
      settings,
      []
    );

    expect(capturedTexts).toContain('RELAÇÃO DOS ITENS CUMPRIDOS');
    expect(capturedTexts.some(t => t.includes('Documentação — 2 item(ns) em conformidade'))).toBe(true);
    expect(capturedTexts).toContain('C-001');
    expect(capturedTexts).toContain('C-002');
    expect(capturedTexts.some(t => t.includes('Mantém POPs assinados pelo RT?'))).toBe(true);
    // O item não conforme continua fora desta relação (tem seu próprio bloco).
    expect(capturedTexts).not.toContain('C-003');
  });

  // "Regularizado" só faz sentido com histórico: recurringItemIds vem vazio
  // quando o cliente não tem inspeção anterior concluída.
  test('marca como regularizado o item que estava em NC na visita anterior', async () => {
    const respostasMistas: InspectionResponse[] = [
      { ...responses[0], id: 'r-ok-1', itemId: 'ok-1', result: 'complies' },
      { ...responses[0], id: 'r-ok-2', itemId: 'ok-2', result: 'complies' },
    ];
    const score = calculateScore(respostasMistas, sectionsMistas);

    await generatePDF(
      inspection,
      respostasMistas,
      { ...template, sections: sectionsMistas },
      score,
      settings,
      [],
      { recurringItemIds: new Set(['ok-2']) }
    );

    expect(capturedTexts).toContain('Regularizado');
    // A legenda é quebrada em linhas pelo splitTextToSize — junta antes de checar.
    expect(capturedTexts.join(' ')).toContain('estava em não conformidade em visita anterior');
  });

  test('sem inspeção anterior, nenhum item é marcado como regularizado', async () => {
    const respostasMistas: InspectionResponse[] = [
      { ...responses[0], id: 'r-ok-1', itemId: 'ok-1', result: 'complies' },
    ];
    const score = calculateScore(respostasMistas, sectionsMistas);

    await generatePDF(inspection, respostasMistas, { ...template, sections: sectionsMistas }, score, settings, []);

    expect(capturedTexts).toContain('RELAÇÃO DOS ITENS CUMPRIDOS');
    expect(capturedTexts).not.toContain('Regularizado');
  });

  test('não desenha a relação quando nada foi cumprido', async () => {
    const somenteNC: InspectionResponse[] = [
      { ...responses[0], id: 'r-nc-1', itemId: 'nc-1', result: 'not_complies' },
    ];
    const score = calculateScore(somenteNC, sectionsMistas);

    await generatePDF(
      inspection,
      somenteNC,
      { ...template, sections: sectionsMistas },
      score,
      settings,
      []
    );

    expect(capturedTexts).not.toContain('RELAÇÃO DOS ITENS CUMPRIDOS');
  });
});

describe('REL-02 - formatação dos itens do relatório', () => {
  const margin = 20;
  const contentW = 210 - margin * 2;

  beforeEach(() => {
    capturedTexts.length = 0;
    drawnRuns.length = 0;
    linkedUrls.length = 0;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Uma NC com pergunta longa, texto maior que a página e link de busca: é a
  // combinação que produzia título fora da caixa, texto sobre o rodapé e uma
  // parede de URL crua.
  const perguntaLonga = 'Apresenta relação atualizada dos profissionais, com função, habilitação e registro profissional junto ao respectivo conselho de classe?';
  const buscaGoogle = 'https://www.google.com/search?client=opera-gx&hs=PLh&sca_esv=709ba7c645caa973&sxsrf=AePnu8f2ibe9_0UyABUMuMuCJ2sYtrkw:1785938747934&q=gaveta+bau+de+ch%C3%A3o+para+guarda+vassoura&source=lnms&sa=X&ved=2ahUKEwjS2qSl1ImWAxVDrpUCHZ58PHsQ0pQJegQICxAB&biw=1875&bih=958&dpr=1';
  const textoLongo = Array.from(
    { length: 22 },
    (_, i) => `- Ponto ${i + 1}: revisar o procedimento, registrar a evidência em ata assinada pelo responsável técnico e arquivar na pasta sanitária, mantendo cópia digital para eventual fiscalização.`
  ).join('\n');

  const sectionsLongas: Section[] = [
    {
      id: 's1',
      title: 'Documentação',
      order: 1,
      items: [
        { id: 'nc-longa', sectionId: 's1', order: 1, description: perguntaLonga, legislation: 'RDC Anvisa nº 63/2011, arts. 29 e 30', weight: 10, isCritical: true },
        { id: 'nc-2', sectionId: 's1', order: 2, description: 'A sala de procedimentos possui uso, identificação e dimensões compatíveis com as atividades executadas?', legislation: 'RDC Anvisa nº 50/2002', weight: 5, isCritical: true },
      ],
    },
  ];

  const respostasLongas: InspectionResponse[] = [
    {
      ...responses[0],
      id: 'r-nc-longa',
      itemId: 'nc-longa',
      result: 'not_complies',
      situationDescription: 'Não apresentaram listagem dos profissionais que executam serviços dentro do estabelecimento.',
      correctiveAction: textoLongo,
      links: [buscaGoogle],
    },
    {
      ...responses[0],
      id: 'r-nc-2',
      itemId: 'nc-2',
      result: 'not_complies',
      situationDescription: 'Nenhum dos ambientes e salas são identificados.',
      correctiveAction: 'Providenciar identificação para as portas das salas.',
    },
  ];

  const gerar = async () => {
    const score = calculateScore(respostasLongas, sectionsLongas);
    await generatePDF(
      inspection,
      respostasLongas,
      { ...template, sections: sectionsLongas },
      score,
      settings,
      []
    );
  };

  test('nenhuma linha desenhada passa da margem direita', async () => {
    await gerar();

    // O título era quebrado com 10,5pt e impresso com o 13pt herdado do cabeçalho
    // de continuação — e vazava a caixa em mais de 10 mm.
    const vazando = drawnRuns.filter(run => run.right > margin + contentW + 0.5);
    expect(vazando).toEqual([]);
  });

  test('o link vira rótulo legível e clicável, sem a URL crua', async () => {
    await gerar();

    expect(linkedUrls).toContain(buscaGoogle);
    expect(capturedTexts).toContain('Busca no Google: "gaveta bau de chão para guarda vassoura"');
    expect(capturedTexts.some(t => t.includes('sca_esv') || t.includes('&ved='))).toBe(false);
  });

  test('o item que transborda a página se identifica na retomada', async () => {
    await gerar();

    expect(capturedTexts).toContain('Não conformidades identificadas — continuação');
    expect(capturedTexts).toContain('NC-001 (continuação)');
    // Nada do texto longo é perdido: a última linha do bloco chega ao PDF.
    expect(capturedTexts.some(t => t.includes('Ponto 22'))).toBe(true);
  });
});

describe('REF-02 - referências legislativas do relatório', () => {
  beforeEach(() => {
    capturedTexts.length = 0;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Até o REF-02, pdfGenerator.ts tinha uma cópia própria e defasada de
  // extractBaseLegislation: sem o qualificador "Municipal" corrigido no REF-01,
  // cada artigo citado virava uma referência diferente. Uma inspeção de ILPI em
  // Senador Canedo listava a mesma lei cinco vezes na página de referências.
  const sectionsMunicipais: Section[] = [
    {
      id: 's1',
      title: 'Habilitação',
      order: 1,
      items: [
        { id: 'm-1', sectionId: 's1', order: 1, description: 'Possui alvará?', legislation: 'Art. 276, Lei Municipal 1.812/2014', weight: 10, isCritical: true },
        { id: 'm-2', sectionId: 's1', order: 2, description: 'Possui RT?', legislation: 'Art. 277, Lei Municipal 1.812/2014', weight: 10, isCritical: true },
        { id: 'm-3', sectionId: 's1', order: 3, description: 'Possui registro?', legislation: 'Art. 289, Lei Municipal 1.812/2014', weight: 10, isCritical: true },
      ],
    },
  ];

  test('artigos diferentes da mesma lei municipal viram uma única referência', async () => {
    const respostasMunicipais: InspectionResponse[] = sectionsMunicipais[0].items.map((item, i) => ({
      ...responses[0],
      id: `resp-m-${i}`,
      itemId: item.id,
    }));
    const score = calculateScore(respostasMunicipais, sectionsMunicipais);

    await generatePDF(
      inspection,
      respostasMunicipais,
      { ...template, sections: sectionsMunicipais },
      score,
      settings,
      [
        {
          name: 'Lei Municipal nº 1.812/2014 - Senador Canedo',
          authority: 'SENADOR CANEDO (GO)',
          summary: 'Código de posturas e vigilância sanitária do município',
          status: 'vigente',
        },
      ]
    );

    // Só as entradas da página de referências. A base legal também é impressa na
    // relação de itens cumpridos, uma vez por item.
    const referencias = capturedTexts.filter(t => t.includes('SENADOR CANEDO') && t.includes('1.812'));
    expect(referencias).toHaveLength(1);
    expect(capturedTexts).not.toContain('Art. 276');
  });
});

describe('REL-03 - evidência do cliente no relatório final', () => {
  beforeEach(() => {
    capturedTexts.length = 0;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function evidence(overrides: Partial<ClientEvidenceForItem> = {}): ClientEvidenceForItem {
    return {
      itemId: 'item-1',
      evidenceId: 'ev-1',
      status: 'approved',
      fileName: 'protocolo.pdf',
      mimeType: 'application/pdf',
      clientNote: 'Protocolo de renovacao aberto na VISA em 12/07.',
      reviewNote: 'Documento aceito.',
      byName: 'Joana Prado',
      byRole: 'Gestora da unidade',
      submittedAt: '2026-07-15T12:00:00.000Z',
      reviewedAt: '2026-07-16T12:00:00.000Z',
      storageBucket: 'client-action-evidence',
      storagePath: 'tenant/cliente/item/arquivo.pdf',
      itemStatus: 'resolved',
      ...overrides,
    };
  }

  const naoConforme: InspectionResponse[] = [
    {
      id: 'resp-nc',
      inspectionId: 'insp-1',
      itemId: 'item-1',
      result: 'not_complies',
      situationDescription: 'Alvara continua vencido.',
      correctiveAction: 'Protocolar a renovacao.',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      syncStatus: 'synced',
    },
  ];

  test('sem evidência o relatório sai igual ao de antes', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, []);

    expect(capturedTexts).not.toContain('Evidência apresentada pelo cliente');
    expect(capturedTexts).not.toContain('Evidências apresentadas pelo cliente');
  });

  test('item que voltou a ser NC leva a alegação do cliente junto do achado', async () => {
    const score = calculateScore(naoConforme, sections);
    await generatePDF(inspection, naoConforme, template, score, settings, [], {
      recurringItemIds: new Set(['item-1']),
      clientEvidenceByItemId: new Map([['item-1', [evidence()]]]),
    });

    expect(capturedTexts).toContain('Evidência apresentada pelo cliente');
    const corrido = capturedTexts.join(' ');
    // Quem assinou, quando, o que alegou e qual foi o parecer — é isso que sustenta o laudo.
    expect(corrido).toMatch(/Joana Prado/);
    expect(corrido).toMatch(/Gestora da unidade/);
    expect(corrido).toMatch(/aprovada pela consultoria/);
    expect(corrido).toMatch(/Protocolo de renovacao aberto na VISA/);
    expect(corrido).toMatch(/Parecer da consultoria: Documento aceito/);
    // E o item continua sendo NC nesta visita: o anexo não concluiu nada.
    expect(capturedTexts).toContain('Não conformidades identificadas');
  });

  test('item já regularizado ganha seção própria, sem se misturar com as NCs', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      recurringItemIds: new Set(['item-1']),
      clientEvidenceByItemId: new Map([['item-1', [evidence()]]]),
    });

    expect(capturedTexts).toContain('Evidências apresentadas pelo cliente');
    expect(capturedTexts).toContain('EV-001');
    expect(capturedTexts).toContain('REGULARIZADO');
    // A frase que impede a leitura errada: quem conclui é a vistoria, não o anexo.
    expect(capturedTexts.join(' ')).toMatch(/não a resposta nem o recebimento do arquivo/);
  });

  test('evidência sem revisão e devolvida aparecem com o estado correto', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      clientEvidenceByItemId: new Map([['item-1', [
        evidence({ evidenceId: 'ev-2', status: 'pending', reviewNote: null }),
        evidence({ evidenceId: 'ev-3', status: 'changes_requested', reviewNote: 'Ilegivel, reenvie.' }),
      ]]]),
    });

    const corrido = capturedTexts.join(' ');
    expect(corrido).toMatch(/recebida, sem revisão técnica/);
    expect(corrido).toMatch(/devolvida para ajuste/);
    expect(corrido).toMatch(/Ilegivel, reenvie/);
  });

  test('envio sem assinatura antiga não quebra o relatório', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      clientEvidenceByItemId: new Map([['item-1', [evidence({ byName: null, byRole: null })]]]),
    });

    expect(capturedTexts.join(' ')).toMatch(/não identificado/);
  });

  test('item com evidência que não existe no roteiro é ignorado, não quebra', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      clientEvidenceByItemId: new Map([['item-que-sumiu-do-roteiro', [evidence({ itemId: 'item-que-sumiu-do-roteiro' })]]]),
    });

    expect(capturedTexts).not.toContain('Evidências apresentadas pelo cliente');
  });
});
