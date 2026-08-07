export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  if (score >= 60) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

/** Unidade selecionada no filtro do portal. `null` significa "Todas". */
export function filterUnitsBySelection<T extends { client_id: string }>(
  units: T[],
  selectedUnitId: string | null
): T[] {
  if (!selectedUnitId) return units;
  return units.filter((unit) => unit.client_id === selectedUnitId);
}
