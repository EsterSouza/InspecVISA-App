// ============================================================
// src/data/saude/condicionais-piloto-saude.ts
// COND-10 — as árvores do Roteiro de Inspeção — Serviços de Saúde (Base Federal).
//
// Escritas para a vistoria PRÉ-OPERACIONAL de 04/09/2026 — consultório de
// ginecologia em obra, Loja 11, Itaipava, Petrópolis/RJ —, que é a primeira a
// usar este roteiro e o caso que mais precisa do motor.
//
// ─── O que uma vistoria pré-operacional é, e o que ela não é ────────────────
//
// A unidade não abriu. Não há paciente, prontuário, contrato de coleta, laudo de
// potabilidade, registro de temperatura nem prática assistencial a observar.
// Hoje a consultora marca cada um desses requisitos como "não se aplica" à mão —
// dezenas deles —, o que não deixa rastro, não sai do denominador e faz o
// relatório de um canteiro de obra parecer o relatório de um serviço que fracassa
// em tudo.
//
// Mas pré-operacional NÃO é passe livre. A vistoria pré-operacional existe
// justamente para antecipar o que a autoridade sanitária vai exigir no
// licenciamento. Então o critério de corte é este, e vale para todas as árvores:
//
//   SAI    o que só pode ser comprovado por um serviço em operação — registro,
//          comprovante, laudo, ou observação de prática assistencial.
//
//   FICA   tudo que é projeto, ambiente, dimensão, fluxo, ou documento que
//          precisa estar pronto ANTES de abrir. Licença, CNPJ e CNAE,
//          responsável técnico, PBA, PGRSS, POPs, manual de rotinas, termo de
//          consentimento, PMOC, abrigo de resíduos, acessibilidade e a seção
//          inteira de Infraestrutura Física continuam sendo avaliados — é para
//          isso que a cliente contratou a visita.
//
// ─── Alvo repetido ──────────────────────────────────────────────────────────
//
// O motor guarda uma regra por alvo e a última vence, calada. `combinarPorAlvo`
// (domain/applicability/compose.ts) funde as regras que disputam o mesmo alvo
// somando as condições em `all`. É o que deixa o `sau-074` dizer a coisa certa:
// identificação segura do paciente é avaliada quando a unidade está em
// funcionamento **e** é abrangida pela RDC 36/2013.
// ============================================================

import { combinarPorAlvo, itensQuando, secaoQuando } from '../../domain/applicability/compose';
import type { ApplicabilityRule, RoutingQuestion } from '../../domain/applicability';

export interface PilotBranchSaude {
  nome: string;
  justificativa: string;
  /** O que deliberadamente NÃO entrou na árvore, e por quê. */
  ressalva?: string;
  question: RoutingQuestion;
  rules: ApplicabilityRule[];
}

// ─── 1 · A unidade já está em funcionamento ──────────────────────────────────

const EM_FUNCIONAMENTO: PilotBranchSaude = {
  nome: 'A unidade já está em funcionamento',
  justificativa:
    'Vinte e seis requisitos deste roteiro só podem ser comprovados por um serviço que já atende: '
    + 'comprovante de destinação de resíduo, laudo de potabilidade, registro de temperatura de '
    + 'termolábil, prontuário de paciente, certificado de calibração de equipamento ainda não '
    + 'instalado, e a observação direta da prática assistencial — uso de EPI, desinfecção entre '
    + 'pacientes, descarte de perfurocortante, abertura de material estéril. Numa unidade em obra '
    + 'nada disso existe, e exigir prova do que não pode existir não é rigor: é ruído que empurra a '
    + 'nota para baixo e esconde os achados que importam.',
  ressalva:
    'Ficam FORA da árvore, de propósito, todos os documentos e condições que a cliente precisa ter '
    + 'prontos ANTES de abrir, porque são exatamente o produto da vistoria pré-operacional: licença '
    + 'sanitária, CNPJ e CNAE, responsável técnico, PBA e submissão do projeto à VISA, PGRSS, POPs, '
    + 'manual de rotinas, contrato com empresa de resíduos, abrigo externo, termo de consentimento, '
    + 'orientações pós-procedimento, PMOC, guarda de prontuário, base legal da LGPD, rotinas de '
    + 'limpeza e a seção inteira de Infraestrutura Física. Marcar esses como não conformes é o '
    + 'objetivo da visita, não um efeito colateral dela.',
  question: {
    id: 'q-em-funcionamento',
    text: 'A unidade já está em funcionamento, atendendo pacientes?',
    type: 'boolean',
    askAt: 'wizard',
    required: true,
    helpText:
      'Responda "não" para vistoria pré-operacional — unidade em obra, reforma ou pronta mas ainda '
      + 'sem atendimento. Os requisitos de projeto, ambiente e documentação continuam sendo '
      + 'avaliados; saem apenas os que dependem de registro, comprovante ou prática já em curso.',
  },
  rules: itensQuando('saude-func', 'q-em-funcionamento', true, [
    // Registros, comprovantes e laudos que pressupõem operação
    'sau-081', // manutenção preventiva e calibração
    'sau-084', // produtos abertos identificados com data e validade
    'sau-085', // termolábeis: refrigerador exclusivo e registro de temperaturas
    'sau-093', // segregação no momento e no local da geração
    'sau-094', // recipientes compatíveis e identificados
    'sau-095', // sacos compatíveis e identificados
    'sau-096', // substituição do saco a dois terços
    'sau-098', // resíduo de medicamento seguindo o fluxo do PGRSS
    'sau-099', // comprovantes de destinação final
    'sau-100', // comprovante de controle de vetores
    'sau-101', // registro da limpeza semestral do reservatório
    'sau-102', // laudo de potabilidade
    'sau-107', // prontuários legíveis, assinados e protegidos
    'sau-108', // prontuário para cada paciente atendido
    'sau-111', // notificação compulsória
    'sau-132', // certificados de calibração dentro da validade
    // Observação da prática assistencial — não há atendimento a observar
    'sau-061', // não comer, beber ou guardar alimento no posto de trabalho
    'sau-062', // uso dos EPIs definidos para o risco do procedimento
    'sau-064', // desinfecção das superfícies entre pacientes
    'sau-065', // coletor de perfurocortante instalado e substituído no limite
    'sau-066', // não reencapar agulha
    'sau-068', // calçado fechado nas áreas de risco biológico
    'sau-069', // campo e instrumental estéreis abertos no momento do uso
    'sau-074', // identificação segura do paciente (composta com a RDC 36)
    'sau-078', // lote e validade registrados no prontuário
    'sau-128', // uniformes limpos e usados só nas dependências
  ]),
};

// ─── 2 · Processamento de artigos no próprio local ───────────────────────────

const PROCESSA_ARTIGOS: PilotBranchSaude = {
  nome: 'Processa artigos reutilizáveis no local',
  justificativa:
    'A RDC 15/2012 rege quem processa produto para saúde. Consultório que trabalha exclusivamente '
    + 'com material de uso único, ou que envia o instrumental para empresa processadora '
    + 'regularizada, não tem centro de material: não há classe a enquadrar, barreira técnica a '
    + 'avaliar, autoclave a qualificar nem indicador biológico a monitorar. São catorze requisitos '
    + 'de peso alto, quase todos críticos, que hoje entram no relatório como linhas vazias.',
  ressalva:
    'Dois itens da mesma seção ficam FORA da árvore, e é por isso que a regra é item a item e não '
    + 'na seção inteira (seção não aplicável arrasta todos os itens dela). O sau-058 — contrato e '
    + 'regularidade da empresa processadora — é justamente o que se cobra de quem terceiriza, ou '
    + 'seja, de quem responde "não" aqui. E o sau-059 — produto de uso único não é reprocessado — é '
    + 'o que se cobra de quem só usa descartável (RE 2.605/2006).',
  question: {
    id: 'q-processa-artigos-saude',
    text: 'A unidade processa artigos reutilizáveis (esterilização) no próprio local?',
    type: 'boolean',
    askAt: 'execution',
    required: true,
    helpText:
      'Responda "não" quando todo o instrumental crítico for de uso único ou for processado por '
      + 'empresa terceirizada. O contrato com a processadora e o descarte de uso único continuam '
      + 'sendo avaliados de qualquer forma.',
  },
  rules: itensQuando('saude-processa', 'q-processa-artigos-saude', true, [
    'sau-045', 'sau-046', 'sau-047', 'sau-048', 'sau-049', 'sau-050', 'sau-051',
    'sau-052', 'sau-053', 'sau-054', 'sau-055', 'sau-056', 'sau-057', 'sau-060',
  ]),
};

// ─── 3 · Roupas e toalhas reutilizáveis ──────────────────────────────────────

const ROUPAS_REUTILIZAVEIS: PilotBranchSaude = {
  nome: 'Usa roupas, campos ou toalhas reutilizáveis',
  justificativa:
    'A seção de Processamento de Roupas trata de armazenamento, transporte, terceirização e troca '
    + 'a cada paciente — quatro requisitos que pressupõem que exista roupa a processar. Consultório '
    + 'que atende exclusivamente com lençol, campo e toalha descartáveis não processa roupa '
    + 'nenhuma, e avaliar a separação entre limpa e usada onde não há nem uma nem outra é não '
    + 'conformidade fantasma. Aqui a regra vai na SEÇÃO, porque os quatro saem juntos.',
  question: {
    id: 'q-roupas-reutilizaveis-saude',
    text: 'A unidade utiliza roupas, campos ou toalhas reutilizáveis no atendimento?',
    type: 'boolean',
    askAt: 'execution',
    helpText:
      'Inclui lençol de maca, campo cirúrgico e toalha de uso do paciente. "Não" significa '
      + 'exclusivamente descartáveis.',
    // Sem `sectionId`: a pergunta que decide o destino de uma seção não pode
    // morar dentro dela, ou some junto com a resposta.
  },
  rules: [secaoQuando('saude-roupas', 'q-roupas-reutilizaveis-saude', true, 'sec-sau-10')],
};

// ─── 4 · Abrangência da RDC 36/2013 ──────────────────────────────────────────

const ABRANGENCIA_RDC36: PilotBranchSaude = {
  nome: 'Abrangência da RDC 36/2013',
  justificativa:
    'A RDC 36/2013 institui o Núcleo de Segurança do Paciente e exclui do seu alcance os '
    + 'consultórios individualizados. Quatro requisitos deste roteiro decorrem só dela, e três '
    + 'dizem "quando abrangido" no próprio texto: o Plano de Segurança do Paciente, o Núcleo '
    + 'formalmente instituído, a identificação segura do paciente e a comunicação não punitiva de '
    + 'incidentes. Num consultório de uma profissional só, cobrar Núcleo de Segurança é exigir '
    + 'estrutura que a norma dispensa — e o sau-074 é crítico, com peso 10, então marcá-lo à mão '
    + 'hoje é o que separa uma nota correta de uma nota inventada.',
  ressalva:
    'A identificação segura do paciente continua sendo boa prática fora da RDC 36 — o que a árvore '
    + 'retira é a EXIGÊNCIA normativa, não a recomendação. O sau-073 (notificação de evento adverso '
    + 'e queixa técnica) e o sau-137 (monitoramento de eventos e infecções) NÃO entram, porque '
    + 'também se apoiam na RDC 63/2011 e na regularização de produto, que independem da RDC 36.',
  question: {
    id: 'q-abrangencia-rdc36-saude',
    text: 'Como o estabelecimento se enquadra na RDC 36/2013?',
    type: 'single_choice',
    askAt: 'execution',
    required: true,
    sectionId: 'sec-sau-06',
    options: [
      { value: 'abrangido', label: 'Abrangido pela RDC 36/2013' },
      { value: 'consultorio_individualizado', label: 'Consultório individualizado — excluído do alcance' },
    ],
    helpText:
      'A RDC 36/2013 exclui expressamente os consultórios individualizados. Na dúvida, marque '
      + '"abrangido": o lado seguro é avaliar.',
  },
  rules: itensQuando('saude-rdc36', 'q-abrangencia-rdc36-saude', 'abrangido', [
    'sau-007', // Plano de Segurança do Paciente, "nos casos abrangidos"
    'sau-070', // Núcleo de Segurança do Paciente instituído
    'sau-074', // identificação segura do paciente (composta com "em funcionamento")
    'sau-139', // comunicação e notificação não punitiva
  ]),
};

// ─── 5 · Trabalhadores contratados ───────────────────────────────────────────

const POSSUI_EMPREGADOS: PilotBranchSaude = {
  nome: 'Possui trabalhadores contratados',
  justificativa:
    'PCMSO, PGR, registro de entrega de EPI, vacinação ocupacional e guarda de pertences são '
    + 'obrigações do empregador, nos termos das NR-1, NR-6, NR-7, NR-24 e NR-32. Profissional que '
    + 'atende sozinha, sem vínculo de emprego com ninguém, não tem a quem aplicá-las — e o sau-018 '
    + 'já traz o "quando possui empregados abrangidos" escrito no texto.',
  ressalva:
    'O sau-022 (capacitação inicial e continuada) e o sau-024 (fluxo de acidente com material '
    + 'biológico) NÃO entram: decorrem da RDC 63/2011 e alcançam a própria profissional, que se '
    + 'expõe a risco biológico igual. Tirar o fluxo de acidente de quem trabalha sozinha seria '
    + 'justamente tirá-lo de quem não tem quem socorra.',
  question: {
    id: 'q-possui-empregados',
    text: 'A unidade possui trabalhadores contratados?',
    type: 'boolean',
    askAt: 'wizard',
    required: true,
    helpText:
      'Vínculo de emprego, estágio ou terceirizado fixo no local. "Não" é a profissional que atende '
      + 'sozinha. As obrigações de biossegurança que alcançam a própria profissional continuam '
      + 'sendo avaliadas.',
  },
  rules: itensQuando('saude-empregados', 'q-possui-empregados', true, [
    'sau-018', 'sau-019', 'sau-020', 'sau-021', 'sau-023',
  ]),
};

// ─── 6 · Substâncias sujeitas a controle especial ────────────────────────────

const CONTROLE_ESPECIAL: PilotBranchSaude = {
  nome: 'Utiliza substância sujeita a controle especial',
  justificativa:
    'A Portaria SVS/MS nº 344/1998 alcança quem adquire, armazena ou dispensa substância das listas '
    + 'de controle especial. Três requisitos — documentação de aquisição, armazenamento em local '
    + 'trancado e balanço periódico — existem só por causa dela. Serviço que trabalha apenas com '
    + 'anestésico local, antisséptico e dispositivo implantável não movimenta nenhuma dessas '
    + 'substâncias, e a escrituração que se cobraria não teria conteúdo.',
  question: {
    id: 'q-controle-especial',
    text: 'A unidade adquire, armazena ou dispensa substância sujeita a controle especial (Portaria SVS/MS nº 344/1998)?',
    type: 'boolean',
    askAt: 'execution',
    sectionId: 'sec-sau-07',
    helpText:
      'Inclui as listas de entorpecentes, psicotrópicos, retinoides e imunossupressores. Anestésico '
      + 'local, antisséptico e dispositivo implantável não estão sujeitos a controle especial.',
  },
  rules: itensQuando('saude-c344', 'q-controle-especial', true, ['sau-087', 'sau-088', 'sau-089']),
};

export const PILOT_BRANCHES_SAUDE: readonly PilotBranchSaude[] = [
  EM_FUNCIONAMENTO,
  PROCESSA_ARTIGOS,
  ROUPAS_REUTILIZAVEIS,
  ABRANGENCIA_RDC36,
  POSSUI_EMPREGADOS,
  CONTROLE_ESPECIAL,
];

/** Id do roteiro no CATÁLOGO empacotado. Em produção o id é UUID — o piloto casa por NOME. */
export const PILOT_SAUDE_TEMPLATE_ID = 'tpl-saude-servicos-v1';

/** O nome, que é a chave que atravessa catálogo e banco. */
export const PILOT_SAUDE_TEMPLATE_NAME = 'Roteiro de Inspeção — Serviços de Saúde (Base Federal)';

export const PILOT_SAUDE_ROUTING_QUESTIONS: RoutingQuestion[] =
  PILOT_BRANCHES_SAUDE.map((branch) => branch.question);

/**
 * As regras, já fundidas por alvo. O `sau-074` é disputado por duas árvores e sai
 * daqui como uma regra só, com as duas condições em `all`.
 */
export const PILOT_SAUDE_RULES: ApplicabilityRule[] =
  combinarPorAlvo(PILOT_BRANCHES_SAUDE.flatMap((branch) => branch.rules));

/** A nota que acompanha a revisão no banco — é o que a consultora lê antes de publicar. */
export function pilotSaudeRevisionNotes(): string {
  const linhas = PILOT_BRANCHES_SAUDE.map((branch, i) => {
    const alvos = branch.rules.length === 1 ? '1 alvo' : `${branch.rules.length} alvos`;
    const ressalva = branch.ressalva ? `\n   Ressalva: ${branch.ressalva}` : '';
    return `${i + 1}. ${branch.nome} (${alvos})\n   ${branch.justificativa}${ressalva}`;
  });
  return [
    'COND-10 — piloto de condicionais do Roteiro de Serviços de Saúde (Base Federal).',
    '',
    'Critério de corte de todas as árvores: sai o que só pode ser comprovado por um serviço em',
    'operação (registro, comprovante, laudo, observação de prática). Fica tudo que é projeto,',
    'ambiente ou documento que precisa estar pronto antes de abrir.',
    '',
    ...linhas,
  ].join('\n');
}
