const DEFAULT_SUBJECT = 'Notificacao InspecVISA';
const MAX_SUBJECT_LENGTH = 68;

/**
 * Mantem o Subject em ASCII curto. O Denomailer 1.6.0 quebra encoded-words
 * longos com Unicode e alguns provedores passam a exibir o MIME bruto.
 */
export function safeMailSubject(value: unknown): string {
  const normalized = String(value ?? '')
    // Caractere de controle e o alvo da limpeza, nao um engano: quebra de linha no
    // Subject e injecao de cabecalho SMTP.
    // eslint-disable-next-line no-control-regex
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[—–]/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (normalized || DEFAULT_SUBJECT).slice(0, MAX_SUBJECT_LENGTH).trimEnd();
}
