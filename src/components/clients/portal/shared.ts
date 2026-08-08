export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'operação falhou.';
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Classe padrão de input — placeholder com contraste AA (text-gray-500).
export const TEXT_INPUT = 'w-full rounded-xl border border-gray-300 p-3 text-sm placeholder:text-gray-500';
