export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'operação falhou.';
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Classe padrão de input — placeholder com contraste AA (text-navy-3).
export const TEXT_INPUT = 'w-full rounded-xl border border-control p-3 text-sm placeholder:text-navy-3';
