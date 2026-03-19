# PROMPT COMPLETO — APP DE INSPEÇÃO SANITÁRIA
## Para uso no Google Antigravity (colar como missão inicial do agente)

---

## CONTEXTO DO PROJETO

Você vai construir um **Progressive Web App (PWA) offline-first** de roteiro de inspeção sanitária para uso interno de duas consultoras. O app deve funcionar sem internet em tablet, celular e computador (via navegador web). Não é um produto para venda — é uma ferramenta interna de trabalho de campo.

**Quem vai usar:**
- Consultora 1 — área de saúde: estética, beleza e ILPI (Instituição de Longa Permanência para Idosos)
- Consultora 2 — área de alimentos

**O que o app precisa fazer na essência:**
Durante uma visita ao cliente, a consultora abre o app no tablet/celular (sem internet), percorre o roteiro de inspeção item por item, marca se cada item cumpre ou não cumpre a legislação, fotografa as não conformidades, registra o que está errado e o que precisa ser feito, e ao final gera um relatório PDF profissional para entregar ao cliente — tudo sem precisar fazer nenhum trabalho em casa depois.

---

## STACK TÉCNICA OBRIGATÓRIA

```
Frontend:   React 18 + TypeScript + Vite
Estilo:     Tailwind CSS
PWA:        Vite PWA Plugin (vite-plugin-pwa) com Workbox
Offline DB: Dexie.js (wrapper IndexedDB) — armazenamento local de inspeções e fotos
PDF:        jsPDF + jspdf-autotable (geração 100% no cliente, sem servidor)
Ícones:     Lucide React
Roteamento: React Router v6
Estado:     Zustand
Banco nuvem (fase 2, não implementar agora): Supabase
```

**Requisito crítico de PWA:** O app deve ser instalável no celular/tablet via "Adicionar à tela inicial" e funcionar completamente offline após a primeira carga. Fotos capturadas precisam ser armazenadas em IndexedDB como base64 ou Blob, não em servidor externo no MVP.

---

## ESTRUTURA DE DADOS — IMPLEMENTAR EXATAMENTE ASSIM

### 1. Cliente (Client)
```typescript
interface Client {
  id: string;           // uuid gerado localmente
  name: string;         // Nome do estabelecimento
  cnpj?: string;
  address?: string;
  category: 'estetica' | 'ilpi' | 'alimentos';
  responsibleName?: string;
  phone?: string;
  email?: string;
  createdAt: Date;
}
```

### 2. Roteiro (Checklist Template)
```typescript
interface ChecklistTemplate {
  id: string;
  name: string;                 // ex: "Roteiro Estética - RDC 665/2022"
  category: 'estetica' | 'ilpi' | 'alimentos';
  version: string;
  sections: Section[];
}

interface Section {
  id: string;
  title: string;               // ex: "Estrutura Física"
  order: number;
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  sectionId: string;
  order: number;
  description: string;         // Texto do item conforme legislação
  legislation?: string;        // ex: "RDC 665/2022, Art. 12, §3º"
  legislationUrl?: string;     // Link para o texto legal (opcional)
  weight: number;              // Peso do item na pontuação (padrão: 1)
  isCritical: boolean;         // Itens críticos têm peso dobrado
}
```

### 3. Inspeção (Inspection)
```typescript
interface Inspection {
  id: string;
  clientId: string;
  templateId: string;
  consultantName: string;
  inspectionDate: Date;
  status: 'in_progress' | 'completed';
  observations?: string;       // Observações gerais finais
  createdAt: Date;
  completedAt?: Date;
  responses: InspectionResponse[];
}

interface InspectionResponse {
  id: string;
  inspectionId: string;
  itemId: string;
  result: 'complies' | 'not_complies' | 'not_applicable' | 'not_evaluated';
  situationDescription?: string;  // O que foi encontrado (não conformidade)
  correctiveAction?: string;       // O que precisa ser feito para corrigir
  photos: InspectionPhoto[];
  createdAt: Date;
  updatedAt: Date;
}

interface InspectionPhoto {
  id: string;
  responseId: string;
  dataUrl: string;             // base64 da foto
  caption?: string;
  takenAt: Date;
}
```

### 4. Pontuação calculada (não persistida, calculada em runtime)
```typescript
interface InspectionScore {
  totalItems: number;
  evaluatedItems: number;
  compliesCount: number;
  notCompliesCount: number;
  notApplicableCount: number;
  scorePercentage: number;           // % de conformidade geral
  scoreBySection: SectionScore[];
  classification: 'critical' | 'regular' | 'good' | 'excellent';
  // critical: < 50% | regular: 50–69% | good: 70–89% | excellent: ≥ 90%
}
```

---

## ROTEIROS REAIS — SEED DATA

**ATENÇÃO:** Os roteiros abaixo são os roteiros REAIS da C&C Consultoria Sanitária, convertidos diretamente dos documentos originais da consultora. NÃO substitua por exemplos genéricos. Copie o conteúdo abaixo EXATAMENTE como arquivo `src/data/templates.ts`.

- **Estética:** 114 itens reais em 12 seções — pesos e criticidade exatos da planilha original
- **ILPI:** 105 itens reais em 13 seções — classificação I/N/R do documento V.11/2024
- Regra de pesos: `Imprescindível → weight:10, isCritical:true` | `Necessário → weight:5` | `Recomendável → weight:2` | `Sugerido → weight:1`

```typescript
// ============================================================
// src/data/templates.ts
// ROTEIROS REAIS — C&C CONSULTORIA SANITÁRIA
// Gerado automaticamente a partir dos ROIs originais
// Estética: V. atual (114 itens) | ILPI: V.11/2024 (105 itens)
// ============================================================

import { ChecklistTemplate } from '../types';

export const templates: ChecklistTemplate[] = [

  // ════════════════════════════════════════════════════════════
  // TEMPLATE 1 — ESTÉTICA E BELEZA
  // Base: RDC 63/2011, RDC 15/2012, RDC 222/2018, RDC 751/2022,
  //       RDC 36/2013, RDC 50/2002, NR 32 e legislações complementares
  // ════════════════════════════════════════════════════════════
  {
    id: 'tpl-estetica-v1',
    name: 'Roteiro de Inspeção — Estética e Beleza',
    category: 'estetica',
    version: '2024',
    sections: [

      {
        id: 'sec-est-01',
        title: 'Documentação e Regularização',
        order: 1,
        items: [
          { id: 'est-001', sectionId: 'sec-est-01', order: 1,  description: 'Possui Alvará ou Licença Sanitária vigente, compatível com as atividades declaradas e afixada em local visível ao público.', legislation: 'Legislação Sanitária Federal e Local', weight: 10, isCritical: true },
          { id: 'est-002', sectionId: 'sec-est-01', order: 2,  description: 'Possui CNPJ e o CNAE é compatível com os serviços prestados.', legislation: 'Legislação Tributária e Sanitária', weight: 10, isCritical: true },
          { id: 'est-003', sectionId: 'sec-est-01', order: 3,  description: 'Possui Responsável Técnico (RT) de nível superior e legalmente habilitado, com comprovação de vínculo e certidão do conselho de classe.', legislation: 'Nota Técnica 02/2024/ANVISA; Resoluções de Conselhos Profissionais', weight: 10, isCritical: true },
          { id: 'est-004', sectionId: 'sec-est-01', order: 4,  description: 'Apresenta o Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS) implementado e seguido na prática.', legislation: 'RDC nº 222/2018', weight: 10, isCritical: true },
          { id: 'est-005', sectionId: 'sec-est-01', order: 5,  description: 'Apresenta o Plano de Segurança do Paciente (PSP) implantado, com os 6 protocolos básicos estabelecidos.', legislation: 'RDC nº 36/2013', weight: 10, isCritical: true },
          { id: 'est-006', sectionId: 'sec-est-01', order: 6,  description: 'Possui Manual de Rotinas e Procedimentos (ou Manual de Biossegurança) contemplando todos os processos e condutas em caso de acidentes.', legislation: 'RDC nº 63/2011; NR 32', weight: 10, isCritical: true },
          { id: 'est-007', sectionId: 'sec-est-01', order: 7,  description: 'Possui Procedimentos Operacionais Padrão (POPs) para todas as atividades críticas (limpeza, esterilização, uso de equipamentos, etc.).', legislation: 'RDC nº 63/2011', weight: 10, isCritical: true },
          { id: 'est-008', sectionId: 'sec-est-01', order: 8,  description: 'Apresenta prontuários dos pacientes preenchidos adequadamente, sem rasuras, com assinatura do profissional e arquivados de forma a garantir sigilo e segurança.', legislation: 'RDC 63/2011; LGPD', weight: 10, isCritical: true },
          { id: 'est-009', sectionId: 'sec-est-01', order: 9,  description: 'Apresenta Termo de Consentimento Livre e Esclarecido (TCLE) específico para cada procedimento invasivo realizado.', legislation: 'Resolução CNS nº 466/2012; Código de Ética Profissional', weight: 5, isCritical: false },
          { id: 'est-010', sectionId: 'sec-est-01', order: 10, description: 'Possui Projeto Básico de Arquitetura (PBA) ou Laudo Técnico de Avaliação (LTA) aprovado pela VISA, quando aplicável.', legislation: 'RDC nº 50/2002', weight: 10, isCritical: true },
          { id: 'est-011', sectionId: 'sec-est-01', order: 11, description: 'Apresenta relação formal de todos os profissionais que atuam no estabelecimento, com suas respectivas habilitações.', legislation: 'RDC 63/2011 art. 29 e 30', weight: 10, isCritical: true },
          { id: 'est-012', sectionId: 'sec-est-01', order: 12, description: 'Apresenta Memorial Descritivo detalhando todos os procedimentos, técnicas e tecnologias utilizadas no estabelecimento.', legislation: 'Boas Práticas de Gestão', weight: 5, isCritical: false },
          { id: 'est-013', sectionId: 'sec-est-01', order: 13, description: 'Apresenta uma lista formal de todos os equipamentos, incluindo marca, modelo e número de registro na ANVISA.', legislation: 'RDC 63/2011; RDC 751/2022', weight: 5, isCritical: false },
          { id: 'est-014', sectionId: 'sec-est-01', order: 14, description: 'Possui contratos e licenças sanitárias de todas as empresas terceirizadas (coleta de resíduos, controle de pragas, lavanderia, ar-condicionado etc.).', legislation: 'RDC nº 63/2011', weight: 10, isCritical: true },
          { id: 'est-015', sectionId: 'sec-est-01', order: 15, description: 'Possui processo de qualificação de fornecedores para insumos críticos, mantendo arquivada a documentação legal de cada um (Alvará Sanitário, AFE) e notas fiscais de compra.', legislation: 'Boas Práticas de Gestão', weight: 5, isCritical: false },
          { id: 'est-016', sectionId: 'sec-est-01', order: 16, description: 'Apresenta Laudo de Aterramento Elétrico para equipamentos de grande porte ou que emitam energia (ex: lasers, ultrassom).', legislation: 'NR 10; Manuais do Fabricante; ABNT NBR 13534', weight: 2, isCritical: false },
        ],
      },

      {
        id: 'sec-est-02',
        title: 'Saúde e Segurança do Trabalhador',
        order: 2,
        items: [
          { id: 'est-017', sectionId: 'sec-est-02', order: 1, description: 'Apresenta PCMSO (Programa de Controle Médico de Saúde Ocupacional), obrigatório para estabelecimentos com funcionários CLT.', legislation: 'NR-7', weight: 1, isCritical: false },
          { id: 'est-018', sectionId: 'sec-est-02', order: 2, description: 'Apresenta PGR (Programa de Gerenciamento de Riscos), incluindo Mapa de Risco do estabelecimento, obrigatório para estabelecimentos com funcionários CLT.', legislation: 'NR-1', weight: 1, isCritical: false },
          { id: 'est-019', sectionId: 'sec-est-02', order: 3, description: 'Possui registro de entrega de EPIs para todos os funcionários, com o devido Certificado de Aprovação (CA).', legislation: 'NR-6', weight: 1, isCritical: false },
          { id: 'est-020', sectionId: 'sec-est-02', order: 4, description: 'Apresenta comprovação de vacinação dos profissionais (ex: Hepatite B e Tétano) e controle de saúde (exame Anti-HBs).', legislation: 'NR-32', weight: 2, isCritical: false },
          { id: 'est-021', sectionId: 'sec-est-02', order: 5, description: 'Existe um programa de educação permanente documentado para todos os funcionários, com cronograma definido.', legislation: 'RDC 63/2011 art. 32', weight: 5, isCritical: false },
          { id: 'est-022', sectionId: 'sec-est-02', order: 6, description: 'Possui vestiário com armários individuais para guarda de pertences dos funcionários, e copa ou local para descanso e refeições.', legislation: 'NR 24; RDC 50/2002', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-est-03',
        title: 'Infraestrutura Física',
        order: 3,
        items: [
          { id: 'est-023', sectionId: 'sec-est-03', order: 1,  description: 'Pisos, paredes e tetos de todas as áreas são de material liso, lavável, impermeável e estão em bom estado de conservação.', legislation: 'RDC nº 50/2002', weight: 10, isCritical: true },
          { id: 'est-024', sectionId: 'sec-est-03', order: 2,  description: 'Todo o mobiliário (macas, bancadas, carrinhos, armários) é de material liso, lavável, impermeável, íntegro e resistente.', legislation: 'RDC nº 63/2011', weight: 10, isCritical: true },
          { id: 'est-025', sectionId: 'sec-est-03', order: 3,  description: 'As instalações (elétricas, hidráulicas) estão embutidas ou protegidas por calhas e em bom estado, sem fios expostos.', legislation: 'RDC nº 50/2002; NR-10', weight: 10, isCritical: true },
          { id: 'est-026', sectionId: 'sec-est-03', order: 4,  description: 'A iluminação e ventilação (natural ou artificial) são adequadas em todas as áreas, incluindo a sala de espera.', legislation: 'RDC nº 50/2002', weight: 10, isCritical: true },
          { id: 'est-027', sectionId: 'sec-est-03', order: 5,  description: 'Possui sanitários para funcionários e público, distintos, completos e em bom estado de funcionamento.', legislation: 'RDC nº 50/2002', weight: 10, isCritical: true },
          { id: 'est-028', sectionId: 'sec-est-03', order: 6,  description: 'A sala de procedimentos é exclusiva para este fim, com dimensões adequadas e devidamente identificada.', legislation: 'RDC nº 50/2002', weight: 10, isCritical: true },
          { id: 'est-029', sectionId: 'sec-est-03', order: 7,  description: 'Possui lavatório para higiene das mãos na sala de procedimento, de uso exclusivo, dotado de todos os insumos (sabonete, papel, lixeira com pedal).', legislation: 'RDC nº 63/2011; RDC 50/2002', weight: 10, isCritical: true },
          { id: 'est-030', sectionId: 'sec-est-03', order: 8,  description: 'Possui Depósito de Material de Limpeza (DML) com tanque e local exclusivo para guarda de saneantes.', legislation: 'RDC nº 50/2002', weight: 10, isCritical: true },
          { id: 'est-031', sectionId: 'sec-est-03', order: 9,  description: 'O estabelecimento está organizado, limpo e livre de materiais em desuso ou alheios à atividade.', legislation: 'Legislação Sanitária Local', weight: 10, isCritical: true },
          { id: 'est-032', sectionId: 'sec-est-03', order: 10, description: 'O estabelecimento promove acessibilidade para pessoas com deficiência ou mobilidade reduzida.', legislation: 'NBR 9050', weight: 10, isCritical: true },
          { id: 'est-033', sectionId: 'sec-est-03', order: 11, description: 'A área de recepção/espera é separada das áreas de procedimento e oferece condições de conforto e higiene.', legislation: 'RDC 50/2002', weight: 10, isCritical: true },
          { id: 'est-034', sectionId: 'sec-est-03', order: 12, description: 'As janelas das áreas críticas possuem tela milimétrica para proteção contra vetores.', legislation: 'RDC 50/2002', weight: 2, isCritical: false },
          { id: 'est-035', sectionId: 'sec-est-03', order: 13, description: 'Os ralos, se existentes em áreas críticas, possuem sistema de fechamento (grelha ou similar).', legislation: 'RDC 50/2002', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-est-04',
        title: 'Processamento de Artigos (CME)',
        order: 4,
        items: [
          { id: 'est-036', sectionId: 'sec-est-04', order: 1,  description: 'Possui Central de Material e Esterilização (CME) ou área de processamento com barreira física e fluxo unidirecional (sujo/limpo).', legislation: 'RDC nº 15/2012', weight: 10, isCritical: true },
          { id: 'est-037', sectionId: 'sec-est-04', order: 2,  description: 'A limpeza de instrumentais utiliza detergente enzimático regularizado na ANVISA, em cuba de imersão ou lavadora ultrassônica.', legislation: 'RDC nº 15/2012', weight: 10, isCritical: true },
          { id: 'est-038', sectionId: 'sec-est-04', order: 3,  description: 'A pia de lavagem de instrumentais (expurgo) é exclusiva para este fim, com cuba profunda e separada da área limpa.', legislation: 'RDC nº 15/2012; RDC 50/2002', weight: 10, isCritical: true },
          { id: 'est-039', sectionId: 'sec-est-04', order: 4,  description: 'A esterilização de artigos críticos é feita exclusivamente por autoclave com registro na ANVISA, instalada em bancada apropriada.', legislation: 'RDC nº 15/2012', weight: 10, isCritical: true },
          { id: 'est-040', sectionId: 'sec-est-04', order: 5,  description: 'Apresenta validação (qualificação de instalação, operação e desempenho) da autoclave, realizada por empresa especializada.', legislation: 'RDC 15/2012 art. 95-97', weight: 10, isCritical: true },
          { id: 'est-041', sectionId: 'sec-est-04', order: 6,  description: 'Realiza monitoramento do processo de esterilização com indicadores químicos (em todos os pacotes) e biológicos (frequência mínima semanal).', legislation: 'RDC nº 15/2012', weight: 10, isCritical: true },
          { id: 'est-042', sectionId: 'sec-est-04', order: 7,  description: 'Mantém registros de todos os ciclos de esterilização e dos testes de monitoramento, garantindo rastreabilidade.', legislation: 'RDC nº 15/2012', weight: 10, isCritical: true },
          { id: 'est-043', sectionId: 'sec-est-04', order: 8,  description: 'Os materiais esterilizados possuem etiqueta com data de esterilização, validade, lote e responsável pelo preparo.', legislation: 'RDC 15/2012 art. 83', weight: 10, isCritical: true },
          { id: 'est-044', sectionId: 'sec-est-04', order: 9,  description: 'O armazenamento de material estéril é feito em armário fechado, exclusivo, limpo, seco e de acesso restrito.', legislation: 'RDC nº 15/2012', weight: 10, isCritical: true },
          { id: 'est-045', sectionId: 'sec-est-04', order: 10, description: 'Os artigos de uso único são descartados após o uso, sendo proibido seu reprocessamento.', legislation: 'RDC nº 156/2006; RE 2605/2006', weight: 10, isCritical: true },
          { id: 'est-046', sectionId: 'sec-est-04', order: 11, description: 'As embalagens utilizadas para esterilização (grau cirúrgico) são apropriadas e regularizadas na ANVISA.', legislation: 'RDC 15/2012', weight: 10, isCritical: true },
          { id: 'est-047', sectionId: 'sec-est-04', order: 12, description: 'Possui registro da limpeza e desinfecção periódica da área de processamento de artigos (CME).', legislation: 'RDC 15/2012 art. 65', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-est-05',
        title: 'Biossegurança',
        order: 5,
        items: [
          { id: 'est-048', sectionId: 'sec-est-05', order: 1, description: 'Os profissionais não comem, bebem ou guardam alimentos nos postos de trabalho (bancadas e salas de procedimento).', legislation: 'NR 32', weight: 10, isCritical: true },
          { id: 'est-049', sectionId: 'sec-est-05', order: 2, description: 'Os profissionais utilizam EPIs completos e adequados para cada tipo de procedimento.', legislation: 'NR 32; RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-050', sectionId: 'sec-est-05', order: 3, description: 'Possui protocolo de Higiene das Mãos implantado e disponibiliza preparação alcoólica em pontos estratégicos.', legislation: 'RDC nº 36/2013; RDC 42/2010', weight: 5, isCritical: false },
          { id: 'est-051', sectionId: 'sec-est-05', order: 4, description: 'É realizada a desinfecção de superfícies (macas, bancadas, equipamentos) entre um paciente e outro.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-052', sectionId: 'sec-est-05', order: 5, description: 'Materiais perfurocortantes são descartados em coletores rígidos, localizados em suporte seguro e substituídos ao atingir o limite.', legislation: 'RDC nº 222/2018; NR 32', weight: 10, isCritical: true },
          { id: 'est-053', sectionId: 'sec-est-05', order: 6, description: 'É utilizada barreira de proteção descartável (lençol, filme PVC) em equipamentos e mobiliário que entram em contato com o paciente.', legislation: 'Princípios de Biossegurança', weight: 10, isCritical: true },
          { id: 'est-054', sectionId: 'sec-est-05', order: 7, description: 'Os calçados utilizados pelos profissionais na área de procedimento são fechados.', legislation: 'NR 32', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-est-06',
        title: 'Segurança do Paciente',
        order: 6,
        items: [
          { id: 'est-055', sectionId: 'sec-est-06', order: 1, description: 'O estabelecimento (se aplicável) possui Núcleo de Segurança do Paciente (NSP) formalmente instituído.', legislation: 'RDC nº 36/2013', weight: 2, isCritical: false },
          { id: 'est-056', sectionId: 'sec-est-06', order: 2, description: 'Possui protocolo para manejo de intercorrências e emergências, com plano de encaminhamento definido.', legislation: 'RDC nº 63/2011; Nota Técnica 02/2024/ANVISA', weight: 10, isCritical: true },
          { id: 'est-057', sectionId: 'sec-est-06', order: 3, description: 'Possui Maleta de Intercorrências equipada para suporte básico de vida, com materiais e medicamentos essenciais, controle de validade e em local de fácil acesso.', legislation: 'RDC 63/2011; Resoluções de Conselhos Profissionais', weight: 5, isCritical: false },
          { id: 'est-058', sectionId: 'sec-est-06', order: 4, description: 'Realiza a notificação de eventos adversos e queixas técnicas de produtos e equipamentos no sistema NOTIVISA.', legislation: 'RDC nº 36/2013; RDC 751/2022; RDC 864/2024', weight: 2, isCritical: false },
          { id: 'est-059', sectionId: 'sec-est-06', order: 5, description: 'Adota o protocolo de identificação do paciente para garantir que o procedimento seja realizado na pessoa correta.', legislation: 'RDC nº 36/2013', weight: 10, isCritical: true },
          { id: 'est-060', sectionId: 'sec-est-06', order: 6, description: 'Adota o protocolo de cirurgia segura (quando aplicável), com checagem de lateralidade, procedimento e materiais.', legislation: 'RDC nº 36/2013', weight: 2, isCritical: false },
          { id: 'est-061', sectionId: 'sec-est-06', order: 7, description: 'As instruções pós-procedimento são fornecidas por escrito aos pacientes, com orientações claras e contatos de emergência.', legislation: 'Código de Defesa do Consumidor; Boas Práticas', weight: 10, isCritical: true },
          { id: 'est-062', sectionId: 'sec-est-06', order: 8, description: 'É realizada a rastreabilidade dos produtos (lote, validade) e equipamentos utilizados em cada paciente, vinculada ao prontuário.', legislation: 'RDC 63/2011; RDC 36/2013', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-est-07',
        title: 'Equipamentos e Produtos',
        order: 7,
        items: [
          { id: 'est-063', sectionId: 'sec-est-07', order: 1,  description: 'Todos os equipamentos possuem registro ou notificação na ANVISA e são utilizados estritamente para a finalidade aprovada.', legislation: 'RDC nº 751/2022', weight: 10, isCritical: true },
          { id: 'est-064', sectionId: 'sec-est-07', order: 2,  description: 'Possui o manual de instruções de todos os equipamentos em português e acessível aos operadores.', legislation: 'RDC nº 751/2022', weight: 1, isCritical: false },
          { id: 'est-065', sectionId: 'sec-est-07', order: 3,  description: 'Apresenta registros de manutenção preventiva e calibração periódica dos equipamentos, conforme manual do fabricante.', legislation: 'RDC nº 63/2011', weight: 10, isCritical: true },
          { id: 'est-066', sectionId: 'sec-est-07', order: 4,  description: 'Os saneantes utilizados para limpeza e desinfecção são regularizados na ANVISA e utilizados conforme a diluição e tempo corretos.', legislation: 'Lei nº 6.360/1976', weight: 10, isCritical: true },
          { id: 'est-067', sectionId: 'sec-est-07', order: 5,  description: 'Todos os cosméticos e produtos para saúde são regularizados na ANVISA, estão no prazo de validade e armazenados corretamente.', legislation: 'Lei nº 6.360/1976', weight: 10, isCritical: true },
          { id: 'est-068', sectionId: 'sec-est-07', order: 6,  description: 'Os produtos expostos à venda (cosméticos, etc.) estão regularizados junto à ANVISA e armazenados de forma segregada dos de uso profissional.', legislation: 'Legislação Municipal / Sanitária', weight: 10, isCritical: true },
          { id: 'est-069', sectionId: 'sec-est-07', order: 7,  description: 'É proibido o fracionamento de produtos, exceto se especificado pelo fabricante e seguindo critérios técnicos de biossegurança.', legislation: 'Boas Práticas', weight: 10, isCritical: true },
          { id: 'est-070', sectionId: 'sec-est-07', order: 8,  description: 'Produtos abertos ou fracionados possuem identificação com nome, data de abertura e nova data de validade.', legislation: 'RDC nº 63/2011', weight: 10, isCritical: true },
          { id: 'est-071', sectionId: 'sec-est-07', order: 9,  description: 'Possui refrigerador exclusivo para medicamentos e termolábeis, com controle e registro diário de temperatura (mínima e máxima).', legislation: 'RDC 63/2011; Boas Práticas de Armazenamento', weight: 10, isCritical: true },
          { id: 'est-072', sectionId: 'sec-est-07', order: 10, description: 'Possui plano de contingência para o armazenamento de produtos termolábeis em caso de falta de energia.', legislation: 'Boas Práticas de Armazenamento', weight: 2, isCritical: false },
          { id: 'est-073', sectionId: 'sec-est-07', order: 11, description: 'Caso utilize medicamentos sujeitos a controle especial (Portaria 344/98), apresenta a Autorização de Funcionamento Especial (AFE).', legislation: 'Portaria SVS/MS nº 344/98', weight: 1, isCritical: false },
          { id: 'est-074', sectionId: 'sec-est-07', order: 12, description: 'O local de armazenamento de medicamentos controlados é exclusivo, trancado com chave e de acesso restrito.', legislation: 'Portaria SVS/MS nº 344/98', weight: 1, isCritical: false },
          { id: 'est-075', sectionId: 'sec-est-07', order: 13, description: 'Realiza e mantém os registros do Balanço de Substâncias Psicoativas e Outras (BSPO), conforme legislação.', legislation: 'Portaria SVS/MS nº 344/98', weight: 1, isCritical: false },
          { id: 'est-076', sectionId: 'sec-est-07', order: 14, description: 'Há controle de temperatura e integridade para amostras grátis de medicamentos, sob responsabilidade do prescritor.', legislation: 'Boas Práticas de Armazenamento', weight: 10, isCritical: true },
          { id: 'est-077', sectionId: 'sec-est-07', order: 15, description: 'Os medicamentos manipulados possuem rótulo com os dados da farmácia de manipulação e do paciente/clínica.', legislation: 'RDC 67/2007', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-est-08',
        title: 'Gestão de Resíduos',
        order: 8,
        items: [
          { id: 'est-078', sectionId: 'sec-est-08', order: 1, description: 'Apresenta contrato com empresa licenciada para coleta, transporte e destinação final de resíduos de saúde (Grupos A, B, E).', legislation: 'RDC nº 222/2018', weight: 10, isCritical: true },
          { id: 'est-079', sectionId: 'sec-est-08', order: 2, description: 'A segregação dos resíduos (infectante, químico, perfurocortante, comum) é realizada corretamente no momento e local de sua geração.', legislation: 'RDC nº 222/2018', weight: 10, isCritical: true },
          { id: 'est-080', sectionId: 'sec-est-08', order: 3, description: 'Os recipientes de descarte (lixeiras) são adequados ao tipo de resíduo, com tampa de acionamento por pedal e simbologia correta.', legislation: 'RDC nº 222/2018', weight: 10, isCritical: true },
          { id: 'est-081', sectionId: 'sec-est-08', order: 4, description: 'Os sacos de lixo utilizados correspondem à cor padronizada para cada tipo de resíduo.', legislation: 'RDC nº 222/2018', weight: 10, isCritical: true },
          { id: 'est-082', sectionId: 'sec-est-08', order: 5, description: 'Os resíduos são retirados das salas de procedimento quando o recipiente atingir 2/3 da capacidade ou no mínimo a cada 48h.', legislation: 'RDC 222/2018 art. 14', weight: 10, isCritical: true },
          { id: 'est-083', sectionId: 'sec-est-08', order: 6, description: 'Possui abrigo externo de resíduos, em conformidade com a RDC 222/2018 (separado, identificado, protegido, com ponto de água).', legislation: 'RDC nº 222/2018', weight: 10, isCritical: true },
          { id: 'est-084', sectionId: 'sec-est-08', order: 7, description: 'O descarte de medicamentos e químicos é realizado conforme o PGRSS, em conformidade com a RDC 222/2018.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-est-09',
        title: 'Controle de Vetores e Qualidade da Água',
        order: 9,
        items: [
          { id: 'est-085', sectionId: 'sec-est-09', order: 1, description: 'Apresenta comprovante de controle de vetores e pragas urbanas, realizado por empresa licenciada e dentro da validade.', legislation: 'RDC 63/2011 art. 23', weight: 10, isCritical: true },
          { id: 'est-086', sectionId: 'sec-est-09', order: 2, description: 'Apresenta comprovante de limpeza e desinfecção do reservatório de água, com periodicidade mínima semestral.', legislation: 'RDC 63/2011 art. 39', weight: 10, isCritical: true },
          { id: 'est-087', sectionId: 'sec-est-09', order: 3, description: 'Apresenta laudos de potabilidade da água, conforme periodicidade semestral.', legislation: 'Portaria GM/MS Nº 888/2021', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-est-10',
        title: 'Lavanderia',
        order: 10,
        items: [
          { id: 'est-088', sectionId: 'sec-est-10', order: 1, description: 'As roupas limpas são armazenadas em local separado, limpo e fechado.', legislation: 'RDC 63/2011', weight: 1, isCritical: false },
          { id: 'est-089', sectionId: 'sec-est-10', order: 2, description: 'As roupas sujas são acondicionadas em sacos impermeáveis e transportadas separadamente das limpas.', legislation: 'RDC 63/2011', weight: 1, isCritical: false },
          { id: 'est-090', sectionId: 'sec-est-10', order: 3, description: 'Se o processamento de roupas é terceirizado, apresenta contrato com lavanderia que possua licença sanitária.', legislation: 'Boas Práticas', weight: 1, isCritical: false },
          { id: 'est-091', sectionId: 'sec-est-10', order: 4, description: 'As toalhas de tecido, se utilizadas, são de cor clara e de uso individual.', legislation: 'Legislação Municipal; Resoluções de Conselhos', weight: 1, isCritical: false },
        ],
      },

      {
        id: 'sec-est-11',
        title: 'Considerações Gerais',
        order: 11,
        items: [
          { id: 'est-092', sectionId: 'sec-est-11', order: 1,  description: 'A publicidade e propaganda do estabelecimento não são enganosas e respeitam as normas dos conselhos profissionais.', legislation: 'Código de Defesa do Consumidor; Resoluções de Conselhos', weight: 2, isCritical: false },
          { id: 'est-093', sectionId: 'sec-est-11', order: 2,  description: 'É proibido o uso de equipamentos de bronzeamento artificial com emissão de UV.', legislation: 'RDC 56/2009', weight: 10, isCritical: true },
          { id: 'est-094', sectionId: 'sec-est-11', order: 3,  description: 'Os profissionais executam apenas os procedimentos para os quais estão legalmente habilitados.', legislation: 'Lei do Exercício Profissional; Resoluções de Conselhos', weight: 10, isCritical: true },
          { id: 'est-095', sectionId: 'sec-est-11', order: 4,  description: 'O estabelecimento possui extintores de incêndio com carga e validade em dia e em locais sinalizados.', legislation: 'Normas do Corpo de Bombeiros', weight: 5, isCritical: false },
          { id: 'est-096', sectionId: 'sec-est-11', order: 5,  description: 'As saídas de emergência estão desobstruídas e sinalizadas.', legislation: 'Normas do Corpo de Bombeiros', weight: 2, isCritical: false },
          { id: 'est-097', sectionId: 'sec-est-11', order: 6,  description: 'É proibido fumar no interior do estabelecimento.', legislation: 'Lei Federal nº 9.294/1996', weight: 10, isCritical: true },
          { id: 'est-098', sectionId: 'sec-est-11', order: 7,  description: 'Há bebedouro com água potável disponível para funcionários e clientes, com manutenção em dia.', legislation: 'Boas Práticas', weight: 10, isCritical: true },
          { id: 'est-099', sectionId: 'sec-est-11', order: 8,  description: 'O ar condicionado, se existente, possui plano de manutenção e registros de limpeza dos filtros.', legislation: 'Lei Federal nº 13.589/2018', weight: 10, isCritical: true },
          { id: 'est-100', sectionId: 'sec-est-11', order: 9,  description: 'A validade dos produtos saneantes é controlada e os mesmos são armazenados em local próprio (DML).', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-101', sectionId: 'sec-est-11', order: 10, description: 'Os uniformes dos funcionários estão limpos, em bom estado de conservação e são de uso exclusivo nas dependências do serviço.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'est-102', sectionId: 'sec-est-11', order: 11, description: 'A empresa possui Livro de Reclamações do Consumidor, conforme exigência local.', legislation: 'Legislação do Consumidor', weight: 10, isCritical: true },
          { id: 'est-103', sectionId: 'sec-est-11', order: 12, description: 'A empresa notifica compulsoriamente os agravos à saúde de acordo com a legislação.', legislation: 'Portaria de Consolidação nº 4/2017 (GM/MS)', weight: 10, isCritical: true },
          { id: 'est-104', sectionId: 'sec-est-11', order: 13, description: 'O descarte de embalagens de produtos é realizado de forma a inutilizá-las para evitar o reuso.', legislation: 'Boas Práticas', weight: 10, isCritical: true },
          { id: 'est-105', sectionId: 'sec-est-11', order: 14, description: 'Existe rotina de limpeza periódica de todos os equipamentos (parte externa).', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-106', sectionId: 'sec-est-11', order: 15, description: 'O estabelecimento possui um local seguro para a guarda de pertences de clientes/pacientes.', legislation: 'Boas Práticas de Atendimento', weight: 2, isCritical: false },
          { id: 'est-107', sectionId: 'sec-est-11', order: 16, description: 'O estabelecimento possui toda a sinalização visível (nome do RT, telefones de emergência, direitos do paciente, etc.).', legislation: 'Legislação Local; Boas Práticas', weight: 1, isCritical: false },
          { id: 'est-108', sectionId: 'sec-est-11', order: 17, description: 'Os certificados de calibração dos equipamentos estão disponíveis e dentro da validade.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-109', sectionId: 'sec-est-11', order: 18, description: 'O estabelecimento possui e implementa um programa de gerenciamento de tecnologias em saúde.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
        ],
      },

      {
        id: 'sec-est-12',
        title: 'Gestão da Qualidade',
        order: 12,
        items: [
          { id: 'est-110', sectionId: 'sec-est-12', order: 1, description: 'A instituição avalia periodicamente seus processos e indicadores de qualidade e segurança.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'est-111', sectionId: 'sec-est-12', order: 2, description: 'Existe uma política institucional documentada que proíbe o reprocessamento de artigos de uso único.', legislation: 'RDC 63/2011; RE 2605/2006', weight: 10, isCritical: true },
          { id: 'est-112', sectionId: 'sec-est-12', order: 3, description: 'O serviço realiza a vigilância epidemiológica de eventos adversos, incluindo surtos e infecções relacionadas à assistência.', legislation: 'RDC 36/2013; Portaria 2616/98', weight: 5, isCritical: false },
          { id: 'est-113', sectionId: 'sec-est-12', order: 4, description: 'Os profissionais possuem descrição de cargo com suas atribuições, responsabilidades e autoridades.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'est-114', sectionId: 'sec-est-12', order: 5, description: 'A direção do serviço promove uma cultura de segurança, incentivando a comunicação e a notificação de incidentes sem caráter punitivo.', legislation: 'RDC 36/2013', weight: 2, isCritical: false },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // TEMPLATE 2 — ILPI
  // Base: RDC nº 502/2021, RDC 63/2011, RDC 222/2018,
  //       RDC 216/2004, Lei 8049/2018, Lei Federal 10741/2003
  // Classificação original: I=Imprescindível | N=Necessário | R=Recomendável
  // ════════════════════════════════════════════════════════════
  {
    id: 'tpl-ilpi-v1',
    name: 'Roteiro de Inspeção — ILPI (RDC 502/2021)',
    category: 'ilpi',
    version: '11/2024',
    sections: [

      {
        id: 'sec-ilpi-01',
        title: 'Estrutura Física — Geral',
        order: 1,
        items: [
          { id: 'ilpi-001', sectionId: 'sec-ilpi-01', order: 1,  description: 'Identificação externa do estabelecimento visível.', legislation: 'Parágrafo 2º do Art. 37 da Lei Federal 10.741/2003', weight: 5, isCritical: false },
          { id: 'ilpi-002', sectionId: 'sec-ilpi-01', order: 2,  description: 'Instalações físicas em condições adequadas de habitabilidade, higiene, salubridade, segurança e organização.', legislation: 'Capítulo II, Seção IV, Art. 21 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-003', sectionId: 'sec-ilpi-01', order: 3,  description: 'Acessos independentes (pelo menos dois).', legislation: 'Capítulo II, Seção IV, Art. 24, item I – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-004', sectionId: 'sec-ilpi-01', order: 4,  description: 'Janelas e guarda-corpos com peitoris de no mínimo 1,00m.', legislation: 'Capítulo II, Seção IV, Art. 28 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-005', sectionId: 'sec-ilpi-01', order: 5,  description: 'Pisos internos e externos (inclusive rampas e escadas) de fácil limpeza e conservação, uniformes, com mecanismo antiderrapante.', legislation: 'Capítulo II, Seção IV, Art. 24, Item II – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-006', sectionId: 'sec-ilpi-01', order: 6,  description: 'Possui elevador que segue especificações da ABNT NBR 9050/2015.', legislation: 'Capítulo II, Seção IV, Art. 26 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-007', sectionId: 'sec-ilpi-01', order: 7,  description: 'Possui rampas de acesso adequadas (inclinação, dimensionamento, corrimão e sinalização).', legislation: 'Capítulo II, Seção IV, Art. 24, Item III – RDC 502/2021; NBR 9050/ABNT', weight: 5, isCritical: false },
          { id: 'ilpi-008', sectionId: 'sec-ilpi-01', order: 8,  description: 'Escadas adequadas (dimensionamento, corrimão e sinalização).', legislation: 'Capítulo II, Seção IV, Art. 24, Item III – RDC 502/2021; NBR 9050/ABNT', weight: 5, isCritical: false },
          { id: 'ilpi-009', sectionId: 'sec-ilpi-01', order: 9,  description: 'Circulações internas principais com largura mínima de 1,00m e secundárias com largura mínima de 0,80m, com luz de vigília permanente.', legislation: 'Capítulo II, Seção IV, Art. 25 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-010', sectionId: 'sec-ilpi-01', order: 10, description: 'Possui Depósito de Material de Limpeza (DML).', legislation: 'Capítulo II, Seção IV, Art. 29, Item XI – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-011', sectionId: 'sec-ilpi-01', order: 11, description: 'Portas com vão livre de 0,20m na parte inferior, largura mínima de 1,10m, com travamento simples sem uso de trancas ou chaves (circulações internas).', legislation: 'Capítulo II, Seção IV, Art. 27 – RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-012', sectionId: 'sec-ilpi-01', order: 12, description: 'Ausência de fiação exposta ou fios danificados em qualquer dependência.', legislation: 'Art. 65º da Lei Municipal 13725/2004', weight: 10, isCritical: true },
          { id: 'ilpi-013', sectionId: 'sec-ilpi-01', order: 13, description: 'Atestado de funcionamento emitido pelo Corpo de Bombeiros (CBMERJ).', legislation: 'CBMERJ', weight: 10, isCritical: true },
          { id: 'ilpi-014', sectionId: 'sec-ilpi-01', order: 14, description: 'Possui sala de convivência com área mínima de 1,3m² por pessoa.', legislation: 'Seção II, Art. 29 item 2 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-015', sectionId: 'sec-ilpi-01', order: 15, description: 'Possui cozinha.', legislation: 'Seção IV, Art. 29, Item VIII – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-016', sectionId: 'sec-ilpi-01', order: 16, description: 'Possui despensa organizada e adequada.', legislation: 'RDC 216/2004; Seção IV, Art. 29 item VIII da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-017', sectionId: 'sec-ilpi-01', order: 17, description: 'Possui refeitório com área mínima de 1m² por usuário, acrescido de lavatório.', legislation: 'Art. 29, Item VII da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-018', sectionId: 'sec-ilpi-01', order: 18, description: 'Consultório para atendimento individualizado, incluindo o serviço social.', legislation: 'Seção I, Art. 6º II da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-019', sectionId: 'sec-ilpi-01', order: 19, description: 'Possui posto de enfermagem organizado, provido de lavatório e anexos.', legislation: 'RDC 50/2002; Art. 17 da RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-020', sectionId: 'sec-ilpi-01', order: 20, description: 'Lixeira com tampa com acionamento sem contato manual em todos os ambientes.', legislation: 'Portaria SUBVISA 385/2018', weight: 5, isCritical: false },
          { id: 'ilpi-021', sectionId: 'sec-ilpi-01', order: 21, description: 'Ralos sifonados, dotados de dispositivos que impeçam a entrada de vetores.', legislation: 'Item 20.5.1 – Portaria Municipal 1210/2006', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-ilpi-02',
        title: 'Dormitórios',
        order: 2,
        items: [
          { id: 'ilpi-022', sectionId: 'sec-ilpi-02', order: 1, description: 'Dormitórios separados por sexo, para no máximo 4 pessoas, dotados de banheiros.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-023', sectionId: 'sec-ilpi-02', order: 2, description: 'Dormitórios de 01 pessoa com área mínima de 7,50m².', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 1 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-024', sectionId: 'sec-ilpi-02', order: 3, description: 'Dormitórios de 02 a 04 pessoas com área mínima de 5,50m² por cama.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 2 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-025', sectionId: 'sec-ilpi-02', order: 4, description: 'Colchões, colchonetes e demais mobiliários almofadados revestidos de material lavável e impermeável, sem furos, rasgos, sulcos ou reentrâncias.', legislation: 'Art. 56 – RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-026', sectionId: 'sec-ilpi-02', order: 5, description: 'O serviço de saúde estabelece estratégias e ações voltadas para Segurança do Paciente, incluindo mecanismos para prevenção de úlceras por pressão.', legislation: 'Art. 8° RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-027', sectionId: 'sec-ilpi-02', order: 6, description: 'Dormitórios dotados de luz de vigília e campainha de alarme.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 3 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-028', sectionId: 'sec-ilpi-02', order: 7, description: 'Distância mínima de 0,80m entre duas camas e 0,50m entre a lateral da cama e a parede paralela.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 4 – RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-ilpi-03',
        title: 'Banheiros',
        order: 3,
        items: [
          { id: 'ilpi-029', sectionId: 'sec-ilpi-03', order: 1, description: 'Banheiros possuem área mínima de 3,60m², com 1 bacia, 1 lavatório e 1 chuveiro, com privacidade.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 5 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-030', sectionId: 'sec-ilpi-03', order: 2, description: 'Banheiros coletivos separados por sexo, com no mínimo um box para vaso sanitário com adaptações para cadeira de rodas e separação entre chuveiro e sanitários.', legislation: 'Capítulo II, Seção IV, Art. 29, Item IV – RDC 502/2021; NBR 9050/ABNT', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-ilpi-04',
        title: 'Medicamentos',
        order: 4,
        items: [
          { id: 'ilpi-031', sectionId: 'sec-ilpi-04', order: 1, description: 'Medicamentos com registro na ANVISA e dentro do prazo de validade, armazenados conforme recomendação do fabricante (umidade, abrigo da luz solar e temperatura).', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-032', sectionId: 'sec-ilpi-04', order: 2, description: 'Medicamentos psicotrópicos armazenados em local com acesso restrito e com registros de controle de estoque.', legislation: 'Portaria MS 344/1998', weight: 10, isCritical: true },
          { id: 'ilpi-033', sectionId: 'sec-ilpi-04', order: 3, description: 'Geladeira exclusiva, termômetro digital e planilha com controle de temperatura.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-ilpi-05',
        title: 'Serviço de Nutrição',
        order: 5,
        items: [
          { id: 'ilpi-034', sectionId: 'sec-ilpi-05', order: 1,  description: 'São servidas no mínimo seis refeições diárias.', legislation: 'RDC 502/2021, Capítulo II, Subseção III, Art. 44', weight: 10, isCritical: true },
          { id: 'ilpi-035', sectionId: 'sec-ilpi-05', order: 2,  description: 'Dispõe de pia para lavagem das mãos com dispensadores de sabão líquido, suporte para papel toalha e lixeira com tampa de acionamento sem contato manual.', legislation: 'RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-036', sectionId: 'sec-ilpi-05', order: 3,  description: 'Dietas especiais conforme necessidade do residente.', legislation: 'RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-037', sectionId: 'sec-ilpi-05', order: 4,  description: 'Dietas enterais são manipuladas em copa exclusiva, dotada de bancada, pia e lavatório OU em horário alternativo ao uso da cozinha.', legislation: 'RDC 63/2000', weight: 5, isCritical: false },
          { id: 'ilpi-038', sectionId: 'sec-ilpi-05', order: 5,  description: 'Paredes e piso de fácil higienização.', legislation: 'Tópico 4.1.3 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-039', sectionId: 'sec-ilpi-05', order: 6,  description: 'Portas teladas e/ou com mecanismos de proteção contra insetos e roedores.', legislation: 'Tópico 4.1.4 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-040', sectionId: 'sec-ilpi-05', order: 7,  description: 'Janelas teladas (as telas devem ser removíveis e de fácil limpeza).', legislation: 'Tópico 4.1.4 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-041', sectionId: 'sec-ilpi-05', order: 8,  description: 'Manipuladores paramentados adequadamente (uniforme fechado, cor clara, sapatos fechados, touca).', legislation: 'Tópico 4.6.3 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-042', sectionId: 'sec-ilpi-05', order: 9,  description: 'Ausência de materiais e equipamentos em desuso e/ou estranhos à atividade.', legislation: 'Tópico 4.1.7 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-043', sectionId: 'sec-ilpi-05', order: 10, description: 'Mobiliários, equipamentos e utensílios constituídos de material de fácil limpeza e higienização, livres de resíduos, em perfeito estado de funcionamento e conservação.', legislation: 'Tópico 4.1.17 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-044', sectionId: 'sec-ilpi-05', order: 11, description: 'Armazenamento dos alimentos em temperatura adequada com controle registrado. Congelamento: -18°C; Refrigeração: hortifruti até 10°C, carne até 4°C, pescado até 2°C.', legislation: 'RDC 502/2021, Capítulo II, Subseção III, Art. 45', weight: 10, isCritical: true },
          { id: 'ilpi-045', sectionId: 'sec-ilpi-05', order: 12, description: 'Trânsito restrito de pessoas não essenciais à produção de alimentos.', legislation: 'Item 8.1.1 e 8.5 – Portaria Municipal 1210/2006', weight: 5, isCritical: false },
          { id: 'ilpi-046', sectionId: 'sec-ilpi-05', order: 13, description: 'Estoque de alimentos em quantidade suficiente para atender a demanda institucional.', legislation: 'RDC 502/2021, Capítulo II, Subseção III, Art. 46', weight: 10, isCritical: true },
          { id: 'ilpi-047', sectionId: 'sec-ilpi-05', order: 14, description: 'Alimentos armazenados de forma organizada, em local limpo e livre de pragas.', legislation: 'Tópico 4.7.5 – RDC 216/2004; RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-048', sectionId: 'sec-ilpi-05', order: 15, description: 'Dispõe de sanitizante próprio para higienização de hortifrutícolas, com registro na ANVISA e POP para tal procedimento.', legislation: 'RDC 216/2006; Portaria IVISA 002/2020', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-ilpi-06',
        title: 'Refeitório',
        order: 6,
        items: [
          { id: 'ilpi-049', sectionId: 'sec-ilpi-06', order: 1, description: 'Refeitório com área mínima de 1m² por usuário, acrescido de local para guarda de lanches, lavatório para higienização das mãos e luz de vigília.', legislation: 'Capítulo II, Seção IV, Art. 29, Item VII – RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-ilpi-07',
        title: 'Lavanderia',
        order: 7,
        items: [
          { id: 'ilpi-050', sectionId: 'sec-ilpi-07', order: 1, description: 'Separação de área física (suja e limpa).', legislation: 'Capítulo II, Seção IV, Art. 29, item IX – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-051', sectionId: 'sec-ilpi-07', order: 2, description: 'Possui lavanderia terceirizada e apresentou contrato.', legislation: 'Seção IV, Art. 29, Item IX – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-052', sectionId: 'sec-ilpi-07', order: 3, description: 'Identificação de roupas de uso pessoal.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-053', sectionId: 'sec-ilpi-07', order: 4, description: 'Produtos utilizados no processamento das roupas possuem registro na ANVISA/MS.', legislation: 'ANVISA', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-ilpi-08',
        title: 'Assistência ao Idoso',
        order: 8,
        items: [
          { id: 'ilpi-054', sectionId: 'sec-ilpi-08', order: 1, description: 'Possui serviço de remoção/contrato estabelecido em Plano.', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-055', sectionId: 'sec-ilpi-08', order: 2, description: 'Elaboração bianual do Plano de Atenção Integral à Saúde dos residentes (PAISI).', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-056', sectionId: 'sec-ilpi-08', order: 3, description: 'Dispõe de atividades ocupacionais.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-057', sectionId: 'sec-ilpi-08', order: 4, description: 'Carteira de Vacinação dos Idosos atualizada.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-058', sectionId: 'sec-ilpi-08', order: 5, description: 'Prontuário individualizado e organizado.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-059', sectionId: 'sec-ilpi-08', order: 6, description: 'Avaliação multiprofissional atualizada.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-ilpi-09',
        title: 'Saúde do Trabalhador',
        order: 9,
        items: [
          { id: 'ilpi-060', sectionId: 'sec-ilpi-09', order: 1, description: 'Utilização de Equipamentos de Proteção Individual e Coletiva.', legislation: 'NR 32', weight: 5, isCritical: false },
          { id: 'ilpi-061', sectionId: 'sec-ilpi-09', order: 2, description: 'Dispõe de local de descanso para equipe de enfermagem adequado à demanda.', legislation: 'NR 24', weight: 5, isCritical: false },
        ],
      },

      {
        id: 'sec-ilpi-10',
        title: 'Resíduos',
        order: 10,
        items: [
          { id: 'ilpi-062', sectionId: 'sec-ilpi-10', order: 1, description: 'Abrigo externo à edificação para armazenamento de resíduos até o momento da coleta.', legislation: 'Capítulo II, Seção IV, Art. 29, Item XIV – RDC 502/2021; RDC 222/2018', weight: 5, isCritical: false },
          { id: 'ilpi-063', sectionId: 'sec-ilpi-10', order: 2, description: 'Dispor de recipientes identificados e íntegros, de fácil higienização e transporte, em número e capacidade suficientes para conter os resíduos.', legislation: 'Tópico 4.5.1 – RDC 216/2004; RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-064', sectionId: 'sec-ilpi-10', order: 3, description: 'Coletores utilizados para deposição dos resíduos das áreas de preparação e armazenamento de alimentos dotados de tampas acionadas sem contato manual.', legislation: 'Tópico 4.5.3 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-065', sectionId: 'sec-ilpi-10', order: 4, description: 'Descarte de resíduos perfurocortantes em recipiente rígido em saco branco leitoso. Contrato com empresa / PGRSS.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-ilpi-11',
        title: 'Água e Controle de Pragas',
        order: 11,
        items: [
          { id: 'ilpi-066', sectionId: 'sec-ilpi-11', order: 1, description: 'Registro de limpeza do reservatório de água a cada 6 meses.', legislation: 'Lei municipal 10.770/89 arts. 4 e 6', weight: 10, isCritical: true },
          { id: 'ilpi-067', sectionId: 'sec-ilpi-11', order: 2, description: 'Laudo de análise microbiológica da água após limpeza do reservatório.', legislation: 'Lei municipal 10.770/89 arts. 4 e 6', weight: 10, isCritical: true },
          { id: 'ilpi-068', sectionId: 'sec-ilpi-11', order: 3, description: 'Ações eficazes e contínuas de controle de vetores e pragas urbanas. Registro de controle de pragas fornecido por empresa cadastrada no INEA.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-ilpi-12',
        title: 'Recursos Humanos',
        order: 12,
        items: [
          { id: 'ilpi-069', sectionId: 'sec-ilpi-12', order: 1,  description: 'Médico com número registrado (CREMERJ).', legislation: 'Lei 8049/18; CREMERJ nº 192/2021', weight: 10, isCritical: true },
          { id: 'ilpi-070', sectionId: 'sec-ilpi-12', order: 2,  description: 'Enfermeiro.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-071', sectionId: 'sec-ilpi-12', order: 3,  description: 'Técnicos de enfermagem.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-072', sectionId: 'sec-ilpi-12', order: 4,  description: 'Responsável Técnico.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-073', sectionId: 'sec-ilpi-12', order: 5,  description: 'Documento de responsabilidade técnica do Enfermeiro.', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-074', sectionId: 'sec-ilpi-12', order: 6,  description: 'Cuidadores.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-075', sectionId: 'sec-ilpi-12', order: 7,  description: 'Nutricionista.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-076', sectionId: 'sec-ilpi-12', order: 8,  description: 'Psicólogo.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-077', sectionId: 'sec-ilpi-12', order: 9,  description: 'Fisioterapeuta.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-078', sectionId: 'sec-ilpi-12', order: 10, description: 'Assistência social.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-079', sectionId: 'sec-ilpi-12', order: 11, description: 'Terapeuta Ocupacional.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-080', sectionId: 'sec-ilpi-12', order: 12, description: 'Profissionais apresentam evolução em prontuário multidisciplinar.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      {
        id: 'sec-ilpi-13',
        title: 'Documentação',
        order: 13,
        items: [
          { id: 'ilpi-081', sectionId: 'sec-ilpi-13', order: 1,  description: 'O responsável técnico possui curso superior.', legislation: 'Capítulo II, Seção II, Art. 10 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-082', sectionId: 'sec-ilpi-13', order: 2,  description: 'Cadastro no Conselho Municipal de Assistência Social – COMDEPI.', legislation: 'Legislação Municipal', weight: 5, isCritical: false },
          { id: 'ilpi-083', sectionId: 'sec-ilpi-13', order: 3,  description: 'Alvará de Funcionamento.', legislation: 'Legislação Municipal', weight: 10, isCritical: true },
          { id: 'ilpi-084', sectionId: 'sec-ilpi-13', order: 4,  description: 'Licença Sanitária.', legislation: 'Legislação Sanitária', weight: 10, isCritical: true },
          { id: 'ilpi-085', sectionId: 'sec-ilpi-13', order: 5,  description: 'CNPJ.', legislation: 'Legislação Federal', weight: 10, isCritical: true },
          { id: 'ilpi-086', sectionId: 'sec-ilpi-13', order: 6,  description: 'Contrato Social.', legislation: 'Inciso III, Art. 48 da Lei Federal 10741/2003', weight: 10, isCritical: true },
          { id: 'ilpi-087', sectionId: 'sec-ilpi-13', order: 7,  description: 'Eventos sentinela registrados.', legislation: 'Capítulo III, Art. 55 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-088', sectionId: 'sec-ilpi-13', order: 8,  description: 'Processo de Enfermagem (SAE).', legislation: 'Resolução COFEN 736/2024', weight: 10, isCritical: true },
          { id: 'ilpi-089', sectionId: 'sec-ilpi-13', order: 9,  description: 'Plano Individual de Atendimento – PIA.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-090', sectionId: 'sec-ilpi-13', order: 10, description: 'Plano de Atendimento Singular – PAS.', legislation: 'RDC 29/2011', weight: 10, isCritical: true },
          { id: 'ilpi-091', sectionId: 'sec-ilpi-13', order: 11, description: 'Programa de Atenção Integral à Saúde do Idoso – PAISI.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-092', sectionId: 'sec-ilpi-13', order: 12, description: 'Dimensionamento da equipe de acordo com a Lei 8049/2018.', legislation: 'Lei 8049/2018', weight: 5, isCritical: false },
          { id: 'ilpi-093', sectionId: 'sec-ilpi-13', order: 13, description: 'Protocolo de contenção ambiental (idoso).', legislation: 'Resolução COFEN 746/2024', weight: 5, isCritical: false },
          { id: 'ilpi-094', sectionId: 'sec-ilpi-13', order: 14, description: 'Manual de Boas Práticas e POPs do serviço de Nutrição e Enfermagem.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'ilpi-095', sectionId: 'sec-ilpi-13', order: 15, description: 'Estatuto registrado.', legislation: 'Item 4.5.2 – RDC 283/2005; Inciso II, Art. 48º da Lei Federal 10741/2003', weight: 5, isCritical: false },
          { id: 'ilpi-096', sectionId: 'sec-ilpi-13', order: 16, description: 'Contratos de Serviços de Recursos Humanos / vínculo formal de trabalho.', legislation: 'Legislação Trabalhista', weight: 5, isCritical: false },
          { id: 'ilpi-097', sectionId: 'sec-ilpi-13', order: 17, description: 'Contratos de serviços terceirizados e cópia do Alvará Sanitário da empresa terceirizada.', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-098', sectionId: 'sec-ilpi-13', order: 18, description: 'Manual de Normas, Rotinas e Procedimentos.', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-099', sectionId: 'sec-ilpi-13', order: 19, description: 'Livro de registro de entradas e saídas atualizado.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-100', sectionId: 'sec-ilpi-13', order: 20, description: 'Livro de registro de informações sobre o idoso (grau de dependência, direitos previdenciários, alta, óbito).', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-101', sectionId: 'sec-ilpi-13', order: 21, description: 'Prontuários de pacientes com a devida evolução.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-102', sectionId: 'sec-ilpi-13', order: 22, description: 'Registro diário de intercorrências.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-103', sectionId: 'sec-ilpi-13', order: 23, description: 'Contrato de prestação de serviços do idoso com a instituição.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-104', sectionId: 'sec-ilpi-13', order: 24, description: 'Notificação das Doenças de Notificação Compulsória (DNC).', legislation: 'Portaria de Consolidação nº 4/2017', weight: 10, isCritical: true },
          { id: 'ilpi-105', sectionId: 'sec-ilpi-13', order: 25, description: 'Instruções para higienização das mãos em local visível.', legislation: 'RDC 36/2013', weight: 2, isCritical: false },
        ],
      },
    ],
  },
];

export function getTemplatesByCategory(category: string): ChecklistTemplate[] {
  return templates.filter(t => t.category === category);
}

export function getTemplateById(id: string): ChecklistTemplate | undefined {
  return templates.find(t => t.id === id);
}

export function getTotalItems(template: ChecklistTemplate): number {
  return template.sections.reduce((sum, s) => sum + s.items.length, 0);
}

export function getCriticalItemsCount(template: ChecklistTemplate): number {
  return template.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.isCritical).length, 0
  );
}
```

---

## TELAS E FLUXO DO APP

### Navegação principal (bottom navigation em mobile, sidebar em desktop)
1. **Início** — dashboard com inspeções recentes e acesso rápido
2. **Clientes** — lista e cadastro de estabelecimentos
3. **Inspeções** — histórico de inspeções (em andamento e finalizadas)
4. **Nova Inspeção** — fluxo de criação e execução
5. **Configurações** — nome da consultora, logo para relatório

---

### TELA 1 — Dashboard (Home)

Mostrar:
- Card de boas-vindas com nome da consultora
- Resumo: nº de inspeções este mês, média de conformidade
- Lista das últimas 5 inspeções com nome do cliente, data, % conformidade e status
- Botão de destaque: "Nova Inspeção"
- Indicador offline/online no topo

---

### TELA 2 — Clientes

- Lista de clientes com filtro por categoria (estética/ILPI/alimentos)
- Card de cliente: nome, categoria (badge colorida), última inspeção
- Toque no cliente: ver histórico de inspeções desse cliente
- FAB (+) para cadastrar novo cliente
- Formulário de cadastro: nome*, CNPJ, endereço, categoria*, responsável, telefone, e-mail

---

### TELA 3 — Inspeções

- Abas: "Em andamento" e "Concluídas"
- Card de inspeção: cliente, data, % conformidade (barra de progresso colorida), consultora
- Toque: ver detalhes ou continuar inspeção em andamento
- Inspeções concluídas: opção de gerar PDF novamente

---

### TELA 4 — Fluxo de Nova Inspeção (TELA MAIS IMPORTANTE)

**Passo 1 — Configuração da visita:**
- Selecionar cliente (ou criar novo inline)
- Selecionar roteiro (filtrado pela categoria do cliente)
- Nome da consultora (pré-preenchido das configurações)
- Data (padrão: hoje)
- Botão "Iniciar Inspeção"

**Passo 2 — Execução do roteiro:**

Este é o coração do app. Layout:
- Header fixo: nome do cliente + progresso (ex: "23/39 itens")
- Barra de progresso no topo (colorida: vermelho → amarelo → verde conforme % conformidade em tempo real)
- Lista de seções expansíveis (accordion)
- Cada seção mostra: título + (nº itens cumpridos / nº total) + badge de % da seção

**Card de item de inspeção:**
```
┌─────────────────────────────────────────────────┐
│  [!] CRÍTICO   RDC 665/2022, Art. 9º, §2º  [↗] │  ← badge crítico se aplicável + link legislação
│                                                   │
│  Lavatório exclusivo para higienização das        │
│  mãos em cada sala de atendimento, com água       │
│  corrente, sabonete líquido e toalha descartável │
│                                                   │
│  [✓ CUMPRE]  [✗ NÃO CUMPRE]  [— N/A]            │  ← botões grandes, touch-friendly
└─────────────────────────────────────────────────┘
```

Quando "NÃO CUMPRE" for selecionado, o card expande automaticamente:
```
┌─────────────────────────────────────────────────┐
│  ✗ NÃO CUMPRE  (selecionado)                     │
│                                                   │
│  Situação encontrada: *                           │
│  [textarea: descreva o que foi observado...]      │
│                                                   │
│  Ação corretiva necessária: *                     │
│  [textarea: o que precisa ser feito...]           │
│                                                   │
│  📷 Registrar evidência fotográfica               │
│  [Tirar foto]  [Escolher da galeria]             │
│                                                   │
│  [thumb da foto 1] [thumb da foto 2] [+ adicionar]│
└─────────────────────────────────────────────────┘
```

**Comportamento da câmera:**
- Usar `<input type="file" accept="image/*" capture="environment">` para abrir câmera direta no mobile
- Comprimir foto antes de salvar no IndexedDB (canvas resize para max 1200px, qualidade 0.85)
- Permitir múltiplas fotos por item (máximo 5)
- Tap na thumbnail: ver foto em fullscreen com opção de excluir

**Navegação entre itens:**
- Scroll contínuo na lista (não paginação)
- Botão flutuante "Ver pontuação" para abrir painel lateral com score em tempo real
- Seções já completas colapsam automaticamente (mas podem ser reabertas)
- Indicador de itens não avaliados antes de finalizar

**Finalização:**
- Botão "Finalizar Inspeção" visível ao responder o último item (ou via menu)
- Se houver itens não avaliados: modal de confirmação "X itens não foram avaliados. Deseja finalizar mesmo assim?"
- Campo de observações gerais (opcional)
- Tela de resumo final antes de gerar PDF

---

### TELA 5 — Resumo e Relatório

**Após finalizar inspeção, mostrar:**

```
┌──────────────────────────────────────────────┐
│         RESULTADO DA INSPEÇÃO                 │
│                                              │
│  [Gráfico circular / donut]                  │
│         78% de Conformidade                  │
│         ● BOM                                │
│                                              │
│  ✓ Cumpre:          25 itens                 │
│  ✗ Não Cumpre:       8 itens                 │
│  — Não se aplica:    4 itens                 │
│  ○ Não avaliado:     2 itens                 │
│                                              │
│  ┌─ Por seção ──────────────────────────┐   │
│  │ Estrutura Física     ████████░░  80% │   │
│  │ Equipamentos         ██████████ 100% │   │
│  │ Higienização         █████░░░░░  60% │   │
│  │ Resíduos             ███████░░░  70% │   │
│  │ Documentação         ████░░░░░░  50% │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [📄 Gerar Relatório PDF]                    │
│  [📤 Compartilhar]   [🔙 Voltar]             │
└──────────────────────────────────────────────┘
```

---

### GERAÇÃO DO PDF — ESPECIFICAÇÃO DETALHADA

Usar **jsPDF + jspdf-autotable**. Geração 100% no navegador, sem servidor.

**Estrutura do PDF:**

**Página 1 — Capa:**
- Logo da consultoria (se configurada) no topo direito
- Título: "RELATÓRIO DE INSPEÇÃO SANITÁRIA"
- Subtítulo: nome do tipo de inspeção (ex: "Estabelecimento de Estética e Beleza")
- Dados do estabelecimento: nome, CNPJ, endereço, responsável
- Data da visita, nome da consultora
- Linha separadora
- Box de resultado geral:
  - Percentual grande e em negrito
  - Classificação (CRÍTICO / REGULAR / BOM / EXCELENTE) com cor de fundo correspondente
  - (vermelho / laranja / amarelo-verde / verde)
- Rodapé com nome da consultora e número de página

**Página 2 — Resumo executivo:**
- Tabela de pontuação por seção (seção | itens avaliados | cumpre | não cumpre | %)
- Box de observações gerais (se preenchido)

**Páginas seguintes — Não Conformidades:**
- Título da seção: "NÃO CONFORMIDADES IDENTIFICADAS"
- Para cada item que "Não Cumpre", exibir um bloco:
  ```
  [NC-001] Lavatório exclusivo para higienização das mãos...
  Base legal: RDC 665/2022, Art. 9º, §2º  ● ITEM CRÍTICO
  
  Situação encontrada:
  [texto digitado pela consultora]
  
  Ação corretiva:
  [texto digitado pela consultora]
  
  Evidências fotográficas: [fotos inseridas no PDF, max 2 por linha]
  ```
- Separador visual entre cada NC

**Última página — Assinatura:**
- "Este relatório foi elaborado com base nas legislações sanitárias vigentes."
- Linha para assinatura da consultora
- Nome e número do registro profissional (se configurado)
- Data e local

**Configurações do PDF:**
- Formato A4, orientação retrato
- Fonte: Helvetica (suportada pelo jsPDF sem embed)
- Cores: usar paleta consistente com o app
- Rodapé em todas as páginas: nome da consultora + "Página X de Y" + data

---

### TELA 6 — Configurações

- Nome da consultora (salvo em localStorage)
- Número do registro profissional (CRF, CRBM, CRN, etc.)
- Upload de logo para relatório (salvo em IndexedDB como base64, max 200KB)
- Seleção de tema: claro / escuro
- Informação da versão do app
- Botão "Limpar dados" (com confirmação dupla)

---

## DESIGN SYSTEM

**Paleta de cores:**
```css
--primary: #1E6B5E;        /* Verde escuro — cor principal */
--primary-light: #E8F5F2;  /* Verde claro — backgrounds */
--secondary: #2D5A8E;      /* Azul — ações secundárias */
--success: #22C55E;        /* Verde — cumpre */
--warning: #F59E0B;        /* Amarelo — atenção / regular */
--danger: #EF4444;         /* Vermelho — não cumpre / crítico */
--neutral: #6B7280;        /* Cinza — N/A */
--bg: #F9FAFB;             /* Fundo geral */
--surface: #FFFFFF;        /* Cards e superfícies */
--text-primary: #111827;
--text-secondary: #6B7280;
```

**Tipografia:** Inter (Google Fonts) ou system-ui como fallback

**Botões de resposta (cumpre/não cumpre/NA):**
- Tamanho mínimo 48px height para toque fácil em campo
- Estados visuais claros: não selecionado (outline), selecionado (filled), hover
- Transições suaves

**Cards de item:**
- Borda esquerda colorida por status (verde/vermelho/cinza)
- Itens críticos com badge "CRÍTICO" em vermelho
- Itens não avaliados com borda esquerda amarela tracejada

**Responsividade:**
- Mobile first
- Em tablet (≥768px): layout de duas colunas na lista de itens
- Em desktop (≥1024px): sidebar com navegação + conteúdo central

---

## CONFIGURAÇÃO DO SERVICE WORKER (PWA OFFLINE)

```javascript
// vite.config.ts — configuração do VitePWA
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'Inspeção Sanitária',
    short_name: 'InspecVISA',
    description: 'App de roteiro de inspeção sanitária',
    theme_color: '#1E6B5E',
    background_color: '#F9FAFB',
    display: 'standalone',
    orientation: 'any',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com/,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } }
      }
    ]
  }
})
```

---

## BANCO DE DADOS LOCAL (Dexie.js)

```typescript
// src/db/database.ts
import Dexie, { Table } from 'dexie';

export class InspectionDatabase extends Dexie {
  clients!: Table<Client>;
  templates!: Table<ChecklistTemplate>;
  inspections!: Table<Inspection>;
  responses!: Table<InspectionResponse>;
  photos!: Table<InspectionPhoto>;

  constructor() {
    super('InspectionDB');
    this.version(1).stores({
      clients:     '++id, category, name, createdAt',
      templates:   '++id, category',
      inspections: '++id, clientId, templateId, status, inspectionDate',
      responses:   '++id, inspectionId, itemId, result',
      photos:      '++id, responseId'
    });
  }
}

export const db = new InspectionDatabase();
```

**Ao inicializar o app:** verificar se templates existem no banco. Se não, popular com os dados de seed de `src/data/templates.ts`.

---

## COMPRESSÃO DE FOTOS

```typescript
// src/utils/imageUtils.ts
export async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}
```

---

## CÁLCULO DE PONTUAÇÃO

```typescript
// src/utils/scoring.ts
export function calculateScore(responses: InspectionResponse[], template: ChecklistTemplate): InspectionScore {
  const evaluatedResponses = responses.filter(r => r.result !== 'not_evaluated');
  const complies = responses.filter(r => r.result === 'complies');
  const notComplies = responses.filter(r => r.result === 'not_complies');
  const notApplicable = responses.filter(r => r.result === 'not_applicable');
  
  // Itens N/A não entram no denominador
  const denominator = evaluatedResponses.filter(r => r.result !== 'not_applicable').length;
  const percentage = denominator > 0 ? (complies.length / denominator) * 100 : 0;
  
  const classification = 
    percentage < 50 ? 'critical' :
    percentage < 70 ? 'regular' :
    percentage < 90 ? 'good' : 'excellent';
  
  return { /* ... campos calculados */ };
}
```

---

## ESTRUTURA DE PASTAS DO PROJETO

```
src/
├── components/
│   ├── ui/              # Componentes genéricos (Button, Card, Badge, Modal...)
│   ├── inspection/      # Componentes do fluxo de inspeção
│   │   ├── ChecklistItem.tsx
│   │   ├── PhotoCapture.tsx
│   │   ├── SectionAccordion.tsx
│   │   └── ScorePanel.tsx
│   ├── report/
│   │   └── PDFGenerator.tsx
│   └── layout/
│       ├── BottomNav.tsx
│       └── Sidebar.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Clients.tsx
│   ├── Inspections.tsx
│   ├── NewInspection.tsx
│   ├── InspectionExecution.tsx
│   ├── InspectionSummary.tsx
│   └── Settings.tsx
├── data/
│   └── templates.ts     # Roteiros seed
├── db/
│   └── database.ts      # Dexie setup
├── store/
│   ├── useInspectionStore.ts
│   └── useSettingsStore.ts
├── utils/
│   ├── scoring.ts
│   ├── imageUtils.ts
│   └── pdfGenerator.ts
└── types/
    └── index.ts         # Todas as interfaces TypeScript
```

---

## ORDEM DE BUILD RECOMENDADA PARA O AGENTE

Execute na seguinte ordem para evitar dependências quebradas:

1. **Setup do projeto:** `npm create vite@latest` com React + TypeScript, instalar todas as dependências
2. **Types e interfaces** (`src/types/index.ts`)
3. **Banco de dados Dexie** (`src/db/database.ts`)
4. **Dados seed dos templates** (`src/data/templates.ts`)
5. **Utilitários** (scoring, imageUtils, pdfGenerator)
6. **Stores Zustand** 
7. **Componentes UI base** (Button, Card, Badge, Modal)
8. **Componentes de inspeção** (ChecklistItem, PhotoCapture, SectionAccordion, ScorePanel)
9. **Páginas** na ordem: Settings → Clients → Dashboard → Inspections → NewInspection → InspectionExecution → InspectionSummary
10. **Roteamento** React Router
11. **Layout** (BottomNav, Sidebar)
12. **PDF Generator** (deixar por último pois depende de tudo)
13. **Configuração PWA** (vite.config.ts, service worker, ícones)
14. **Testes de funcionamento offline**

---

## REGRAS E RESTRIÇÕES DO PROJETO

- **NÃO** criar backend, API ou banco de dados remoto agora. Tudo local.
- **NÃO** usar autenticação/login no MVP. App é uso pessoal.
- **NÃO** usar bibliotecas pagas ou com licença restritiva.
- **SEMPRE** garantir que a compressão de foto ocorra antes de salvar no IndexedDB.
- **SEMPRE** testar o fluxo offline: abrir app, ativar modo avião, criar inspeção com foto, gerar PDF — deve funcionar 100%.
- **SEMPRE** que um item for marcado como "NÃO CUMPRE" o campo de situação deve ser obrigatório antes de avançar de seção (validação no frontend, não bloquear com alert — usar inline error message).
- **GARANTIR** que o PDF gerado seja legível e profissional o suficiente para ser entregue diretamente ao cliente.
- Nomenclatura em inglês no código (variáveis, funções, componentes), textos da UI em **português brasileiro**.

---

## DEPENDÊNCIAS A INSTALAR

```bash
npm install dexie zustand react-router-dom lucide-react jspdf jspdf-autotable
npm install -D vite-plugin-pwa workbox-window @types/node
```

---

## PRIMEIRA MISSÃO PARA O AGENTE

> Crie o projeto completo conforme a especificação acima. Comece pelo setup, types, banco de dados e os dados seed dos roteiros. Em seguida construa o fluxo principal: Nova Inspeção → Execução do Roteiro → Resumo → Geração de PDF. Priorize que o fluxo de campo funcione perfeitamente antes de polir o dashboard e o histórico. Ao final, configure o PWA para funcionamento offline completo e verifique que o app é instalável via "Adicionar à tela inicial" em mobile.

---

*Documento gerado para uso interno — C&C Consultoria Sanitária / TreinaVISA*
*Versão 2.0 — Março 2026 — Roteiros reais incorporados: 114 itens Estética + 105 itens ILPI*
