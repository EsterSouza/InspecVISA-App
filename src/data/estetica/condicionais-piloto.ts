// ============================================================
// src/data/estetica/condicionais-piloto.ts
// COND-10 — as árvores do piloto, no roteiro de Clínica de Estética e Saúde.
//
// Quatro árvores, não cem. O card pede "3 a 5 bem compreendidas", e cada uma
// aqui **substitui uma condicional que hoje está escrita dentro do texto do
// item** ("Quando processa produtos para saúde…", "Quando abrangido pela RDC
// 36/2013…"). Hoje a consultora lê o "quando", decide de cabeça e marca "não se
// aplica" à mão — o que não deixa rastro, não sai do denominador e não aparece
// no relatório. É esse trabalho manual que o motor assume.
//
// A justificativa sanitária de cada árvore está escrita no próprio objeto, ao
// lado da regra, e não num documento à parte: regra e razão não podem divergir.
//
// Estas árvores viram uma **revisão de rascunho** pelo script
// `scripts/cond10-seed-piloto.ts`. Publicar é decisão da consultora, na
// tela do editor, depois de passar pelo simulador (COND-07). Enquanto a revisão
// não for publicada, nada disto entra em campo.
//
// A flag que liga tudo — e o rollback — está em
// `src/domain/applicability/pilot.ts`.
// ============================================================

import { combinarPorAlvo, itensQuando, secaoQuando } from '../../domain/applicability/compose';
import type { ApplicabilityRule, RoutingQuestion } from '../../domain/applicability';

export interface PilotBranch {
  /** Nome curto da árvore, para a nota da revisão e para o simulador. */
  nome: string;
  /** Por que é legítimo tirar estes requisitos do relatório. Prosa, não slogan. */
  justificativa: string;
  /** O que deliberadamente NÃO entrou na árvore, e por quê. */
  ressalva?: string;
  question: RoutingQuestion;
  rules: ApplicabilityRule[];
}

// ─── 1 · Processamento de artigos no próprio local ───────────────────────────

const PROCESSA_ARTIGOS: PilotBranch = {
  nome: 'Processa artigos reutilizáveis no local',
  justificativa:
    'A RDC 15/2012 rege quem processa produto para saúde. Clínica que trabalha exclusivamente '
    + 'com material de uso único, ou que envia o instrumental para esterilização em empresa '
    + 'terceirizada regularizada, não tem centro de material: não há barreira técnica a avaliar, '
    + 'nem autoclave a qualificar, nem indicador biológico a monitorar. Hoje esses onze requisitos '
    + 'são marcados "não se aplica" um a um, entram no relatório como linhas vazias e distorcem a '
    + 'leitura do cliente sobre o que foi de fato inspecionado.',
  ressalva:
    'O est-045 — descarte de produto de uso único proibido de reprocessamento — fica FORA da '
    + 'árvore, e é por isso que a regra não vai na seção inteira: quem só usa descartável é '
    + 'exatamente quem precisa ser cobrado por não reprocessá-lo (RE 2.605/2006). Seção não '
    + 'aplicável arrasta todos os itens dela (contrato § 5.4), então salvar o est-045 exige '
    + 'regra item a item.',
  question: {
    id: 'q-processa-artigos',
    text: 'A unidade processa artigos reutilizáveis (esterilização) no próprio local?',
    type: 'boolean',
    askAt: 'execution',
    required: true,
    helpText:
      'Responda "não" quando todo o instrumental crítico for de uso único ou for esterilizado por '
      + 'empresa terceirizada. O descarte de uso único continua sendo avaliado de qualquer forma.',
  },
  rules: itensQuando('piloto-processa', 'q-processa-artigos', true, [
    'est-036', 'est-037', 'est-038', 'est-039', 'est-040', 'est-041',
    'est-042', 'est-043', 'est-044', 'est-046', 'est-047',
  ]),
};

// ─── 2 · Roupas e toalhas reutilizáveis ──────────────────────────────────────

const ROUPAS_REUTILIZAVEIS: PilotBranch = {
  nome: 'Usa roupas ou toalhas reutilizáveis',
  justificativa:
    'A seção de Processamento de Roupas trata de armazenamento, transporte e separação entre '
    + 'roupa limpa e usada — quatro requisitos que pressupõem que exista roupa a processar. '
    + 'Unidade que atende exclusivamente com lençol, campo e toalha descartáveis não processa '
    + 'roupa nenhuma, e avaliar a separação entre limpa e usada onde não há nem uma nem outra é '
    + 'não conformidade fantasma. Aqui a regra vai na SEÇÃO, porque os quatro itens saem juntos.',
  question: {
    id: 'q-roupas-reutilizaveis',
    text: 'A unidade utiliza roupas, campos ou toalhas reutilizáveis no atendimento?',
    type: 'boolean',
    askAt: 'execution',
    helpText:
      'Inclui lençol de maca, campo cirúrgico e toalha de uso do paciente. "Não" significa '
      + 'exclusivamente descartáveis.',
    // Sem `sectionId`: a pergunta que decide a seção não pode morar dentro dela.
  },
  rules: [secaoQuando('piloto-roupas', 'q-roupas-reutilizaveis', true, 'sec-est-10')],
};

// ─── 3 · Abrangência da RDC 36/2013 ──────────────────────────────────────────

const ABRANGENCIA_RDC36: PilotBranch = {
  nome: 'Abrangência da RDC 36/2013',
  justificativa:
    'A RDC 36/2013 institui o Núcleo de Segurança do Paciente e exclui do seu alcance os '
    + 'consultórios individualizados. Dois itens do roteiro já dizem "Quando abrangido pela RDC '
    + 'Anvisa nº 36/2013" no próprio texto — o Núcleo formalmente instituído e o método seguro de '
    + 'identificação do paciente. Num consultório de um profissional só, cobrar Núcleo de '
    + 'Segurança é exigir estrutura que a norma dispensa; e o est-059 é crítico, com peso 10, '
    + 'então marcá-lo à mão como "não se aplica" hoje é o que separa uma nota correta de uma nota '
    + 'inventada.',
  ressalva:
    'A identificação segura do paciente continua sendo boa prática mesmo fora da RDC 36 — o que '
    + 'a árvore retira é a EXIGÊNCIA normativa, não a recomendação. Se a consultora quiser '
    + 'registrar a orientação, o campo de observação da seção continua aberto.',
  question: {
    id: 'q-abrangencia-rdc36',
    text: 'Como o estabelecimento se enquadra na RDC 36/2013?',
    type: 'single_choice',
    askAt: 'execution',
    required: true,
    sectionId: 'sec-est-06',
    options: [
      { value: 'abrangido', label: 'Abrangido pela RDC 36/2013' },
      { value: 'consultorio_individualizado', label: 'Consultório individualizado — excluído do alcance' },
    ],
    helpText:
      'A RDC 36/2013 exclui expressamente os consultórios individualizados. Na dúvida, marque '
      + '"abrangido": o lado seguro é avaliar.',
  },
  rules: itensQuando('piloto-rdc36', 'q-abrangencia-rdc36', 'abrangido', ['est-055', 'est-059']),
};

// ─── 4 · Procedimento cirúrgico ──────────────────────────────────────────────

const PROCEDIMENTO_CIRURGICO: PilotBranch = {
  nome: 'Realiza procedimento cirúrgico',
  justificativa:
    'A lista de verificação de segurança cirúrgica existe para procedimento cirúrgico, e o texto '
    + 'do est-060 já traz o "quando realiza" dentro dele. Clínica que faz apenas procedimento '
    + 'estético não invasivo não tem cirurgia a conferir. É a árvore mais simples do piloto — um '
    + 'alvo, uma pergunta —, e serve de controle: se ela se comportar diferente das outras três, '
    + 'o problema é do motor, não da regra.',
  question: {
    id: 'q-procedimento-cirurgico',
    text: 'A unidade realiza procedimento cirúrgico?',
    type: 'boolean',
    askAt: 'execution',
    sectionId: 'sec-est-06',
  },
  rules: itensQuando('piloto-cirurgico', 'q-procedimento-cirurgico', true, ['est-060']),
};

// ─── 5 · Consultório de ginecologia, proctologia ou urologia ─────────────────

const SANITARIO_ANEXO: PilotBranch = {
  nome: 'Consultório de ginecologia, proctologia ou urologia',
  justificativa:
    'A nota da tabela da Unidade Funcional 1 da RDC 50/2002 exige sanitário para pacientes ANEXO '
    + 'ao consultório quando houver consultório de ginecologia, proctologia ou urologia — e só '
    + 'nesses casos. É requisito de SALA, e não de ato: vale mesmo que o exame seja feito em outro '
    + 'ambiente, e não vale para a clínica de estética que não tem nenhuma dessas especialidades. '
    + 'Sem a árvore, o est-115 aparece para todo mundo e é marcado "não se aplica" à mão na '
    + 'maioria das inspeções — exatamente o trabalho manual que o motor assume.',
  ressalva:
    'O sanitário para o público e o sanitário acessível continuam avaliados no est-027, fora da '
    + 'árvore: o anexo é ADICIONAL a eles e nunca os substitui. Responder "não" aqui não dispensa '
    + 'nenhum dos dois.',
  question: {
    id: 'q-consultorio-gineco-procto-uro',
    text: 'A unidade tem consultório de ginecologia, proctologia ou urologia?',
    type: 'boolean',
    askAt: 'execution',
    required: true,
    sectionId: 'sec-est-03',
    helpText:
      'O gatilho é o TIPO de consultório, e não o procedimento: responda "sim" mesmo que o exame '
      + 'seja realizado em outra sala.',
  },
  rules: itensQuando('piloto-sanitario-anexo', 'q-consultorio-gineco-procto-uro', true, ['est-115']),
};

export const PILOT_BRANCHES: readonly PilotBranch[] = [
  PROCESSA_ARTIGOS,
  ROUPAS_REUTILIZAVEIS,
  ABRANGENCIA_RDC36,
  PROCEDIMENTO_CIRURGICO,
  SANITARIO_ANEXO,
];

/** Id do roteiro no CATÁLOGO empacotado. Em produção o id é UUID — ver pilot.ts. */
export const PILOT_TEMPLATE_ID = 'tpl-estetica-clinica-v1';

/**
 * Id do roteiro em produção. As regras daqui nomeiam os alvos pelos ids do
 * catálogo (`est-036`, `sec-est-10`); o script de seed os traduz para os ids do
 * banco pela descrição normalizada, do mesmo jeito que `applySupplement` faz.
 */
export const PILOT_TEMPLATE_ID_PROD = '0c55f120-81e9-45d7-8ef5-04437d22a9a3';

export const PILOT_ROUTING_QUESTIONS: RoutingQuestion[] =
  PILOT_BRANCHES.map((branch) => branch.question);

export const PILOT_RULES: ApplicabilityRule[] =
  combinarPorAlvo(PILOT_BRANCHES.flatMap((branch) => branch.rules));

/** A nota que acompanha a revisão no banco — é o que a consultora lê antes de publicar. */
export function pilotRevisionNotes(): string {
  const linhas = PILOT_BRANCHES.map((branch, i) => {
    const alvos = branch.rules.length === 1
      ? `1 alvo`
      : `${branch.rules.length} alvos`;
    const ressalva = branch.ressalva ? `\n   Ressalva: ${branch.ressalva}` : '';
    return `${i + 1}. ${branch.nome} (${alvos})\n   ${branch.justificativa}${ressalva}`;
  });
  return [
    'COND-10 — piloto de condicionais do roteiro de Clínica de Estética e Saúde.',
    '',
    ...linhas,
  ].join('\n');
}
