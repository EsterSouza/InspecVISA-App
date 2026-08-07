/**
 * P360-011 — regras do arquivo de evidência, do lado do cliente.
 *
 * Isto é conveniência, não segurança: quem decide de verdade é a Edge Function, que confere os
 * bytes do arquivo, e o Postgres, que confere MIME e tamanho antes de registrar. O papel daqui
 * é dizer "esse arquivo não serve" **antes** de o cliente esperar o upload de 10 MB terminar.
 */

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

/** PDF, JPG, PNG e WEBP — o mesmo conjunto aceito pelo bucket, pela RPC e pela Edge Function. */
export const EVIDENCE_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** Para o atributo `accept` do input: alguns sistemas mandam `File.type` vazio. */
export const EVIDENCE_ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const EVIDENCE_LIMITS_LABEL = 'PDF, JPG, PNG ou WEBP, até 10 MB';

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export interface EvidenceFileCheck {
  ok: boolean;
  message?: string;
}

export function checkEvidenceFile(file: Pick<File, 'name' | 'size' | 'type'>): EvidenceFileCheck {
  if (file.size <= 0) {
    return { ok: false, message: 'O arquivo está vazio. Escolha outro e tente de novo.' };
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return {
      ok: false,
      message: `O arquivo tem ${formatFileSize(file.size)} e o limite é 10 MB. Reduza o tamanho ou envie em partes.`,
    };
  }

  // Quando existe extensão, é ela que manda — inclusive para RECUSAR. Um `.exe` renomeado
  // que se declara `application/pdf` não pode passar só porque o navegador repetiu a mentira.
  // Sem extensão nenhuma (scanner, Android antigo), sobra o tipo declarado.
  const extension = extensionOf(file.name);
  const resolved = extension ? EXTENSION_MIME[extension] : (file.type || '').toLowerCase();

  if (!resolved || !(EVIDENCE_ACCEPTED_MIME_TYPES as readonly string[]).includes(resolved)) {
    return { ok: false, message: `Formato não aceito. Envie ${EVIDENCE_LIMITS_LABEL}.` };
  }

  return { ok: true };
}
