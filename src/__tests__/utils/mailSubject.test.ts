import { describe, expect, it } from 'vitest';
import { safeMailSubject } from '../../../supabase/functions/_shared/mailSubject';

describe('safeMailSubject', () => {
  it('gera um assunto ASCII curto para nomes longos com acentos e pontuacao Unicode', () => {
    const subject = safeMailSubject(
      'Compromisso confirmado — Eliana Guilhen – Estética e Terapias Integrativas ✨ com um nome muito longo'
    );

    expect(subject).toMatch(/^[\x20-\x7e]+$/);
    expect(subject).toContain('Estetica');
    expect(subject.length).toBeLessThanOrEqual(68);
  });

  it('remove quebras de linha para impedir injecao de cabecalho', () => {
    expect(safeMailSubject('Confirmado\r\nBcc: invasor@example.com')).toBe(
      'Confirmado Bcc: invasor@example.com'
    );
  });

  it('usa um fallback previsivel para entrada vazia', () => {
    expect(safeMailSubject('  ')).toBe('Notificacao InspecVISA');
  });
});
