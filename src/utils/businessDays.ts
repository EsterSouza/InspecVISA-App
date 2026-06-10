/**
 * Soma `days` dias úteis (ignora sábados e domingos) a partir de startDate.
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0 = domingo, 6 = sábado
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Retorna string de prazo formatada para exibir ao cliente.
 * Prioridade: data manual > cálculo automático > mensagem genérica.
 */
export function formatReportDueDate(
  reportDueAt: string | null,
  reportDueSource: string | null,
  inspectionCompletedAt?: Date | null
): string {
  if (reportDueAt && reportDueSource === 'manual') {
    const d = new Date(reportDueAt);
    return `Relatório previsto para ${d.toLocaleDateString('pt-BR')}`;
  }
  if (inspectionCompletedAt) {
    const due = addBusinessDays(inspectionCompletedAt, 5);
    return `Relatório previsto para ${due.toLocaleDateString('pt-BR')}`;
  }
  return 'Relatório previsto em até 5 dias úteis após a finalização da inspeção';
}
