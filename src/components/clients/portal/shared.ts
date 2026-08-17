// DEBT-02: era uma copia mais fraca (so `instanceof Error`), que engolia a mensagem dos
// erros do PostgREST. Passa a usar a mesma implementacao do resto do app.
export { errorMessage } from '../../../utils/errors';

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
