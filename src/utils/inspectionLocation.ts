import { db } from '../db/database';
import type { Inspection } from '../types';

/**
 * Completa a inspeção com os dados do cliente que o servidor não devolve.
 *
 * `inspections` não tem coluna `city`/`state`/`category` — quem cria a inspeção grava esses
 * campos só no Dexie local. Uma inspeção que veio do servidor (outro aparelho, cache limpo)
 * chega sem eles, e aí `getEffectiveTemplate` não aplica o suplemento regional: o relatório
 * do RJ perde os itens do suplemento, que caem na seção "Itens preservados do roteiro
 * concluído". Como o cliente está no Dexie, dá para completar sem rede.
 */
export async function withClientLocation<T extends Inspection>(inspection: T): Promise<T> {
  if (inspection.state && inspection.city && inspection.clientCategory) return inspection;

  const client = await db.clients.get(inspection.clientId).catch(() => undefined);
  if (!client) return inspection;

  return {
    ...inspection,
    clientName: inspection.clientName ?? client.name,
    clientCategory: inspection.clientCategory ?? client.category,
    foodTypes: inspection.foodTypes ?? client.foodTypes,
    city: inspection.city ?? client.city,
    state: inspection.state ?? client.state,
  };
}
