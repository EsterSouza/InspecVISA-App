// ============================================================
// COND-10 — o piloto em Estética: a flag, o rollback e as quatro árvores.
//
// Duas coisas são verificadas aqui, e as duas antes de qualquer publicação:
//
//   · **As árvores estão corretas contra o roteiro REAL.** Não uma fixture: o
//     `templateEsteticaClinica` que a consultora usa em campo, passando pelo
//     validador e pelo gate de publicação de verdade (COND-07). Id de item
//     errado, ciclo ou operador incompatível reprovam aqui, não em produção.
//   · **O rollback devolve tudo.** Esvaziar o piloto tem de fazer todo requisito
//     voltar, em toda superfície, sem apagar resposta nenhuma.
// ============================================================

import { describe, expect, test } from 'vitest';
import {
  gateByPilot,
  publishGate,
  simulateTemplate,
  simulationInputs,
  validateTemplateRules,
} from '../../domain/applicability';
import {
  APPLICABILITY_PILOT,
  applicabilityEnabled,
  entryAllowsRevision,
  pilotEntryFor,
} from '../../domain/applicability/pilot';
import {
  PILOT_BRANCHES,
  PILOT_ROUTING_QUESTIONS,
  PILOT_RULES,
  PILOT_TEMPLATE_ID,
  PILOT_TEMPLATE_ID_PROD,
  pilotRevisionNotes,
} from '../../data/estetica/condicionais-piloto';
import { templateEsteticaClinica } from '../../data/estetica/roteiro-clinica';
import { applicableResults } from '../../utils/applicableResults';
import type { ChecklistTemplate, Inspection, InspectionResponse } from '../../types';

const COM_PILOTO = {
  ...templateEsteticaClinica,
  rules: PILOT_RULES,
  routingQuestions: PILOT_ROUTING_QUESTIONS,
} as ChecklistTemplate;

const TODOS_OS_ITENS = templateEsteticaClinica.sections.flatMap((s) => s.items.map((i) => i.id));

const idsDe = (template: ChecklistTemplate) =>
  template.sections.flatMap((s) => s.items.map((i) => i.id));

describe('COND-10 · as árvores do piloto contra o roteiro real', () => {
  test('o gate de publicação passa limpo', () => {
    const gate = publishGate(COM_PILOTO);
    expect(gate.blockers).toEqual([]);
    expect(gate.ready).toBe(true);
  });

  test('nenhuma regra aponta para item ou seção que não existe', () => {
    const secoes = new Set(templateEsteticaClinica.sections.map((s) => s.id));
    const itens = new Set(TODOS_OS_ITENS);

    for (const regra of PILOT_RULES) {
      const existe = regra.target.type === 'section' ? secoes.has(regra.target.id) : itens.has(regra.target.id);
      expect(existe, `alvo inexistente na regra ${regra.id}: ${regra.target.id}`).toBe(true);
    }
  });

  test('toda condição usa uma pergunta declarada', () => {
    const perguntas = new Set(PILOT_ROUTING_QUESTIONS.map((q) => q.id));
    for (const regra of PILOT_RULES) {
      for (const condicao of regra.expression.conditions) {
        expect(condicao.source).toBe('question');
        expect(perguntas.has(condicao.field), `pergunta desconhecida em ${regra.id}`).toBe(true);
      }
    }
    // E o inverso: pergunta declarada que nenhuma regra usa é pergunta de campo
    // sem efeito — a consultora responderia à toa.
    const usadas = new Set(PILOT_RULES.flatMap((r) => r.expression.conditions.map((c) => c.field)));
    for (const pergunta of PILOT_ROUTING_QUESTIONS) {
      expect(usadas.has(pergunta.id), `pergunta sem regra: ${pergunta.id}`).toBe(true);
    }
    expect(simulationInputs(COM_PILOTO).questions.map((q) => q.id).sort())
      .toEqual([...perguntas].sort());
  });

  test('cada árvore tem justificativa sanitária escrita', () => {
    expect(PILOT_BRANCHES).toHaveLength(4);
    for (const branch of PILOT_BRANCHES) {
      expect(branch.nome.length).toBeGreaterThan(8);
      expect(branch.justificativa.length).toBeGreaterThan(200);
      expect(branch.rules.length).toBeGreaterThan(0);
    }
    expect(pilotRevisionNotes()).toContain('Processa artigos reutilizáveis no local');
  });

  test('o validador não acha nada, nem aviso de opção órfã', () => {
    expect(validateTemplateRules(COM_PILOTO).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('COND-10 · o que cada árvore tira, e o que ela deixa', () => {
  const simular = (answers: Record<string, unknown>) =>
    simulateTemplate({ template: COM_PILOTO, scenario: { answers } });

  const foraPorRegra = (answers: Record<string, unknown>) => {
    const r = simular(answers);
    return r.sections.flatMap((s) =>
      s.decision.state === 'nao_aplicavel_por_regra'
        ? s.items.map((i) => i.id)
        : s.items.filter((i) => i.decision.state === 'nao_aplicavel_por_regra').map((i) => i.id)
    );
  };

  const TUDO_SIM = {
    'q-processa-artigos': true,
    'q-roupas-reutilizaveis': true,
    'q-abrangencia-rdc36': 'abrangido',
    'q-procedimento-cirurgico': true,
  };

  test('com tudo "sim", o roteiro é o de hoje — nenhum requisito sai', () => {
    expect(foraPorRegra(TUDO_SIM)).toEqual([]);
  });

  test('não processa artigos: saem 11 requisitos, e o descarte de uso único FICA', () => {
    const fora = foraPorRegra({ ...TUDO_SIM, 'q-processa-artigos': false });

    expect(fora).toHaveLength(11);
    expect(fora).toContain('est-036');
    expect(fora).toContain('est-047');
    // A ressalva da árvore, virada teste: quem só usa descartável é justamente
    // quem precisa ser cobrado por não reprocessá-lo (RE 2.605/2006).
    expect(fora).not.toContain('est-045');
  });

  test('sem roupa reutilizável: a seção inteira sai, com os quatro itens', () => {
    const fora = foraPorRegra({ ...TUDO_SIM, 'q-roupas-reutilizaveis': false });
    expect(fora).toEqual(['est-088', 'est-089', 'est-090', 'est-091']);
  });

  test('consultório individualizado: saem os dois itens da RDC 36/2013', () => {
    const fora = foraPorRegra({ ...TUDO_SIM, 'q-abrangencia-rdc36': 'consultorio_individualizado' });
    expect(fora).toEqual(['est-055', 'est-059']);
    // E só eles: o protocolo de intercorrência e o registro de lote continuam.
    expect(fora).not.toContain('est-056');
    expect(fora).not.toContain('est-062');
  });

  test('sem procedimento cirúrgico: sai só a lista de verificação', () => {
    expect(foraPorRegra({ ...TUDO_SIM, 'q-procedimento-cirurgico': false })).toEqual(['est-060']);
  });

  test('o pior caso combinado ainda deixa a maior parte do roteiro em pé', () => {
    const fora = foraPorRegra({
      'q-processa-artigos': false,
      'q-roupas-reutilizaveis': false,
      'q-abrangencia-rdc36': 'consultorio_individualizado',
      'q-procedimento-cirurgico': false,
    });
    expect(fora).toHaveLength(18);
    expect(TODOS_OS_ITENS.length - fora.length).toBeGreaterThan(80);
  });

  test('sem responder nada, nada some — os alvos ficam pendentes', () => {
    const resultado = simular({});
    const escondidos = resultado.sections.flatMap((s) =>
      s.items.filter((i) => i.decision.state === 'nao_aplicavel_por_regra')
    );
    expect(escondidos).toEqual([]);
    expect(resultado.itemCounts.pendente_de_condicao).toBe(18);
  });
});

describe('COND-10 · a flag', () => {
  test('o piloto é curto e nomeado: estética primeiro, saúde depois', () => {
    // Dois roteiros, não "todos". Cada entrada carrega a justificativa escrita,
    // que é o que o card exige — e é o que impede a lista de crescer no braço.
    expect(APPLICABILITY_PILOT).toHaveLength(2);
    expect(APPLICABILITY_PILOT[0].templateIds).toContain(PILOT_TEMPLATE_ID);
    expect(pilotEntryFor(PILOT_TEMPLATE_ID)?.justificativa).toContain('suplementos regionais');
    for (const entrada of APPLICABILITY_PILOT) {
      expect(entrada.justificativa.length).toBeGreaterThan(80);
    }
  });

  test('a flag conhece o id do BANCO, não só o do catálogo', () => {
    // Sem isto o piloto inteiro seria inerte em produção: a inspeção congela o
    // roteiro que veio do banco, cujo id é UUID. Mesmo descasamento que já mordeu
    // o `replacesItemId` dos suplementos.
    expect(PILOT_TEMPLATE_ID_PROD).not.toBe(PILOT_TEMPLATE_ID);
    expect(applicabilityEnabled(PILOT_TEMPLATE_ID_PROD)).toBe(true);
    expect(APPLICABILITY_PILOT[0].templateIds).toContain(PILOT_TEMPLATE_ID_PROD);
  });

  test('roteiro fora do piloto tem o motor desligado', () => {
    expect(applicabilityEnabled('tpl-ilpi-federal-v1')).toBe(false);
    expect(applicabilityEnabled('tpl-alimentos-federal-v1')).toBe(false);
    expect(applicabilityEnabled(undefined)).toBe(false);
    expect(applicabilityEnabled(PILOT_TEMPLATE_ID)).toBe(true);
  });

  test('id desconhecido com NOME de roteiro do piloto liga assim mesmo', () => {
    // O roteiro de Serviços de Saúde entrou no banco depois desta lista: sem o
    // casamento por nome ele nasceria com o motor desligado em produção, que é o
    // mesmo tipo de descasamento silencioso do `replacesItemId`.
    expect(applicabilityEnabled('uuid-que-ninguem-conhece')).toBe(false);
    expect(applicabilityEnabled(
      'uuid-que-ninguem-conhece',
      null,
      'Roteiro de Inspeção — Serviços de Saúde (Base Federal)'
    )).toBe(true);
  });

  test('entrada presa a uma revisão só liga naquela revisão', () => {
    const presa = { templateId: 'tpl-x', revision: 3, justificativa: 'teste' };

    expect(entryAllowsRevision(presa, 3)).toBe(true);
    // Publicar a revisão 4 NÃO a coloca em campo: ela passa pelo piloto de novo.
    expect(entryAllowsRevision(presa, 4)).toBe(false);
    // Snapshot antigo, sem número de revisão: o lado seguro é o motor desligado.
    expect(entryAllowsRevision(presa, undefined)).toBe(false);
    expect(entryAllowsRevision(presa, null)).toBe(false);
  });

  test('entrada sem revisão presa aceita qualquer publicada', () => {
    const solta = { templateId: 'tpl-y', justificativa: 'teste' };
    expect(entryAllowsRevision(solta, 1)).toBe(true);
    expect(entryAllowsRevision(solta, 9)).toBe(true);
    expect(entryAllowsRevision(solta, undefined)).toBe(true);
  });

  test('gateByPilot esvazia as regras de roteiro fora do piloto', () => {
    // O nome precisa mudar junto com o id: desde que o gate casa por nome, um
    // roteiro com o nome do piloto continua no piloto, e é isso que se quer.
    const foraDoPiloto = { ...COM_PILOTO, id: 'tpl-ilpi-federal-v1', name: 'Roteiro de ILPI' } as ChecklistTemplate;
    const passado = gateByPilot(foraDoPiloto);
    expect(passado.rules).toEqual([]);
    expect(passado.routingQuestions).toEqual([]);
    // As seções e os itens seguem intactos: o gate mexe na regra, nunca na árvore.
    expect(idsDe(passado as ChecklistTemplate)).toEqual(TODOS_OS_ITENS);
  });

  test('gateByPilot deixa o roteiro do piloto passar inteiro', () => {
    expect(gateByPilot(COM_PILOTO).rules).toHaveLength(PILOT_RULES.length);
  });

  test('roteiro sem regra atravessa o gate sem cópia', () => {
    const semRegra = { ...templateEsteticaClinica, rules: undefined, routingQuestions: undefined } as ChecklistTemplate;
    expect(gateByPilot(semRegra)).toBe(semRegra);
  });
});

describe('COND-10 · o rollback', () => {
  const resposta = (itemId: string, result: string): InspectionResponse => ({
    id: `r-${itemId}`, itemId, result, createdAt: new Date('2026-09-03'),
  } as unknown as InspectionResponse);

  // Uma inspeção que rodou COM o motor ligado: respondeu tudo e depois declarou
  // que não processa artigos. As respostas de est-036 e est-047 ficaram gravadas.
  const RESPOSTAS = [
    resposta('est-036', 'not_complies'),
    resposta('est-045', 'complies'),
    resposta('est-047', 'complies'),
  ];
  const INSPECAO = {
    routingAnswers: {
      'q-processa-artigos': false,
      'q-roupas-reutilizaveis': true,
      'q-abrangencia-rdc36': 'abrangido',
      'q-procedimento-cirurgico': true,
    },
  } as unknown as Inspection;

  test('com o motor ligado, os 11 saem do resultado e as respostas ficam guardadas', () => {
    const { template, counts } = applicableResults(COM_PILOTO, INSPECAO, RESPOSTAS);

    expect(idsDe(template)).not.toContain('est-036');
    expect(idsDe(template)).toContain('est-045');
    expect(counts.foraPorRegra).toBe(11);
    // Duas das respostas gravadas são de requisito que saiu — e a tela conta.
    expect(counts.foraComResposta).toBe(2);
  });

  test('desligando o piloto, TODO requisito volta e nenhuma resposta se perdeu', () => {
    // Rollback é exatamente isto: o roteiro deixa de estar na lista do piloto.
    const comoSeForaDoPiloto = { ...COM_PILOTO, id: 'tpl-fora-do-piloto', name: 'Roteiro qualquer' } as ChecklistTemplate;
    const { template, counts } = applicableResults(comoSeForaDoPiloto, INSPECAO, RESPOSTAS);

    expect(idsDe(template)).toEqual(TODOS_OS_ITENS);
    expect(counts.foraPorRegra).toBe(0);
    expect(counts.pendentes).toBe(0);
    expect(counts.aplicaveis).toBe(TODOS_OS_ITENS.length);
    // As três respostas continuam válidas e contadas — inclusive as duas que
    // estavam fora por regra um instante atrás.
    expect(counts.respondidos).toBe(3);
  });

  test('o rollback não muda a árvore de um roteiro que nunca teve regra', () => {
    const semRegra = { ...templateEsteticaClinica } as ChecklistTemplate;
    expect(idsDe(applicableResults(semRegra, undefined, RESPOSTAS).template)).toEqual(TODOS_OS_ITENS);
  });
});
