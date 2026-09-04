// ============================================================
// COND-10 — as árvores do Roteiro de Serviços de Saúde, e a fusão por alvo.
//
// O roteiro estreia numa vistoria PRÉ-OPERACIONAL: consultório de ginecologia em
// obra, Itaipava/Petrópolis, 04/09/2026. É o caso extremo do motor — a unidade
// não abriu, e dezenas de requisitos são registro, comprovante ou observação de
// prática que ainda não existem.
//
// O que este arquivo tranca não é "a regra roda", e sim as duas coisas que, se
// derem errado, dão errado em silêncio:
//
//   1. **Alvo repetido.** O motor guarda uma regra por alvo e a última vence,
//      sem erro. Duas árvores disputam o `sau-074`; se a fusão falhar, uma das
//      duas condições some e ninguém percebe.
//   2. **O critério de corte.** Pré-operacional não é passe livre: se a árvore
//      "em funcionamento" começar a arrastar infraestrutura, licença ou PBA,
//      ela apaga justamente o que a cliente contratou a visita para descobrir.
//      Por isso os testes afirmam o que FICA, não só o que sai.
// ============================================================

import { describe, expect, test } from 'vitest';
import { combinarPorAlvo, evaluateApplicability, publishGate } from '../../domain/applicability';
import type { ApplicabilityRule } from '../../domain/applicability';
import { applicabilityEnabled, gateByPilot } from '../../domain/applicability';
import { templateServicosSaude } from '../../data/saude/roteiro-servicos-saude';
import {
  PILOT_BRANCHES_SAUDE,
  PILOT_SAUDE_ROUTING_QUESTIONS,
  PILOT_SAUDE_RULES,
  PILOT_SAUDE_TEMPLATE_NAME,
  pilotSaudeRevisionNotes,
} from '../../data/saude/condicionais-piloto-saude';

const ARVORE = {
  sections: templateServicosSaude.sections,
  rules: PILOT_SAUDE_RULES,
  routingQuestions: PILOT_SAUDE_ROUTING_QUESTIONS,
};

/** Ids que saíram do roteiro com estas respostas. */
function foraCom(answers: Record<string, unknown>): string[] {
  const { items } = evaluateApplicability({ template: ARVORE, answers: answers as never });
  return Object.entries(items)
    .filter(([, decisao]) => decisao.state === 'nao_aplicavel_por_regra')
    .map(([id]) => id)
    .sort();
}

/** Ids ainda pendentes de definição — pergunta sem resposta. */
function pendentesCom(answers: Record<string, unknown>): string[] {
  const { items } = evaluateApplicability({ template: ARVORE, answers: answers as never });
  return Object.entries(items)
    .filter(([, decisao]) => decisao.state === 'pendente_de_condicao')
    .map(([id]) => id)
    .sort();
}

/** Todas respondidas como "sim/abrangido" — o serviço em plena operação. */
const TUDO_SIM = {
  'q-em-funcionamento': true,
  'q-processa-artigos-saude': true,
  'q-roupas-reutilizaveis-saude': true,
  'q-abrangencia-rdc36-saude': 'abrangido',
  'q-possui-empregados': true,
  'q-controle-especial': true,
};

/** O perfil da vistoria de 04/09/2026, como o contrato e a triagem descrevem. */
const CONSULTORIO_EM_OBRA = {
  ...TUDO_SIM,
  'q-em-funcionamento': false,
  'q-processa-artigos-saude': false,
  'q-roupas-reutilizaveis-saude': false,
  'q-abrangencia-rdc36-saude': 'consultorio_individualizado',
  'q-possui-empregados': false,
  'q-controle-especial': false,
};

describe('COND-10 saúde · o gate de publicação', () => {
  test('as seis árvores passam no gate sobre o roteiro real', () => {
    const gate = publishGate(ARVORE);
    expect(gate.blockers).toEqual([]);
    expect(gate.ready).toBe(true);
  });

  test('todo alvo de regra existe no roteiro — id inventado vira regra que nunca casa', () => {
    const secoes = new Set(templateServicosSaude.sections.map((s) => s.id));
    const itens = new Set(templateServicosSaude.sections.flatMap((s) => s.items.map((i) => i.id)));
    for (const regra of PILOT_SAUDE_RULES) {
      const conhecido = regra.target.type === 'section' ? secoes.has(regra.target.id) : itens.has(regra.target.id);
      expect(conhecido, `alvo desconhecido: ${regra.target.type} ${regra.target.id}`).toBe(true);
    }
  });

  test('toda pergunta citada por uma regra existe', () => {
    const perguntas = new Set(PILOT_SAUDE_ROUTING_QUESTIONS.map((q) => q.id));
    for (const regra of PILOT_SAUDE_RULES) {
      for (const condicao of regra.expression.conditions) {
        expect(perguntas.has(condicao.field), `pergunta ausente: ${condicao.field}`).toBe(true);
      }
    }
  });

  test('nenhum alvo aparece em duas regras — é o que o Map do evaluate descartaria calado', () => {
    const vistos = new Set<string>();
    for (const regra of PILOT_SAUDE_RULES) {
      const chave = `${regra.target.type}:${regra.target.id}`;
      expect(vistos.has(chave), `alvo repetido: ${chave}`).toBe(false);
      vistos.add(chave);
    }
  });
});

describe('COND-10 saúde · a fusão por alvo', () => {
  test('o sau-074 é disputado por duas árvores e sai como uma regra só, com as duas condições', () => {
    const brutas = PILOT_BRANCHES_SAUDE.flatMap((b) => b.rules).filter((r) => r.target.id === 'sau-074');
    expect(brutas).toHaveLength(2);

    const fundidas = PILOT_SAUDE_RULES.filter((r) => r.target.id === 'sau-074');
    expect(fundidas).toHaveLength(1);
    expect(fundidas[0].expression.combinator).toBe('all');
    expect(fundidas[0].expression.conditions.map((c) => c.field).sort())
      .toEqual(['q-abrangencia-rdc36-saude', 'q-em-funcionamento']);
  });

  test('a fusão é `all`: basta UMA condição falhar para o requisito sair', () => {
    // Em funcionamento, mas consultório individualizado → sai pela RDC 36.
    expect(foraCom({ ...TUDO_SIM, 'q-abrangencia-rdc36-saude': 'consultorio_individualizado' }))
      .toContain('sau-074');
    // Abrangido, mas ainda não abriu → sai por não haver paciente a identificar.
    expect(foraCom({ ...TUDO_SIM, 'q-em-funcionamento': false })).toContain('sau-074');
    // As duas satisfeitas → fica.
    expect(foraCom(TUDO_SIM)).not.toContain('sau-074');
  });

  test('condição repetida entra uma vez só', () => {
    const a: ApplicabilityRule = {
      id: 'a',
      target: { type: 'item', id: 'x' },
      expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q', operator: 'equals', value: true }] },
    };
    const fundida = combinarPorAlvo([a, { ...a, id: 'b' }]);
    expect(fundida).toHaveLength(1);
    expect(fundida[0].expression.conditions).toHaveLength(1);
  });

  test('grupo `any` disputando alvo levanta erro em vez de inventar expressão', () => {
    const all: ApplicabilityRule = {
      id: 'all',
      target: { type: 'item', id: 'x' },
      expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q1', operator: 'equals', value: true }] },
    };
    const any: ApplicabilityRule = {
      id: 'any',
      target: { type: 'item', id: 'x' },
      expression: { combinator: 'any', conditions: [{ source: 'question', field: 'q2', operator: 'equals', value: true }] },
    };
    expect(() => combinarPorAlvo([all, any])).toThrow(/combinador "any"/);
  });

  test('alvo sem disputa atravessa intacto, com o id original', () => {
    const soZinha = PILOT_SAUDE_RULES.find((r) => r.target.id === 'sau-102');
    expect(soZinha?.id).toBe('saude-func-sau-102');
  });
});

describe('COND-10 saúde · a vistoria pré-operacional', () => {
  test('a unidade que não abriu perde os 26 requisitos de registro e de prática', () => {
    const fora = foraCom({ ...TUDO_SIM, 'q-em-funcionamento': false });
    expect(fora).toHaveLength(26);
    // Registros e comprovantes que pressupõem operação
    expect(fora).toEqual(expect.arrayContaining([
      'sau-099', // comprovantes de destinação final
      'sau-102', // laudo de potabilidade
      'sau-108', // prontuário de cada paciente
      'sau-132', // certificados de calibração
    ]));
    // Observação da prática assistencial
    expect(fora).toEqual(expect.arrayContaining([
      'sau-062', // uso de EPI
      'sau-065', // coletor de perfurocortante
      'sau-069', // material estéril aberto no momento do uso
    ]));
  });

  test('o que a vistoria pré-operacional existe para achar CONTINUA sendo avaliado', () => {
    const fora = new Set(foraCom(CONSULTORIO_EM_OBRA));
    const precisaFicar = [
      'sau-001', // licença sanitária
      'sau-002', // CNPJ e CNAE coerentes
      'sau-003', // responsável técnico
      'sau-006', // PGRSS
      'sau-009', // POPs
      'sau-010', // PBA aprovado
      'sau-011', // projeto submetido antes da obra
      'sau-076', // termo de consentimento
      'sau-077', // orientações pós-procedimento
      'sau-092', // contrato com empresa de resíduos
      'sau-097', // abrigo externo de resíduos
      'sau-109', // guarda dos prontuários
      'sau-110', // base legal da LGPD
      'sau-126', // PMOC
      'sau-130', // rotina documentada de limpeza
    ];
    for (const id of precisaFicar) {
      expect(fora.has(id), `${id} não podia sair numa vistoria pré-operacional`).toBe(false);
    }
  });

  test('a seção inteira de Infraestrutura Física sobrevive — é o objeto da visita', () => {
    const fora = new Set(foraCom(CONSULTORIO_EM_OBRA));
    const infra = templateServicosSaude.sections.find((s) => s.id === 'sec-sau-03');
    expect(infra?.items.length).toBe(20);
    for (const item of infra!.items) {
      expect(fora.has(item.id), `${item.id} saiu da infraestrutura`).toBe(false);
    }
  });

  test('o perfil real de 04/09/2026 recorta o roteiro sem tocar em infraestrutura nem em documentação de abertura', () => {
    const fora = foraCom(CONSULTORIO_EM_OBRA);
    // 26 (não abriu) + 14 (não processa) + 4 (roupas, pela seção) + 3 (RDC 36,
    // já descontado o sau-074 que saiu com o grupo anterior) + 5 (sem
    // empregados) + 3 (sem controle especial).
    expect(fora).toHaveLength(55);

    const total = templateServicosSaude.sections.flatMap((s) => s.items).length;
    expect(total).toBe(139);
    expect(total - fora.length).toBe(84);
  });

  test('a seção de roupas sai inteira, e por herança — não por regra em cada item', () => {
    const { sections, items } = evaluateApplicability({ template: ARVORE, answers: CONSULTORIO_EM_OBRA as never });
    expect(sections['sec-sau-10'].state).toBe('nao_aplicavel_por_regra');
    expect(items['sau-103'].reason).toBe('inherited');
  });
});

describe('COND-10 saúde · o que NÃO entrou nas árvores, e é deliberado', () => {
  test('quem terceiriza o processamento continua sendo cobrado pelo contrato da processadora', () => {
    expect(foraCom({ ...TUDO_SIM, 'q-processa-artigos-saude': false })).not.toContain('sau-058');
  });

  test('quem só usa descartável continua sendo cobrado por não reprocessá-lo', () => {
    // RE 2.605/2006 — é exatamente de quem responde "não" que se cobra isto.
    expect(foraCom({ ...TUDO_SIM, 'q-processa-artigos-saude': false })).not.toContain('sau-059');
  });

  test('quem trabalha sozinha continua com o fluxo de acidente biológico e a capacitação', () => {
    const fora = foraCom({ ...TUDO_SIM, 'q-possui-empregados': false });
    expect(fora).not.toContain('sau-024'); // fluxo de acidente com material biológico
    expect(fora).not.toContain('sau-022'); // capacitação
    expect(fora).toHaveLength(5);
  });

  test('fora da RDC 36 continuam a notificação de queixa técnica e o monitoramento de eventos', () => {
    const fora = foraCom({ ...TUDO_SIM, 'q-abrangencia-rdc36-saude': 'consultorio_individualizado' });
    expect(fora).not.toContain('sau-073');
    expect(fora).not.toContain('sau-137');
    expect(fora.sort()).toEqual(['sau-007', 'sau-070', 'sau-074', 'sau-139']);
  });
});

describe('COND-10 saúde · pendência e flag', () => {
  test('enquanto ninguém responde, o requisito fica PENDENTE — nunca escondido', () => {
    const pendentes = pendentesCom({});
    expect(pendentes.length).toBe(55);
    expect(foraCom({})).toEqual([]);
  });

  test('a flag conhece o roteiro pelo NOME, porque o id do banco nasce depois da árvore', () => {
    // O roteiro entrou em produção com UUID; a lista do piloto foi escrita antes.
    expect(applicabilityEnabled('tpl-saude-servicos-v1')).toBe(true);
    expect(applicabilityEnabled('8f3a1e00-0000-4000-8000-000000000000', null, PILOT_SAUDE_TEMPLATE_NAME)).toBe(true);
    expect(applicabilityEnabled('8f3a1e00-0000-4000-8000-000000000000')).toBe(false);
  });

  test('roteiro arquivado não casa: o prefixo entra no nome', () => {
    expect(applicabilityEnabled(null, null, `[ARQUIVADO] ${PILOT_SAUDE_TEMPLATE_NAME}`)).toBe(false);
  });

  test('fora do piloto o motor não é consultado, mesmo com regra congelada', () => {
    const outro = gateByPilot({ ...ARVORE, id: 'tpl-outro-qualquer', name: 'Roteiro de Alimentos' });
    expect(outro.rules).toEqual([]);
    expect(outro.routingQuestions).toEqual([]);
  });

  test('dentro do piloto a árvore atravessa intacta', () => {
    const dentro = gateByPilot({ ...ARVORE, id: 'x', name: PILOT_SAUDE_TEMPLATE_NAME });
    expect(dentro.rules).toHaveLength(52);
  });
});

describe('COND-10 saúde · a nota da revisão', () => {
  test('traz o critério de corte e a justificativa de cada árvore', () => {
    const notas = pilotSaudeRevisionNotes();
    expect(notas).toContain('registro, comprovante, laudo, observação de prática');
    for (const branch of PILOT_BRANCHES_SAUDE) {
      expect(notas).toContain(branch.nome);
      expect(notas).toContain(branch.justificativa.slice(0, 60));
    }
  });
});
