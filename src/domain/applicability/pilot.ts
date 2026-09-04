// ============================================================
// src/domain/applicability/pilot.ts
// COND-10 — a chave que liga o motor, e a que desliga.
//
// O motor de condicionais está pronto desde o COND-09, mas **ligado ele muda o
// que a consultora vê em campo e o que entra no relatório do cliente**. Ligar
// para todos os roteiros de uma vez seria descobrir os problemas em produção,
// num relatório entregue. O piloto é um roteiro só, com as árvores escritas e
// justificadas uma a uma.
//
// ─── Por que a flag mora em código, e não numa tabela ───────────────────────
//
//   1. **A execução decide offline** (contrato § 6.5). Se a flag estivesse no
//      banco, a consultora sem sinal não saberia se o motor está ligado — e
//      "não sei" teria de virar "mostra tudo", o que faz a flag oscilar entre
//      um aparelho e outro no meio da visita.
//   2. **Rollback tem de ser auditável.** Esvaziar esta lista é um commit, com
//      autor, data e motivo. Um `update` numa linha de configuração não deixa
//      rastro nenhum.
//   3. **É um tenant só.** Flag por tenant não compra nada aqui; o que protege
//      é o gate de publicação (COND-07) e o alcance estreito do piloto.
//
// ─── ROLLBACK ───────────────────────────────────────────────────────────────
//
// Para desligar o motor, **esvazie `APPLICABILITY_PILOT`** (ou remova a linha do
// roteiro) e publique. A partir do próximo carregamento:
//
//   · todo requisito volta a ser aplicável, em toda tela;
//   · nota, resumo, PDF, referências e plano de ação voltam ao roteiro inteiro;
//   · **nenhuma resposta é apagada** — nem a de requisito que estava fora por
//     regra, que volta a aparecer com o que já tinha sido respondido;
//   · a revisão publicada continua no banco, intacta, pronta para religar.
//
// Não é preciso migration, `update` em produção, nem reprocessar inspeção. Uma
// inspeção em andamento, aberta depois do rollback, simplesmente mostra o
// roteiro inteiro. Relatório já concluído não muda, porque lê o snapshot dele.
// ============================================================

import type { ConditionalTemplate } from './schema';

export interface PilotEntry {
  /**
   * Ids do roteiro autorizado. **São dois**, e é preciso que sejam: o catálogo
   * empacotado usa id legível (`tpl-estetica-clinica-v1`) e o banco usa UUID
   * (`checklist_templates.id`, convertido para `text` em 04/2026). A inspeção
   * congela o roteiro que veio do **banco**, então uma flag que só conhecesse o
   * id do catálogo nunca ligaria em produção — o mesmo descasamento que já
   * mordeu o `replacesItemId` dos suplementos.
   */
  templateIds: string[];
  /**
   * Nomes autorizados, comparados sem acento, sem caixa e sem espaço sobrando.
   *
   * Existe porque id de catálogo e id de banco não são a mesma coisa, e porque
   * um roteiro pode entrar no banco DEPOIS desta lista ser escrita — foi o caso
   * do roteiro de Serviços de Saúde, que na véspera da primeira vistoria ainda
   * só existia empacotado. O nome é o que o seletor de NewInspection já usa para
   * decidir se o roteiro do catálogo aparece ou não, então é a chave que
   * atravessa os dois mundos. Roteiro arquivado carrega o prefixo `[ARQUIVADO]`
   * no nome e por isso nunca casa aqui, que é o comportamento desejado.
   */
  templateNames?: string[];
  /**
   * Revisão publicada autorizada. Ausente = qualquer revisão publicada daquele
   * roteiro. Preencher quando quiser prender o piloto a uma revisão específica
   * e impedir que a próxima publicação entre em campo sozinha.
   */
  revision?: number;
  /** Por que este roteiro entrou no piloto. O card exige justificativa escrita. */
  justificativa: string;
}

/**
 * Os roteiros que rodam com o motor ligado. **Lista vazia = motor desligado no
 * produto inteiro**, que é exatamente o comportamento de antes do projeto.
 *
 * Estética é o piloto por três motivos: é o roteiro com mais volume de visitas,
 * é o único com suplementos regionais em produção (RJ, SP capital, Petrópolis) —
 * então exercita a composição junto com a condicional — e já carrega
 * condicionais **escritas dentro do texto do item** ("Quando processa produtos
 * para saúde…"), que são exatamente as que o motor existe para substituir.
 */
export const APPLICABILITY_PILOT: readonly PilotEntry[] = [
  {
    templateIds: [
      'tpl-estetica-clinica-v1',                // catálogo empacotado (src/data)
      '0c55f120-81e9-45d7-8ef5-04437d22a9a3',   // "Roteiro de Inspeção — Clínica de Estética e Saúde" em produção
    ],
    templateNames: ['Roteiro de Inspeção — Clínica de Estética e Saúde'],
    justificativa:
      'Roteiro com maior volume de visitas, três suplementos regionais em produção e quatro '
      + 'condicionais já escritas no texto dos itens. As árvores do piloto estão em '
      + 'src/data/estetica/condicionais-piloto.ts, uma justificativa sanitária por árvore.',
  },
  {
    // O id de produção sai em branco de propósito: o roteiro entrou no banco
    // depois desta lista, e o nome já basta para o gate. Preencher o UUID aqui
    // é opcional, e só ajuda quem for ler o histórico.
    templateIds: ['tpl-saude-servicos-v1'],
    templateNames: ['Roteiro de Inspeção — Serviços de Saúde (Base Federal)'],
    justificativa:
      'Roteiro de serviço de saúde propriamente dito, estreado na vistoria PRÉ-OPERACIONAL de '
      + '04/09/2026 (consultório de ginecologia em obra, Itaipava/Petrópolis). É o caso que mais '
      + 'precisa do motor: numa unidade que ainda não abriu, dezenas de requisitos são registro, '
      + 'comprovante ou observação de prática assistencial que não existem — e hoje viram "não se '
      + 'aplica" marcado à mão, um a um, sem rastro e sem sair do denominador. As árvores estão em '
      + 'src/data/saude/condicionais-piloto-saude.ts.',
  },
];

/** Sem acento, sem caixa, sem espaço duplicado — a mesma régua dos dois lados. */
function normalizarNome(valor?: string | null): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** A entrada do piloto para um roteiro, se ele estiver no piloto — por id OU por nome. */
export function pilotEntryFor(templateId?: string | null, templateName?: string | null): PilotEntry | undefined {
  const nome = normalizarNome(templateName);
  return APPLICABILITY_PILOT.find((entry) => {
    if (templateId && entry.templateIds.includes(templateId)) return true;
    if (!nome) return false;
    return (entry.templateNames || []).some((autorizado) => normalizarNome(autorizado) === nome);
  });
}

/**
 * A entrada autoriza esta revisão? Separado de `applicabilityEnabled` para poder
 * ser testado sem depender do conteúdo da lista do piloto.
 */
export function entryAllowsRevision(entry: PilotEntry, revision?: number | null): boolean {
  if (entry.revision === undefined) return true;
  // Revisão desconhecida (inspeção antiga, snapshot sem número) não é motivo
  // para esconder requisito: o lado seguro é o motor desligado.
  return revision !== null && revision !== undefined && revision === entry.revision;
}

/**
 * O motor roda para este roteiro?
 *
 * `revision` é a revisão que a inspeção congelou. Quando a entrada do piloto
 * prende uma revisão e a inspeção congelou outra, o motor fica **desligado para
 * aquela inspeção** — é o que impede uma publicação nova de entrar em campo sem
 * passar pelo piloto de novo.
 */
export function applicabilityEnabled(
  templateId?: string | null,
  revision?: number | null,
  templateName?: string | null
): boolean {
  const entry = pilotEntryFor(templateId, templateName);
  return entry ? entryAllowsRevision(entry, revision) : false;
}

/**
 * O roteiro como o motor deve enxergá-lo.
 *
 * Fora do piloto, as regras somem da entrada do motor — mesmo que já estejam
 * congeladas no snapshot que veio do Dexie. É esta função que faz o rollback
 * alcançar inspeção **já congelada**, sem tocar em nada gravado: a regra
 * continua no banco e no snapshot, apenas deixa de ser consultada.
 */
export function gateByPilot<
  T extends ConditionalTemplate & { id?: string; name?: string; applicabilityRevision?: number | null }
>(template: T): T {
  if (applicabilityEnabled(template.id, template.applicabilityRevision, template.name)) return template;
  if (!template.rules?.length && !template.routingQuestions?.length) return template;
  return { ...template, rules: [], routingQuestions: [] };
}
