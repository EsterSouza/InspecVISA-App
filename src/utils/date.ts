// Data no fuso de quem usa o app, para quando "o dia" é um dia do calendário
// (data da visita, "hoje", chave de agenda) e não um instante no tempo.
//
// Nunca usar `toISOString().split('T')[0]` para isso: em UTC-3 tudo que
// acontece depois das 21h cai no dia seguinte. Foi assim que a data da visita
// nasceu com o dia errado (commit 45f4adc).
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
