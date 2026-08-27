// ============================================================
// COND-08 — a resposta de roteamento atravessando o sync.
//
// Duas garantias, e as duas são de perda de dado:
//
//   · o mapeamento leva as três chaves ao servidor, e **não** as apaga quando o
//     servidor volta sem elas (deploy anterior à migration, ou o caminho do
//     bundle de um app antigo);
//   · a reconciliação converge POR PERGUNTA — o merge de registro inteiro
//     (`{...local, ...remote}`) apagaria a resposta que a colega deu offline a
//     outra pergunta (contrato § 6.5).
// ============================================================

import { describe, expect, test } from 'vitest';
import { mapFromPostgres, mapToPostgres } from '../../services/inspectionService';
import type { InspectionRow } from '../../services/inspectionService';
import { reconcileRoutingAnswers } from '../../utils/routingAnswersSync';
import type { Inspection } from '../../types';

const AGORA = new Date('2026-08-27T12:00:00.000Z');

function inspecao(extra: Partial<Inspection> = {}): Inspection {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    clientId: '20000000-0000-4000-8000-000000000001',
    templateId: 'tpl-estetica',
    consultantName: 'Ester',
    inspectionDate: AGORA,
    status: 'in_progress',
    createdAt: AGORA,
    updatedAt: AGORA,
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ...extra,
  } as Inspection;
}

function linha(extra: Partial<InspectionRow> = {}): InspectionRow {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    client_id: '20000000-0000-4000-8000-000000000001',
    template_id: 'tpl-estetica',
    consultant_name: 'Ester',
    consultant_names: null,
    inspection_date: AGORA.toISOString(),
    status: 'in_progress',
    observations: null,
    created_at: AGORA.toISOString(),
    updated_at: AGORA.toISOString(),
    tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ...extra,
  } as unknown as InspectionRow;
}

describe('COND-08 · o mapeamento', () => {
  test('leva contexto congelado e respostas de roteamento ao servidor', () => {
    const linhaPg = mapToPostgres(inspecao({
      applicabilityContext: { uf: 'RJ' },
      routingAnswers: { 'q-processa': true },
      routingAnswersMeta: { 'q-processa': { at: '2026-08-27T10:00:00.000Z', by: 'Ester' } },
    })) as Record<string, unknown>;

    expect(linhaPg.applicability_context).toEqual({ uf: 'RJ' });
    expect(linhaPg.routing_answers).toEqual({ 'q-processa': true });
    expect((linhaPg.routing_answers_meta as Record<string, { by: string }>)['q-processa'].by).toBe('Ester');
  });

  test('inspeção sem roteamento NÃO envia as colunas novas', () => {
    // Compatibilidade com banco que ainda não recebeu a migration: coluna que não
    // existe derruba o upsert inteiro, e nenhuma inspeção de hoje tem o que enviar.
    const linhaPg = mapToPostgres(inspecao()) as Record<string, unknown>;
    expect('routing_answers' in linhaPg).toBe(false);
    expect('routing_answers_meta' in linhaPg).toBe(false);
    expect('applicability_context' in linhaPg).toBe(false);
  });

  test('objeto vazio também não vira coluna', () => {
    const linhaPg = mapToPostgres(inspecao({ routingAnswers: {}, applicabilityContext: {} })) as Record<string, unknown>;
    expect('routing_answers' in linhaPg).toBe(false);
    expect('applicability_context' in linhaPg).toBe(false);
  });

  test('resposta apagada continua viajando: a chave fica, com null explícito', () => {
    const linhaPg = mapToPostgres(inspecao({ routingAnswers: { 'q-processa': null } })) as Record<string, unknown>;
    expect(linhaPg.routing_answers).toEqual({ 'q-processa': null });
  });

  test('servidor sem as colunas não emite as chaves: o merge não apaga o que é local', () => {
    const vindo = mapFromPostgres(linha());
    expect('routingAnswers' in vindo).toBe(false);
    expect('applicabilityContext' in vindo).toBe(false);

    const local = inspecao({ routingAnswers: { 'q-processa': true } });
    expect({ ...local, ...vindo }.routingAnswers).toEqual({ 'q-processa': true });
  });

  test('jsonb ilegível não vira resposta', () => {
    const vindo = mapFromPostgres(linha({ routing_answers: ['não sou objeto'] as unknown as InspectionRow['routing_answers'] }));
    expect('routingAnswers' in vindo).toBe(false);
  });

  test('servidor com valor emite as três chaves', () => {
    const vindo = mapFromPostgres(linha({
      applicability_context: { uf: 'SP' },
      routing_answers: { 'q-processa': false },
      routing_answers_meta: { 'q-processa': { at: '2026-08-27T11:00:00.000Z', by: 'Ana' } },
    }));
    expect(vindo.applicabilityContext).toEqual({ uf: 'SP' });
    expect(vindo.routingAnswers).toEqual({ 'q-processa': false });
    expect(vindo.routingAnswersMeta?.['q-processa'].by).toBe('Ana');
  });
});

describe('COND-08 · a reconciliação antes do merge de registro', () => {
  const cedo = { at: '2026-08-27T10:00:00.000Z', by: 'Ester' };
  const tarde = { at: '2026-08-27T11:00:00.000Z', by: 'Ana' };

  test('registro sem roteamento nenhum não é tocado', () => {
    expect(reconcileRoutingAnswers(inspecao(), inspecao())).toBeNull();
  });

  test('dois lados iguais não geram gravação nem fila de sync', () => {
    const igual = { routingAnswers: { q: true }, routingAnswersMeta: { q: cedo } };
    expect(reconcileRoutingAnswers(igual, igual)).toBeNull();
  });

  test('cada uma respondeu uma pergunta: o merge fica com as duas, e o local vai à fila', () => {
    const resultado = reconcileRoutingAnswers(
      { routingAnswers: { 'q-a': true }, routingAnswersMeta: { 'q-a': cedo } },
      { routingAnswers: { 'q-b': false }, routingAnswersMeta: { 'q-b': tarde } },
    );
    expect(resultado?.patch.routingAnswers).toEqual({ 'q-a': true, 'q-b': false });
    // O servidor ainda não conhece `q-a`: precisa ser empurrado.
    expect(resultado?.localAhead).toBe(true);
  });

  test('o servidor está na frente: aceita e não reenvia', () => {
    const resultado = reconcileRoutingAnswers(
      { routingAnswers: { q: true }, routingAnswersMeta: { q: cedo } },
      { routingAnswers: { q: false }, routingAnswersMeta: { q: tarde } },
    );
    expect(resultado?.patch.routingAnswers).toEqual({ q: false });
    expect(resultado?.localAhead).toBe(false);
  });

  test('o local está na frente: o remoto não sobrescreve', () => {
    const resultado = reconcileRoutingAnswers(
      { routingAnswers: { q: false }, routingAnswersMeta: { q: tarde } },
      { routingAnswers: { q: true }, routingAnswersMeta: { q: cedo } },
    );
    expect(resultado?.patch.routingAnswers).toEqual({ q: false });
    expect(resultado?.localAhead).toBe(true);
  });

  test('converge: reconciliar de novo depois de sincronizado não muda mais nada', () => {
    const primeira = reconcileRoutingAnswers(
      { routingAnswers: { 'q-a': true }, routingAnswersMeta: { 'q-a': cedo } },
      { routingAnswers: { 'q-b': false }, routingAnswersMeta: { 'q-b': tarde } },
    );
    const depoisDoPush = primeira!.patch;
    expect(reconcileRoutingAnswers(depoisDoPush, depoisDoPush)).toBeNull();
  });
});
