import type { ChecklistItem, InspectionResponse } from '../types';
import { toDateKey } from './clientPortalFormat';

/**
 * P360-010 — projeção do plano de ação para o portal do cliente.
 *
 * O cliente nunca lê `responses`: o que ele vê é esta cópia enxuta, construída a partir das
 * mesmas NCs que alimentam o plano de ação do PDF. `source_item_id` viaja para o banco só
 * como chave de deduplicação e recorrência — a RPC de leitura não o devolve ao cliente.
 */
export interface ClientActionItemPayload {
  source_item_id: string;
  title: string;
  situation: string;
  recommended_action: string;
  priority: 'urgent' | 'important' | 'recommended';
  responsible?: string;
  due_date?: string;
}

/**
 * Decisão 33 do FE-23: **prazo é só a lista**, e "sem prazo" é escolha com nome,
 * não ausência silenciosa. `Sem prazo definido` produz o mesmo `null` de
 * `deadlineToDays` que "assim que possível" produzia — a diferença é que agora
 * é deliberado, e ganha selo próprio no relatório e no portal.
 */
export const NO_DEADLINE = 'Sem prazo definido';

export const DEADLINE_OPTIONS = [
  'Imediato',
  '24 horas',
  '7 dias',
  '15 dias',
  '30 dias',
  '45 dias',
  '60 dias',
  '90 dias',
  NO_DEADLINE,
] as const;

/** O responsável é o **setor**, nunca a consultora. */
export const RESPONSIBLE_OPTIONS = [
  'Responsável Técnico (RT)',
  'Gerência / Administração',
  'Equipe de Manutenção',
  'Equipe de Limpeza / Higiene',
  'Manipulador / Funcionário',
  'Proprietário',
  'Empresa Terceirizada',
] as const;

/**
 * O prazo é texto livre com sugestões (`Imediato`, `24 horas`, `30 dias`...). Converte para
 * dias corridos a partir da visita; devolve null quando a consultora escreveu algo que não dá
 * para datar, e aí o item vai ao portal sem prazo em vez de ganhar um prazo inventado.
 */
export function deadlineToDays(deadline: string | undefined): number | null {
  const text = (deadline || '').trim().toLowerCase();
  if (!text) return null;
  // Bug #3: frases claramente imediatas viram prazo 0 em vez de virar item que nunca vence.
  // As genuinamente indatáveis ("assim que possível", "o quanto antes") seguem null de
  // propósito — não se inventa data num laudo; a visibilidade delas é papel do Painel/plano.
  if (['imediato', 'imediata', 'imediatamente', 'urgente'].includes(text)) return 0;

  const match = text.match(/^(\d+)\s*(hora|horas|dia|dias|semana|semanas|m[êe]s|meses)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith('hora')) return Math.ceil(amount / 24);
  if (unit.startsWith('semana')) return amount * 7;
  if (unit.startsWith('m')) return amount * 30;
  return amount;
}

function dueDateFor(deadline: string | undefined, baseDate: Date): string | undefined {
  const days = deadlineToDays(deadline);
  if (days === null) return undefined;
  const due = new Date(baseDate.getTime());
  due.setDate(due.getDate() + days);
  return toDateKey(due);
}

/**
 * Mesma classificação do plano de ação do PDF: crítico é urgente, peso >= 5 é importante, o
 * resto é recomendação. `requirement_type` não entra — ver a nota do REF-04 no handoff.
 */
function priorityFor(item: ChecklistItem | undefined): ClientActionItemPayload['priority'] {
  if (item?.isCritical) return 'urgent';
  if ((item?.weight || 0) >= 5) return 'important';
  return 'recommended';
}

export function buildClientActionItems(
  nonCompliantResponses: InspectionResponse[],
  items: ChecklistItem[],
  inspectionDate: Date
): ClientActionItemPayload[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const baseDate = Number.isNaN(inspectionDate?.getTime?.()) ? new Date() : inspectionDate;

  return nonCompliantResponses
    .filter((response) => !!response.itemId)
    .map((response) => {
      const item = itemById.get(response.itemId);
      return {
        source_item_id: response.itemId,
        title: item?.description || response.customDescription || 'Requisito avaliado',
        situation: response.situationDescription?.trim() || 'Achado registrado durante a visita técnica.',
        recommended_action:
          response.correctiveAction?.trim() || 'Definir medida corretiva e registrar evidência de conclusão.',
        priority: priorityFor(item),
        responsible: response.responsible?.trim() || undefined,
        due_date: dueDateFor(response.deadline, baseDate),
      };
    });
}
