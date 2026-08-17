import type { ClientPortalUnit } from '../services/clientPortalService';

export function parseDateParts(value: string): Date {
  const [y, m, d] = value.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDateBR(value: string | null | undefined): string {
  if (!value) return 'A confirmar';
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function formatCompetenceMonth(value: string): string {
  const [y, m] = value.split('T')[0].split('-');
  if (!y || !m) return value;
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function paymentLinks(payment: { link: string | null; links?: { label?: string; url: string }[] }) {
  const links = payment.links?.filter((item) => item.url?.trim()) || [];
  if (links.length > 0) return links;
  return payment.link ? [{ label: 'Pagar agora', url: payment.link }] : [];
}

export function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-700 bg-green-100';
  if (score >= 60) return 'text-amber-soft-ink bg-amber-soft';
  return 'text-danger-soft-ink bg-danger-soft';
}

/** Unidade selecionada no filtro do portal. `null` significa "Todas". */
export function filterUnitsBySelection<T extends { client_id: string }>(
  units: T[],
  selectedUnitId: string | null
): T[] {
  if (!selectedUnitId) return units;
  return units.filter((unit) => unit.client_id === selectedUnitId);
}

export interface UnitActionStats {
  clientId: string;
  unitName: string;
  open: number;
  resolved: number;
  total: number;
  overdue: number;
  /** % de pendências já concluídas nesta unidade; `null` sem nenhuma pendência histórica. */
  pctDone: number | null;
}

/**
 * "Cumprimento por unidade" (protótipo FE-03): % de itens do plano de ação já resolvidos,
 * por unidade — não a nota de inspeção. Precisa da lista SEM filtro de unidade (published +
 * resolved) pra comparar todas de uma vez.
 */
export function computeUnitActionStats(
  items: { client_id: string; unit_name: string; status: 'published' | 'resolved'; is_overdue: boolean }[]
): UnitActionStats[] {
  const byUnit = new Map<string, UnitActionStats>();
  for (const item of items) {
    let stats = byUnit.get(item.client_id);
    if (!stats) {
      stats = { clientId: item.client_id, unitName: item.unit_name, open: 0, resolved: 0, total: 0, overdue: 0, pctDone: null };
      byUnit.set(item.client_id, stats);
    }
    stats.total += 1;
    if (item.status === 'resolved') {
      stats.resolved += 1;
    } else {
      stats.open += 1;
      if (item.is_overdue) stats.overdue += 1;
    }
  }
  for (const stats of byUnit.values()) {
    stats.pctDone = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : null;
  }
  return Array.from(byUnit.values());
}

/**
 * Pior primeiro — quem tem menos % concluído precisa de atenção primeiro. Sem dado vai ao fim.
 * Empate no % (comum logo no início do contrato, quando ninguém corrigiu nada ainda) desempata
 * por quem tem mais vencidas, depois por nome.
 */
/**
 * Link público (sem login) da unidade — PORT-02. Reusa o token da visita mais recente que
 * tiver um: a RPC do link filtra o plano de ação pelo `client_id` da visita, não pelo
 * relatório específico, então qualquer token da unidade abre o plano de ação atual dela.
 * `null` só quando a unidade nunca teve nenhuma visita.
 */
export function latestUnitVisitToken(unit: Pick<ClientPortalUnit, 'visits'>): string | null {
  const sorted = [...unit.visits].sort((a, b) =>
    `${b.requested_date || ''}${b.requested_time || ''}`.localeCompare(`${a.requested_date || ''}${a.requested_time || ''}`)
  );
  return sorted[0]?.public_token || null;
}

export function unitShareUrl(unit: Pick<ClientPortalUnit, 'visits'>): string | null {
  const token = latestUnitVisitToken(unit);
  return token ? `${window.location.origin}/cliente/visita/${token}` : null;
}

export function sortUnitStatsByAttention(stats: UnitActionStats[]): UnitActionStats[] {
  return [...stats].sort((a, b) => {
    if (a.pctDone == null && b.pctDone == null) return a.unitName.localeCompare(b.unitName);
    if (a.pctDone == null) return 1;
    if (b.pctDone == null) return -1;
    if (a.pctDone !== b.pctDone) return a.pctDone - b.pctDone;
    if (a.overdue !== b.overdue) return b.overdue - a.overdue;
    return a.unitName.localeCompare(b.unitName);
  });
}
