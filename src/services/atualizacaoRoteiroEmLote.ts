import { db } from '../db/database';
import { composeCanonicalTemplate, getTemplateById } from '../data/templates';
import {
  aplicarAtualizacao,
  compararRoteiro,
  contextoDaInspecao,
  temAtualizacao,
} from '../utils/atualizacaoDoRoteiro';
import type { ChecklistTemplate, Inspection } from '../types';

// ============================================================
// A mesma atualização da tela de execução, mas para TODAS as inspeções em
// andamento de uma vez.
//
// Uma por uma não serve: o roteiro muda para valer poucas vezes por mês, e
// quando muda vale para toda vistoria em aberto — abrir cada uma para clicar num
// botão é a parte que ninguém faz. Aqui a consultora vê quantas estão
// desatualizadas e resolve as duas coisas com um clique.
//
// Tudo local: a revisão congelada vive no Dexie e não trafega enquanto a
// inspeção está em andamento (só entra no `reportSnapshot` da entrega). Por isso
// a gravação é `db.inspections.update`, que não mexe em `syncStatus` nem em
// `updatedAt` — atualizar roteiro não é alteração de dado de vistoria e não
// deve disparar sincronização.
// ============================================================

export type InspecaoDesatualizada = {
  inspecao: Inspection;
  cliente: string;
  itensNovos: number;
  textosNovos: number;
  secoesNovas: string[];
};

async function roteiroDaInspecao(inspection: Inspection): Promise<ChecklistTemplate | null> {
  if (!inspection.templateId) return null;
  const local = await db.templates.get(inspection.templateId).catch(() => undefined);
  return local ?? getTemplateById(inspection.templateId) ?? null;
}

export async function levantarInspecoesDesatualizadas(): Promise<InspecaoDesatualizada[]> {
  const emAndamento = await db.inspections
    .where('status').equals('in_progress')
    .toArray()
    .catch(() => [] as Inspection[]);

  const desatualizadas: InspecaoDesatualizada[] = [];

  for (const inspecao of emAndamento) {
    if (inspecao.deletedAt) continue;
    // Sem revisão congelada não há o que atualizar: a inspeção ainda vai compor
    // do roteiro vivo na primeira abertura, e já nasce em dia.
    const congelado = inspecao.reportTemplateSnapshot;
    if (!congelado) continue;

    const base = await roteiroDaInspecao(inspecao);
    if (!base) continue;

    let vivo: ChecklistTemplate;
    try {
      vivo = composeCanonicalTemplate(base, contextoDaInspecao(inspecao), inspecao.createdAt);
    } catch {
      continue;
    }

    const diff = compararRoteiro(congelado, vivo);
    if (!temAtualizacao(diff)) continue;

    desatualizadas.push({
      inspecao,
      cliente: inspecao.clientName || 'Cliente',
      itensNovos: diff.itensNovos.length,
      textosNovos: diff.itensComTextoNovo.length,
      secoesNovas: diff.secoesNovas,
    });
  }

  return desatualizadas;
}

/** Aplica a atualização e devolve quantas inspeções foram efetivamente gravadas. */
export async function atualizarRoteiros(alvos: InspecaoDesatualizada[]): Promise<number> {
  let gravadas = 0;

  for (const alvo of alvos) {
    const congelado = alvo.inspecao.reportTemplateSnapshot;
    if (!congelado) continue;

    const base = await roteiroDaInspecao(alvo.inspecao);
    if (!base) continue;

    let vivo: ChecklistTemplate;
    try {
      vivo = composeCanonicalTemplate(base, contextoDaInspecao(alvo.inspecao), alvo.inspecao.createdAt);
    } catch {
      continue;
    }

    const respostas = await db.responses
      .where('inspectionId').equals(alvo.inspecao.id)
      .toArray()
      .catch(() => []);
    const idsComResposta = new Set(
      respostas.filter(resposta => !resposta.deletedAt).map(resposta => resposta.itemId)
    );

    await db.inspections.update(alvo.inspecao.id, {
      reportTemplateSnapshot: aplicarAtualizacao(congelado, vivo, idsComResposta),
    });
    gravadas += 1;
  }

  return gravadas;
}
