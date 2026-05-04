// ============================================================
// PATCH PARA templates.ts — Suplemento BH
// Aplique estas duas alterações no arquivo templates.ts existente.
// ============================================================


// ── 1. ADICIONAR IMPORT (junto aos demais imports de suplementos) ─────────
//
// ANTES (linha ~8):
//   import { templateIlpiGoiasSuplement } from './templates-ilpi-goias-supplement';
//
// DEPOIS:
//   import { templateIlpiGoiasSuplement } from './templates-ilpi-goias-supplement';
//   import { templateIlpiBeloHorizonteSupplement } from './Roteiro_ILPI_BH';


// ── 2. ADICIONAR BLOCO BH EM getEffectiveTemplate ─────────────────────────
//
// Localizar o bloco do suplemento GO (começa em: if (baseTemplate.id === 'tpl-ilpi-federal-v1' && client.state === 'GO'))
// Logo APÓS o fechamento desse bloco ( effective.name = `...` + chave de fechamento }), inserir:

/*

  // ── Suplemento BH (Belo Horizonte - MG) ──────────────────────────────────
  if (
    baseTemplate.id === 'tpl-ilpi-federal-v1' &&
    client.state === 'MG' &&
    client.city?.toLowerCase().includes('belo horizonte')
  ) {
    const supplement = templateIlpiBeloHorizonteSupplement;

    // A. Adicionar itens às seções federais existentes
    supplement.sectionAdditions.forEach(addition => {
      const targetSection = effective.sections.find((s: any) => s.id === addition.targetSectionId);
      if (targetSection) {
        const existingIds = new Set(targetSection.items.map((i: any) => i.id));
        addition.items.forEach(newItem => {
          if (!existingIds.has(newItem.id)) {
            targetSection.items.push(newItem);
          }
        });
        targetSection.items.sort((a: any, b: any) => a.order - b.order);
      }
    });

    // B. Adicionar seções novas sem equivalente federal
    if (supplement.newSections) {
      supplement.newSections.forEach(newSec => {
        if (!effective.sections.find((s: any) => s.id === newSec.id)) {
          effective.sections.push(newSec);
        }
      });
    }

    effective.name = `${baseTemplate.name} (+ Suplemento BH)`;
  }

*/


// ── 3. OPCIONAL — alias em getTemplateById ────────────────────────────────
//
// Se quiser usar 'tpl-ilpi-bh' como ID de acesso direto ao template efetivo,
// adicionar dentro de getTemplateById, junto aos demais aliases:
//
//   if (id === 'tpl-ilpi-bh') mappedId = 'tpl-ilpi-federal-v1';
//
// Nota: o ID retornado será sempre o da base federal; o suplemento BH é
// aplicado em runtime por getEffectiveTemplate com base em client.state/city.


// ── 4. NOTA SOBRE O CAMPO client.city ────────────────────────────────────
//
// O bloco BH depende de client.city existir no tipo Client.
// Se o campo não existir, adicionar ao tipo Client em types.ts:
//
//   city?: string;
//
// E garantir que o formulário de cadastro de clientes persista esse campo.
