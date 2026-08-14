import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PdfPreviewModal } from '../../components/inspection/PdfPreviewModal';
import type { Legislation } from '../../services/legislationService';
import type { ChecklistTemplate, Inspection, InspectionResponse } from '../../types';

// REF-07: o passo 1 do modal alimentava a página de referências do PDF com tudo
// que casasse UF+segmento na biblioteca, pré-marcado, mesmo sem nenhum item citar.
// O relatório saía citando norma que a inspeção não avaliou.

const template = {
  id: 'tpl',
  sections: [{
    id: 's1',
    items: [
      { id: 'i1', legislation: 'RDC 63/2011' },
      { id: 'i2', legislation: 'Critério técnico de higiene das mãos' },
      { id: 'i3', legislation: 'RDC 222/2018' },
      { id: 'i4', legislation: 'RDC 15/2012' },
    ],
  }],
} as unknown as ChecklistTemplate;

const library: Legislation[] = [
  {
    id: '1', name: 'RDC Anvisa nº 63/2011', authority: 'BRASIL. ANVISA',
    uf: null, segments: ['estetica'], status: 'vigente', created_at: '2026-01-01',
  },
  {
    id: '2', name: 'Resolução SES/RJ nº 1.822/2019', authority: 'RIO DE JANEIRO (Estado)',
    uf: 'RJ', segments: ['estetica'], status: 'vigente', created_at: '2026-01-01',
  },
  // Casa por substring com "RDC 15/2012"; a chave canônica não deixa confundir.
  {
    id: '3', name: 'RDC Anvisa nº 156/2006', authority: 'BRASIL. ANVISA',
    uf: null, segments: ['estetica'], status: 'vigente', created_at: '2026-01-01',
  },
];

const inspection = { id: 'insp', state: 'Rio de Janeiro', clientCategory: 'estetica' } as Inspection;

function renderModal(responses: InspectionResponse[]) {
  return render(
    <PdfPreviewModal
      open
      onClose={() => {}}
      template={template}
      responses={responses}
      inspection={inspection}
      legislationLibrary={library}
      onGenerate={async () => {}}
      isGenerating={false}
    />
  );
}

const resposta = (itemId: string) => ({ id: `r-${itemId}`, itemId, result: 'conforme' }) as InspectionResponse;

const porEstado = (pressed: boolean) =>
  screen.queryAllByRole('button', { pressed }).map(b => b.textContent?.replace(/(Estadual\/Municipal|Sugestão)$/, '').trim());
const marcadas = () => porEstado(true);
const desmarcadas = () => porEstado(false);

describe('REF-07 — passo de referências do PdfPreviewModal', () => {
  test('só a norma do item avaliado vem marcada; a da UF vem como sugestão', () => {
    renderModal([resposta('i1')]);

    expect(screen.getByText('Sugestões para esta UF e segmento')).toBeInTheDocument();
    expect(marcadas()).toEqual(['RDC Anvisa nº 63/2011']);
    // As da UF e do segmento continuam ofertadas, mas desmarcadas — nada entra no
    // PDF sem escolha explícita.
    expect(desmarcadas()).toEqual(['RDC Anvisa nº 156/2006', 'Resolução SES/RJ nº 1.822/2019']);
  });

  test('norma sem verbete é avisada, não citada', () => {
    renderModal([resposta('i2'), resposta('i3')]);

    expect(screen.getByText('Sem fonte cadastrada — fora do PDF')).toBeInTheDocument();
    expect(screen.getByText('• Critério técnico de higiene das mãos')).toBeInTheDocument();
    expect(screen.getByText('• RDC 222/2018')).toBeInTheDocument();
    // Nenhuma das duas entra marcada: sem verbete não há autoria nem link.
    expect(marcadas()).toEqual([]);
  });

  test('não confunde RDC 15/2012 com RDC 156/2006', () => {
    // O casamento era por substring nos dois sentidos: "RDC 15/2012" achava o
    // verbete da "RDC 156/2006" e o relatório citava a norma errada, com o nome
    // e o link errados. A chave canônica não deixa.
    renderModal([resposta('i4')]);

    expect(marcadas()).toEqual([]);
    expect(screen.getByText('• RDC 15/2012')).toBeInTheDocument();
  });
});
