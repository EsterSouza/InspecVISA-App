import type { ChecklistTemplate } from '../../types';

// ============================================================
// Roteiro de Inspeção — Serviços de Saúde (Base Federal)
//
// Nasce como cópia do roteiro de Clínica de Estética e Saúde
// (src/data/estetica/roteiro-clinica.ts), que já era, na prática, um roteiro
// de serviço de saúde com recorte estético. O que muda aqui:
//
//  - saem os itens que só existem por causa da fronteira estética/embelezamento
//    (bronzeamento artificial, venda de cosmético no balcão, fracionamento);
//  - entram duas seções que a estética não tinha — "Prontuário e Registro
//    Assistencial" e "Procedimentos Invasivos e Terapias" —, que é onde moram
//    consulta, procedimento invasivo ambulatorial, laser terapêutico,
//    imunobiológico e medicamento de uso no paciente;
//  - os títulos das doze seções herdadas são idênticos aos do roteiro de
//    estética, DE PROPÓSITO: `applySupplement` casa a seção por id **ou por
//    título**, e é isso que permite um único suplemento municipal servir aos
//    dois roteiros (ver src/data/saude/suplemento-petropolis.ts).
//
// `category: 'estetica'` não é engano. `ClientCategory` só admite
// 'estetica' | 'ilpi' | 'alimentos', e a categoria é o filtro do seletor de
// roteiro em NewInspection.tsx:300. Criar a categoria 'saude' mexe no tipo, nos
// formulários de cliente, nos filtros, nos crachás e no check constraint da
// tabela `clients` em produção — trabalho que não cabia na véspera da primeira
// vistoria que usa este roteiro. Enquanto isso, o cliente de saúde continua
// cadastrado como 'estetica' e vê os dois roteiros no seletor.
// ============================================================

export const templateServicosSaude: ChecklistTemplate = {
  id: 'tpl-saude-servicos-v1',
  name: 'Roteiro de Inspeção — Serviços de Saúde (Base Federal)',
  category: 'estetica',
  version: '09/2026',
  sections: [
    {
      id: 'sec-sau-01',
      title: 'Documentação e Regularização',
      order: 1,
      items: [
        // Texto idêntico ao est-001 de propósito: o suplemento municipal
        // substitui o item de licença pelo id estático `est-001`, e
        // `applySupplement` acha o equivalente aqui pelo texto normalizado.
        // Mudar esta frase quebra a substituição no roteiro de saúde em
        // silêncio — ver docs/roteiros/suplemento-substitui-por-descricao.
        { id: 'sau-001', sectionId: 'sec-sau-01', order: 1, description: 'Possui Licença Sanitária vigente e compatível com as atividades declaradas?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-002', sectionId: 'sec-sau-01', order: 2, description: 'O CNPJ, o CNAE e o escopo declarado no licenciamento são coerentes com os serviços prestados?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-003', sectionId: 'sec-sau-01', order: 3, description: 'Possui responsável técnico de nível superior legalmente habilitado, com vínculo e inscrição profissional comprovados?', legislation: 'RDC Anvisa nº 63/2011, arts. 4º e 29', weight: 10, isCritical: true },
        { id: 'sau-004', sectionId: 'sec-sau-01', order: 4, description: 'Há substituto técnico formalmente designado para os afastamentos do responsável técnico?', legislation: 'RDC Anvisa nº 63/2011, art. 4º', weight: 5, isCritical: false },
        { id: 'sau-005', sectionId: 'sec-sau-01', order: 5, description: 'O estabelecimento está cadastrado no Cadastro Nacional de Estabelecimentos de Saúde (CNES), com os serviços e profissionais atualizados?', legislation: 'Referência técnica: cadastro do estabelecimento e das equipes no CNES', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-006', sectionId: 'sec-sau-01', order: 6, description: 'Apresenta Plano de Gerenciamento de Resíduos de Serviços de Saúde implementado e compatível com os resíduos gerados?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-007', sectionId: 'sec-sau-01', order: 7, description: 'Nos casos abrangidos pela norma, apresenta Plano de Segurança do Paciente implantado e compatível com os riscos do serviço?', legislation: 'RDC Anvisa nº 36/2013', weight: 10, isCritical: true },
        { id: 'sau-008', sectionId: 'sec-sau-01', order: 8, description: 'Possui manual de rotinas que descreve os processos assistenciais e as condutas em caso de acidente ocupacional?', legislation: 'RDC Anvisa nº 63/2011; NR-32', weight: 10, isCritical: true },
        { id: 'sau-009', sectionId: 'sec-sau-01', order: 9, description: 'Possui procedimentos operacionais escritos para as atividades críticas efetivamente realizadas?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-010', sectionId: 'sec-sau-01', order: 10, description: 'Quando exigível, possui Projeto Básico de Arquitetura aprovado pela vigilância sanitária?', legislation: 'RDC Anvisa nº 51/2011', weight: 10, isCritical: true },
        { id: 'sau-011', sectionId: 'sec-sau-01', order: 11, description: 'Em obra de construção, reforma ou adaptação, o projeto físico foi submetido à autoridade sanitária antes do início da execução?', legislation: 'RDC Anvisa nº 51/2011; RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-012', sectionId: 'sec-sau-01', order: 12, description: 'Apresenta relação atualizada dos profissionais, com função, habilitação e registro profissional?', legislation: 'RDC Anvisa nº 63/2011, arts. 29 e 30', weight: 10, isCritical: true },
        { id: 'sau-013', sectionId: 'sec-sau-01', order: 13, description: 'Mantém memorial descritivo atualizado com os procedimentos, técnicas e tecnologias utilizados?', legislation: 'Referência técnica: memorial descritivo institucional', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-014', sectionId: 'sec-sau-01', order: 14, description: 'Mantém inventário atualizado dos equipamentos, com identificação e situação de regularização na Anvisa?', legislation: 'RDC Anvisa nº 509/2021; RDC Anvisa nº 751/2022', weight: 5, isCritical: false },
        { id: 'sau-015', sectionId: 'sec-sau-01', order: 15, description: 'Mantém contratos e comprovação de regularidade das empresas terceirizadas sujeitas a licenciamento?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-016', sectionId: 'sec-sau-01', order: 16, description: 'Mantém critérios documentados para qualificação e rastreabilidade dos fornecedores de insumos críticos?', legislation: 'Critério técnico de qualificação e rastreabilidade de fornecedores', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-017', sectionId: 'sec-sau-01', order: 17, description: 'Quando exigível pelas características da instalação e dos equipamentos, apresenta documentação técnica do aterramento elétrico?', legislation: 'NR-10; ABNT NBR 13534', weight: 2, isCritical: false },
      ],
    },
    {
      id: 'sec-sau-02',
      title: 'Saúde e Segurança do Trabalhador',
      order: 2,
      items: [
        { id: 'sau-018', sectionId: 'sec-sau-02', order: 1, description: 'Quando possui empregados abrangidos, apresenta PCMSO implantado e atualizado?', legislation: 'NR-7', weight: 1, isCritical: false },
        { id: 'sau-019', sectionId: 'sec-sau-02', order: 2, description: 'Apresenta PGR ou a documentação simplificada admitida para microempresa ou empresa de pequeno porte de grau de risco 1 ou 2?', legislation: 'NR-1', weight: 1, isCritical: false },
        { id: 'sau-020', sectionId: 'sec-sau-02', order: 3, description: 'Mantém registro de entrega dos EPIs indicados para os riscos, com Certificado de Aprovação válido?', legislation: 'NR-6', weight: 1, isCritical: false },
        { id: 'sau-021', sectionId: 'sec-sau-02', order: 4, description: 'Mantém registro da vacinação ocupacional indicada para os trabalhadores expostos a risco biológico?', legislation: 'NR-32', weight: 2, isCritical: false },
        { id: 'sau-022', sectionId: 'sec-sau-02', order: 5, description: 'Mantém registros de capacitação inicial e continuada dos trabalhadores para as atividades executadas?', legislation: 'RDC Anvisa nº 63/2011, art. 32', weight: 5, isCritical: false },
        { id: 'sau-023', sectionId: 'sec-sau-02', order: 6, description: 'Os trabalhadores dispõem de local próprio e seguro para guardar seus pertences?', legislation: 'NR-24', weight: 5, isCritical: false },
        { id: 'sau-024', sectionId: 'sec-sau-02', order: 7, description: 'Existe fluxo escrito de atendimento e notificação do acidente com material biológico, com profilaxia pós-exposição definida?', legislation: 'NR-32; RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-03',
      title: 'Infraestrutura Física',
      order: 3,
      items: [
        { id: 'sau-025', sectionId: 'sec-sau-03', order: 1, description: 'Pisos, paredes e tetos são íntegros e resistentes aos processos de limpeza e desinfecção aplicáveis ao ambiente?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-026', sectionId: 'sec-sau-03', order: 2, description: 'Os revestimentos das áreas críticas e semicríticas são lisos, laváveis, impermeáveis e sem frestas ou juntas abertas?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-027', sectionId: 'sec-sau-03', order: 3, description: 'O mobiliário assistencial está íntegro e permite limpeza e desinfecção compatíveis com seu uso?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-028', sectionId: 'sec-sau-03', order: 4, description: 'As instalações elétricas e hidráulicas estão protegidas e sem componentes expostos ou danificados?', legislation: 'RDC Anvisa nº 50/2002; NR-10', weight: 10, isCritical: true },
        { id: 'sau-029', sectionId: 'sec-sau-03', order: 5, description: 'A iluminação e a ventilação são compatíveis com as atividades realizadas em cada ambiente?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-030', sectionId: 'sec-sau-03', order: 6, description: 'Os ambientes existentes correspondem aos ambientes exigidos pelas atividades declaradas, sem uso de um ambiente para função incompatível?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-031', sectionId: 'sec-sau-03', order: 7, description: 'O consultório ou sala de atendimento possui área e dimensão mínima compatíveis com a atividade, conforme o dimensionamento da norma?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-032', sectionId: 'sec-sau-03', order: 8, description: 'A sala de procedimentos possui uso, identificação e dimensões compatíveis com as atividades executadas?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-033', sectionId: 'sec-sau-03', order: 9, description: 'A sala de procedimentos possui lavatório exclusivo para higiene das mãos, abastecido com sabonete líquido e papel-toalha?', legislation: 'RDC Anvisa nº 63/2011; RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-034', sectionId: 'sec-sau-03', order: 10, description: 'O lavatório de higiene das mãos é distinto da cuba usada na limpeza de instrumentais?', legislation: 'RDC Anvisa nº 15/2012; RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-035', sectionId: 'sec-sau-03', order: 11, description: 'Quando realiza atendimento ginecológico, urológico ou proctológico, dispõe de sanitário para pacientes anexo ao consultório?', legislation: 'RDC Anvisa nº 50/2002', weight: 5, isCritical: false },
        { id: 'sau-036', sectionId: 'sec-sau-03', order: 12, description: 'Os sanitários disponíveis são compatíveis com a capacidade e a organização funcional do serviço?', legislation: 'RDC Anvisa nº 50/2002; NR-24', weight: 10, isCritical: true },
        { id: 'sau-037', sectionId: 'sec-sau-03', order: 13, description: 'Possui depósito de material de limpeza com tanque e espaço exclusivo para saneantes e utensílios?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-038', sectionId: 'sec-sau-03', order: 14, description: 'Os ambientes estão organizados, limpos e livres de materiais em desuso ou alheios à atividade?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-039', sectionId: 'sec-sau-03', order: 15, description: 'A recepção e a espera estão funcionalmente separadas das áreas de procedimento?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-040', sectionId: 'sec-sau-03', order: 16, description: 'O fluxo de pessoas, materiais limpos, materiais sujos e resíduos evita cruzamento indevido entre limpo e sujo?', legislation: 'RDC Anvisa nº 50/2002; RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-041', sectionId: 'sec-sau-03', order: 17, description: 'O acesso ao estabelecimento e a circulação interna atendem à acessibilidade de pessoas com deficiência ou mobilidade reduzida?', legislation: 'ABNT NBR 9050', weight: 5, isCritical: false },
        { id: 'sau-042', sectionId: 'sec-sau-03', order: 18, description: 'Há ao menos um sanitário acessível disponível ao público, com as dimensões e as barras de apoio da norma técnica?', legislation: 'ABNT NBR 9050', weight: 5, isCritical: false },
        { id: 'sau-043', sectionId: 'sec-sau-03', order: 19, description: 'Quando há abertura para o exterior em área que exige controle de vetores, a janela possui proteção íntegra?', legislation: 'RDC Anvisa nº 50/2002', weight: 2, isCritical: false },
        { id: 'sau-044', sectionId: 'sec-sau-03', order: 20, description: 'Os ralos existentes em áreas críticas possuem sistema de fechamento e permanecem íntegros?', legislation: 'RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-04',
      title: 'Processamento de Artigos',
      order: 4,
      items: [
        { id: 'sau-045', sectionId: 'sec-sau-04', order: 1, description: 'Quando processa produtos para saúde, possui área com separação entre as etapas suja e limpa e fluxo unidirecional?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-046', sectionId: 'sec-sau-04', order: 2, description: 'O centro de material possui os ambientes mínimos exigidos para a sua classe: recepção e limpeza, preparo e esterilização, monitoramento do processo e armazenamento de material esterilizado?', legislation: 'RDC Anvisa nº 15/2012, art. 44', weight: 10, isCritical: true },
        { id: 'sau-047', sectionId: 'sec-sau-04', order: 3, description: 'Há barreira técnica entre o setor sujo e os setores limpos, com as medidas de comportamento definidas por escrito?', legislation: 'RDC Anvisa nº 15/2012, art. 46', weight: 10, isCritical: true },
        { id: 'sau-048', sectionId: 'sec-sau-04', order: 4, description: 'Os produtos processados são compatíveis com a classificação do centro de material do serviço?', legislation: 'RDC Anvisa nº 15/2012, art. 5º', weight: 10, isCritical: true },
        { id: 'sau-049', sectionId: 'sec-sau-04', order: 5, description: 'A limpeza dos instrumentais utiliza produto regularizado e método compatível com o material e com as instruções do fabricante?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-050', sectionId: 'sec-sau-04', order: 6, description: 'A cuba destinada à lavagem de instrumentais é exclusiva e está separada da área limpa?', legislation: 'RDC Anvisa nº 15/2012; RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-051', sectionId: 'sec-sau-04', order: 7, description: 'Os artigos críticos reutilizáveis são esterilizados em equipamento regularizado e compatível com o produto?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-052', sectionId: 'sec-sau-04', order: 8, description: 'Apresenta qualificação de instalação, operação e desempenho do equipamento de esterilização?', legislation: 'RDC Anvisa nº 15/2012, arts. 95 a 97', weight: 10, isCritical: true },
        { id: 'sau-053', sectionId: 'sec-sau-04', order: 9, description: 'Monitora cada carga com indicador químico e realiza controle biológico na frequência aplicável ao processo?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-054', sectionId: 'sec-sau-04', order: 10, description: 'A área de monitoramento da esterilização dispõe de incubadora de indicador biológico ou de contrato que assegure a leitura?', legislation: 'RDC Anvisa nº 15/2012, art. 42', weight: 5, isCritical: false },
        { id: 'sau-055', sectionId: 'sec-sau-04', order: 11, description: 'Mantém registros dos ciclos e dos resultados dos indicadores de esterilização?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-056', sectionId: 'sec-sau-04', order: 12, description: 'As embalagens são compatíveis com o método e estão identificadas com data de esterilização, prazo de validade e identificação do responsável?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-057', sectionId: 'sec-sau-04', order: 13, description: 'O material esterilizado é armazenado em local exclusivo, fechado e protegido de umidade, poeira e manipulação desnecessária?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-058', sectionId: 'sec-sau-04', order: 14, description: 'Quando terceiriza o processamento, mantém contrato e comprovação da regularidade da empresa processadora?', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
        { id: 'sau-059', sectionId: 'sec-sau-04', order: 15, description: 'Os produtos de uso único não são reprocessados, observada a lista de produtos com reprocessamento proibido?', legislation: 'RE Anvisa nº 2.605/2006; RDC Anvisa nº 156/2006', weight: 10, isCritical: true },
        { id: 'sau-060', sectionId: 'sec-sau-04', order: 16, description: 'Quando reprocessa produto permitido, possui protocolo validado com as fases do processo e o número máximo de reprocessamentos?', legislation: 'RE Anvisa nº 2.606/2006', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-05',
      title: 'Biossegurança',
      order: 5,
      items: [
        { id: 'sau-061', sectionId: 'sec-sau-05', order: 1, description: 'Os profissionais deixam de comer, beber ou guardar alimentos nos postos de trabalho?', legislation: 'NR-32', weight: 10, isCritical: true },
        { id: 'sau-062', sectionId: 'sec-sau-05', order: 2, description: 'Os profissionais utilizam os EPIs definidos para o risco de cada procedimento?', legislation: 'NR-32; RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-063', sectionId: 'sec-sau-05', order: 3, description: 'Disponibiliza preparação alcoólica regularizada nos pontos de assistência e adota protocolo de higiene das mãos?', legislation: 'RDC Anvisa nº 42/2010', weight: 5, isCritical: false },
        { id: 'sau-064', sectionId: 'sec-sau-05', order: 4, description: 'As superfícies de contato assistencial são limpas e desinfetadas entre pacientes?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-065', sectionId: 'sec-sau-05', order: 5, description: 'Os perfurocortantes são descartados em coletor rígido, instalado em suporte seguro e substituído antes de ultrapassar o limite?', legislation: 'RDC Anvisa nº 222/2018; NR-32', weight: 10, isCritical: true },
        { id: 'sau-066', sectionId: 'sec-sau-05', order: 6, description: 'É observada a proibição de reencapar agulha e de desconectá-la manualmente da seringa?', legislation: 'NR-32', weight: 10, isCritical: true },
        { id: 'sau-067', sectionId: 'sec-sau-05', order: 7, description: 'Utiliza barreira descartável nas superfícies que não podem ser desinfetadas adequadamente entre pacientes?', legislation: 'Manual do fabricante e consenso técnico de prevenção de contaminação cruzada', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-068', sectionId: 'sec-sau-05', order: 8, description: 'Os profissionais utilizam calçados fechados nas áreas com risco biológico?', legislation: 'NR-32', weight: 10, isCritical: true },
        { id: 'sau-069', sectionId: 'sec-sau-05', order: 9, description: 'O campo, o instrumental e os insumos usados em procedimento invasivo são estéreis e abertos no momento do uso?', legislation: 'RDC Anvisa nº 15/2012; RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-06',
      title: 'Segurança do Paciente',
      order: 6,
      items: [
        { id: 'sau-070', sectionId: 'sec-sau-06', order: 1, description: 'Quando abrangido pela RDC Anvisa nº 36/2013, possui Núcleo de Segurança do Paciente formalmente instituído?', legislation: 'RDC Anvisa nº 36/2013', weight: 2, isCritical: false },
        { id: 'sau-071', sectionId: 'sec-sau-06', order: 2, description: 'Possui protocolo de resposta a intercorrências com critérios e fluxo de encaminhamento definidos?', legislation: 'RDC Anvisa nº 63/2011; RDC Anvisa nº 36/2013', weight: 10, isCritical: true },
        { id: 'sau-072', sectionId: 'sec-sau-06', order: 3, description: 'Dispõe de recursos de resposta a intercorrências compatíveis com os procedimentos e mantém controle de validade?', legislation: 'RDC Anvisa nº 63/2011', weight: 5, isCritical: false },
        { id: 'sau-073', sectionId: 'sec-sau-06', order: 4, description: 'Registra e notifica eventos adversos e queixas técnicas de produtos e equipamentos pelos canais aplicáveis?', legislation: 'RDC Anvisa nº 36/2013; RDC Anvisa nº 509/2021; RDC Anvisa nº 751/2022', weight: 2, isCritical: false },
        { id: 'sau-074', sectionId: 'sec-sau-06', order: 5, description: 'Quando abrangido pela RDC Anvisa nº 36/2013, aplica método seguro de identificação do paciente antes do procedimento?', legislation: 'RDC Anvisa nº 36/2013', weight: 10, isCritical: true },
        { id: 'sau-075', sectionId: 'sec-sau-06', order: 6, description: 'Quando realiza procedimento cirúrgico ou invasivo, aplica lista de verificação compatível com o risco?', legislation: 'RDC Anvisa nº 36/2013', weight: 5, isCritical: false },
        { id: 'sau-076', sectionId: 'sec-sau-06', order: 7, description: 'Apresenta termo de consentimento específico para cada procedimento invasivo, com riscos, benefícios e alternativas informados?', legislation: 'Lei nº 8.078/1990, art. 6º, III', weight: 10, isCritical: true },
        { id: 'sau-077', sectionId: 'sec-sau-06', order: 8, description: 'Fornece orientações pós-procedimento por escrito, incluindo sinais de alerta e canal de contato?', legislation: 'Lei nº 8.078/1990, art. 6º, III', weight: 10, isCritical: true },
        { id: 'sau-078', sectionId: 'sec-sau-06', order: 9, description: 'Registra no prontuário o lote e a validade dos produtos e dispositivos utilizados em cada paciente?', legislation: 'RDC Anvisa nº 509/2021; RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-07',
      title: 'Equipamentos e Produtos',
      order: 7,
      items: [
        { id: 'sau-079', sectionId: 'sec-sau-07', order: 1, description: 'Os equipamentos sujeitos à vigilância sanitária estão regularizados na Anvisa e são usados na finalidade aprovada?', legislation: 'RDC Anvisa nº 751/2022 e suas atualizações', weight: 10, isCritical: true },
        { id: 'sau-080', sectionId: 'sec-sau-07', order: 2, description: 'Os manuais dos equipamentos estão disponíveis em português para consulta dos operadores?', legislation: 'RDC Anvisa nº 509/2021; manual do fabricante', weight: 1, isCritical: false },
        { id: 'sau-081', sectionId: 'sec-sau-07', order: 3, description: 'Mantém registros de manutenção preventiva e calibração na periodicidade definida pelo fabricante?', legislation: 'RDC Anvisa nº 509/2021', weight: 10, isCritical: true },
        { id: 'sau-082', sectionId: 'sec-sau-07', order: 4, description: 'Os saneantes estão regularizados e são preparados e utilizados conforme as instruções do fabricante?', legislation: 'Lei nº 6.360/1976', weight: 10, isCritical: true },
        { id: 'sau-083', sectionId: 'sec-sau-07', order: 5, description: 'Os medicamentos e produtos para saúde estão regularizados, dentro da validade e armazenados conforme o fabricante?', legislation: 'Lei nº 6.360/1976', weight: 10, isCritical: true },
        { id: 'sau-084', sectionId: 'sec-sau-07', order: 6, description: 'Os produtos abertos ou preparados para uso estão identificados com nome, data de abertura ou preparo e validade aplicável?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-085', sectionId: 'sec-sau-07', order: 7, description: 'Quando armazena medicamentos ou produtos termolábeis, utiliza refrigerador exclusivo e registra as temperaturas mínima e máxima?', legislation: 'RDC Anvisa nº 63/2011; RDC Anvisa nº 430/2020', weight: 10, isCritical: true },
        { id: 'sau-086', sectionId: 'sec-sau-07', order: 8, description: 'Mantém plano de contingência para preservar os termolábeis em caso de falha de energia ou do refrigerador?', legislation: 'Manual do fabricante e plano interno de contingência', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-087', sectionId: 'sec-sau-07', order: 9, description: 'Quando utiliza substâncias sujeitas a controle especial, mantém a documentação de aquisição e a escrituração aplicável?', legislation: 'Portaria SVS/MS nº 344/1998 e suas atualizações', weight: 5, isCritical: false },
        { id: 'sau-088', sectionId: 'sec-sau-07', order: 10, description: 'Os medicamentos sujeitos a controle especial são armazenados em local trancado e de acesso restrito?', legislation: 'Portaria SVS/MS nº 344/1998 e suas atualizações', weight: 5, isCritical: false },
        { id: 'sau-089', sectionId: 'sec-sau-07', order: 11, description: 'Quando exigível, mantém os balanços de substâncias sujeitas a controle especial atualizados?', legislation: 'Portaria SVS/MS nº 344/1998 e suas atualizações', weight: 5, isCritical: false },
        { id: 'sau-090', sectionId: 'sec-sau-07', order: 12, description: 'As amostras grátis são armazenadas nas condições definidas pelo fabricante e permanecem sob controle do profissional responsável?', legislation: 'Manual do fabricante e critério técnico de controle de amostras', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-091', sectionId: 'sec-sau-07', order: 13, description: 'Os medicamentos manipulados em uso estão identificados com a procedência, o paciente ou serviço destinatário e a validade?', legislation: 'RDC Anvisa nº 63/2011; RDC Anvisa nº 67/2007', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-08',
      title: 'Gestão de Resíduos',
      order: 8,
      items: [
        { id: 'sau-092', sectionId: 'sec-sau-08', order: 1, description: 'Mantém contrato com empresa licenciada para os grupos de resíduos gerados que exigem coleta externa especializada?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-093', sectionId: 'sec-sau-08', order: 2, description: 'Os resíduos são segregados conforme o grupo no momento e no local de sua geração?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-094', sectionId: 'sec-sau-08', order: 3, description: 'Os recipientes são compatíveis com o grupo de resíduo, permanecem íntegros e estão corretamente identificados?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-095', sectionId: 'sec-sau-08', order: 4, description: 'Os sacos utilizados são compatíveis e identificados conforme o grupo de resíduo acondicionado?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-096', sectionId: 'sec-sau-08', order: 5, description: 'Os sacos de resíduos infectantes são substituídos antes de atingir dois terços da capacidade ou no intervalo aplicável?', legislation: 'RDC Anvisa nº 222/2018, art. 14', weight: 10, isCritical: true },
        { id: 'sau-097', sectionId: 'sec-sau-08', order: 6, description: 'Quando exigível, o armazenamento externo de resíduos é identificado, protegido e compatível com a coleta realizada?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-098', sectionId: 'sec-sau-08', order: 7, description: 'Os resíduos de medicamentos e produtos químicos seguem o fluxo definido no PGRSS?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
        { id: 'sau-099', sectionId: 'sec-sau-08', order: 8, description: 'Mantém os comprovantes de destinação final emitidos pela empresa coletora?', legislation: 'RDC Anvisa nº 222/2018', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-09',
      title: 'Controle de Vetores e Qualidade da Água',
      order: 9,
      items: [
        { id: 'sau-100', sectionId: 'sec-sau-09', order: 1, description: 'Mantém comprovante válido do controle de vetores e pragas realizado por empresa regularizada?', legislation: 'RDC Anvisa nº 63/2011, art. 23', weight: 10, isCritical: true },
        { id: 'sau-101', sectionId: 'sec-sau-09', order: 2, description: 'Mantém registro da limpeza e desinfecção semestral do reservatório de água?', legislation: 'RDC Anvisa nº 63/2011, art. 39', weight: 10, isCritical: true },
        { id: 'sau-102', sectionId: 'sec-sau-09', order: 3, description: 'Quando o controle da potabilidade exige análise laboratorial, o laudo atende ao padrão vigente?', legislation: 'RDC Anvisa nº 63/2011; Portaria GM/MS nº 888/2021', weight: 10, isCritical: true },
      ],
    },
    {
      id: 'sec-sau-10',
      title: 'Processamento de Roupas',
      order: 10,
      items: [
        { id: 'sau-103', sectionId: 'sec-sau-10', order: 1, description: 'As roupas limpas são armazenadas em local limpo, fechado e separado das roupas usadas?', legislation: 'RDC Anvisa nº 63/2011', weight: 1, isCritical: false },
        { id: 'sau-104', sectionId: 'sec-sau-10', order: 2, description: 'As roupas usadas são acondicionadas e transportadas sem contato com as roupas limpas?', legislation: 'RDC Anvisa nº 63/2011', weight: 1, isCritical: false },
        { id: 'sau-105', sectionId: 'sec-sau-10', order: 3, description: 'Quando terceiriza o processamento de roupas, mantém contrato e comprovação de regularidade da lavanderia?', legislation: 'Critério técnico de controle de prestadores terceirizados', weight: 1, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-106', sectionId: 'sec-sau-10', order: 4, description: 'Os campos e lençóis reutilizáveis são trocados a cada paciente?', legislation: 'RDC Anvisa nº 63/2011', weight: 5, isCritical: false },
      ],
    },
    {
      id: 'sec-sau-11',
      title: 'Prontuário e Registro Assistencial',
      order: 11,
      items: [
        { id: 'sau-107', sectionId: 'sec-sau-11', order: 1, description: 'Os prontuários estão legíveis, identificados, assinados e protegidos contra acesso não autorizado?', legislation: 'RDC Anvisa nº 63/2011; Lei nº 13.709/2018', weight: 10, isCritical: true },
        { id: 'sau-108', sectionId: 'sec-sau-11', order: 2, description: 'Existe prontuário para cada paciente atendido, com registro do atendimento, da conduta e do profissional responsável?', legislation: 'RDC Anvisa nº 63/2011, art. 8º', weight: 10, isCritical: true },
        { id: 'sau-109', sectionId: 'sec-sau-11', order: 3, description: 'O local ou o sistema de guarda dos prontuários assegura confidencialidade, integridade e recuperação do registro?', legislation: 'RDC Anvisa nº 63/2011; Lei nº 13.709/2018', weight: 10, isCritical: true },
        { id: 'sau-110', sectionId: 'sec-sau-11', order: 4, description: 'O tratamento de dados pessoais de saúde tem base legal definida, com registro do consentimento quando exigido e política de privacidade disponível ao paciente?', legislation: 'Lei nº 13.709/2018', weight: 5, isCritical: false },
        { id: 'sau-111', sectionId: 'sec-sau-11', order: 5, description: 'Realiza a notificação compulsória dos agravos constantes da lista nacional vigente?', legislation: 'Portaria de Consolidação GM/MS nº 4/2017, Anexo V', weight: 10, isCritical: true },
        { id: 'sau-112', sectionId: 'sec-sau-11', order: 6, description: 'Quando registra imagem de paciente, possui autorização específica e guarda segregada do prontuário?', legislation: 'Lei nº 13.709/2018', weight: 5, isCritical: false },
      ],
    },
    {
      id: 'sec-sau-12',
      title: 'Procedimentos Invasivos e Terapias',
      order: 12,
      items: [
        { id: 'sau-113', sectionId: 'sec-sau-12', order: 1, description: 'Os procedimentos realizados estão dentro do rol declarado no licenciamento e são compatíveis com os ambientes existentes?', legislation: 'RDC Anvisa nº 63/2011; RDC Anvisa nº 50/2002', weight: 10, isCritical: true },
        { id: 'sau-114', sectionId: 'sec-sau-12', order: 2, description: 'Os procedimentos de saúde são executados por profissional legalmente habilitado ou sob sua supervisão, conforme aplicável?', legislation: 'RDC Anvisa nº 63/2011, arts. 29 e 30', weight: 10, isCritical: true },
        { id: 'sau-115', sectionId: 'sec-sau-12', order: 3, description: 'O procedimento invasivo ambulatorial é realizado em ambiente com superfícies laváveis, lavatório e apoio para material estéril, sem uso simultâneo para outra finalidade?', legislation: 'RDC Anvisa nº 50/2002; RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-116', sectionId: 'sec-sau-12', order: 4, description: 'Os dispositivos implantáveis utilizados têm registro na Anvisa e a rastreabilidade do lote é registrada no prontuário do paciente?', legislation: 'RDC Anvisa nº 751/2022; RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-117', sectionId: 'sec-sau-12', order: 5, description: 'Quando utiliza equipamento de radiação não ionizante, como laser ou luz intensa pulsada, o equipamento está regularizado na Anvisa e é operado na indicação aprovada?', legislation: 'RDC Anvisa nº 751/2022', weight: 10, isCritical: true },
        { id: 'sau-118', sectionId: 'sec-sau-12', order: 6, description: 'A sala em que o laser é operado tem acesso controlado durante o procedimento, sinalização de advertência e proteção ocular disponível para paciente e operador?', legislation: 'NR-32; manual do fabricante do equipamento', weight: 10, isCritical: true },
        { id: 'sau-119', sectionId: 'sec-sau-12', order: 7, description: 'O operador do equipamento de radiação não ionizante possui capacitação registrada para o equipamento utilizado?', legislation: 'NR-32; RDC Anvisa nº 63/2011, art. 32', weight: 5, isCritical: false },
        { id: 'sau-120', sectionId: 'sec-sau-12', order: 8, description: 'Quando administra medicamento injetável ou imunobiológico, existe rotina escrita de preparo, administração e observação pós-aplicação?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-121', sectionId: 'sec-sau-12', order: 9, description: 'A publicidade do serviço apresenta informações claras e não promete resultado garantido?', legislation: 'Lei nº 8.078/1990', weight: 2, isCritical: false },
      ],
    },
    {
      id: 'sec-sau-13',
      title: 'Requisitos Gerais',
      order: 13,
      items: [
        { id: 'sau-122', sectionId: 'sec-sau-13', order: 1, description: 'Os extintores estão acessíveis, sinalizados e dentro da validade indicada?', legislation: 'Plano de prevenção contra incêndio e instruções do Corpo de Bombeiros competente', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-123', sectionId: 'sec-sau-13', order: 2, description: 'As rotas de saída permanecem desobstruídas e sinalizadas?', legislation: 'Plano de prevenção contra incêndio e instruções do Corpo de Bombeiros competente', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-124', sectionId: 'sec-sau-13', order: 3, description: 'É observado o uso proibido de produtos fumígenos em recinto coletivo fechado?', legislation: 'Lei nº 9.294/1996, com redação da Lei nº 12.546/2011', weight: 10, isCritical: true },
        { id: 'sau-125', sectionId: 'sec-sau-13', order: 4, description: 'Os trabalhadores têm acesso a água potável em condições higiênicas?', legislation: 'NR-24', weight: 10, isCritical: true },
        { id: 'sau-126', sectionId: 'sec-sau-13', order: 5, description: 'Quando possui climatização artificial, mantém PMOC e registros de manutenção do sistema?', legislation: 'Lei nº 13.589/2018', weight: 10, isCritical: true },
        { id: 'sau-127', sectionId: 'sec-sau-13', order: 6, description: 'Os saneantes estão dentro da validade e armazenados no local destinado a material de limpeza?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-128', sectionId: 'sec-sau-13', order: 7, description: 'Os uniformes estão limpos, íntegros e são utilizados apenas nas dependências do serviço?', legislation: 'RDC Anvisa nº 63/2011', weight: 2, isCritical: false },
        { id: 'sau-129', sectionId: 'sec-sau-13', order: 8, description: 'Mantém canal identificado e registro do tratamento das reclamações recebidas?', legislation: 'Política interna de atendimento e tratamento de reclamações', weight: 2, isCritical: false, requirementType: 'good_practice' },
        { id: 'sau-130', sectionId: 'sec-sau-13', order: 9, description: 'Mantém rotina documentada de limpeza dos ambientes, com produto, frequência e responsável definidos?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-131', sectionId: 'sec-sau-13', order: 10, description: 'Mantém rotina documentada de limpeza externa dos equipamentos?', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
        { id: 'sau-132', sectionId: 'sec-sau-13', order: 11, description: 'Os certificados de calibração aplicáveis estão disponíveis e dentro da validade?', legislation: 'RDC Anvisa nº 509/2021', weight: 10, isCritical: true },
        { id: 'sau-133', sectionId: 'sec-sau-13', order: 12, description: 'Possui Plano de Gerenciamento de Tecnologias em Saúde elaborado por profissional habilitado e compatível com as tecnologias utilizadas?', legislation: 'RDC Anvisa nº 509/2021', weight: 2, isCritical: false },
        { id: 'sau-134', sectionId: 'sec-sau-13', order: 13, description: 'As orientações de emergência estão visíveis para trabalhadores e pacientes?', legislation: 'Plano interno de emergência e comunicação institucional', weight: 1, isCritical: false, requirementType: 'good_practice' },
      ],
    },
    {
      id: 'sec-sau-14',
      title: 'Gestão da Qualidade',
      order: 14,
      items: [
        { id: 'sau-135', sectionId: 'sec-sau-14', order: 1, description: 'Avalia periodicamente indicadores compatíveis com a qualidade e a segurança dos processos executados?', legislation: 'RDC Anvisa nº 63/2011', weight: 2, isCritical: false },
        { id: 'sau-136', sectionId: 'sec-sau-14', order: 2, description: 'Mantém orientação institucional que impede o reprocessamento dos produtos de uso único proibidos pela Anvisa?', legislation: 'RDC Anvisa nº 63/2011; RE Anvisa nº 2.605/2006', weight: 10, isCritical: true },
        { id: 'sau-137', sectionId: 'sec-sau-14', order: 3, description: 'Monitora eventos adversos, surtos e infecções relacionados à assistência prestada?', legislation: 'RDC Anvisa nº 36/2013; RDC Anvisa nº 63/2011', weight: 5, isCritical: false },
        { id: 'sau-138', sectionId: 'sec-sau-14', order: 4, description: 'Os profissionais possuem descrição documentada de atribuições, responsabilidades e autoridade?', legislation: 'RDC Anvisa nº 63/2011', weight: 2, isCritical: false },
        { id: 'sau-139', sectionId: 'sec-sau-14', order: 5, description: 'Quando abrangido pela RDC Anvisa nº 36/2013, promove comunicação e notificação não punitiva de incidentes?', legislation: 'RDC Anvisa nº 36/2013', weight: 2, isCritical: false },
      ],
    },
  ],
};
