import type jsPDF from 'jspdf';

/**
 * Em que altura a última tabela terminou — é daí que o conteúdo seguinte parte.
 *
 * O `jspdf-autotable` grava isso no próprio documento depois de desenhar, mas o pacote
 * não estende os tipos do jsPDF (só exporta a função `autoTable`), então quem lê precisa
 * declarar o campo. Só faz sentido logo após um `autoTable(doc, …)`.
 */
type ComAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export function fimDaUltimaTabela(doc: jsPDF): number {
  return (doc as ComAutoTable).lastAutoTable.finalY;
}
