/** Formata o public_token (UUID) como protocolo curto XXXX-XXXX-XXXX para exibição. */
export function formatProtocol(token: string): string {
  const clean = token.replace(/-/g, '').toUpperCase();
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}
