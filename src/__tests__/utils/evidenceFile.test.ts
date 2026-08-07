import { describe, expect, test } from 'vitest';
import {
  EVIDENCE_MAX_BYTES,
  checkEvidenceFile,
  formatFileSize,
} from '../../utils/evidenceFile';

function file(name: string, size: number, type = ''): Pick<File, 'name' | 'size' | 'type'> {
  return { name, size, type };
}

describe('P360-011 - checagem do arquivo de evidência no cliente', () => {
  test('aceita os quatro formatos documentados', () => {
    expect(checkEvidenceFile(file('laudo.pdf', 1024, 'application/pdf')).ok).toBe(true);
    expect(checkEvidenceFile(file('foto.jpg', 1024, 'image/jpeg')).ok).toBe(true);
    expect(checkEvidenceFile(file('foto.jpeg', 1024, 'image/jpeg')).ok).toBe(true);
    expect(checkEvidenceFile(file('print.png', 1024, 'image/png')).ok).toBe(true);
    expect(checkEvidenceFile(file('print.webp', 1024, 'image/webp')).ok).toBe(true);
  });

  test('recusa formato fora da lista', () => {
    const result = checkEvidenceFile(file('macro.docx', 1024, 'application/msword'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Formato não aceito/);
  });

  test('arquivo vazio não sobe', () => {
    expect(checkEvidenceFile(file('vazio.pdf', 0, 'application/pdf')).message).toMatch(/está vazio/);
  });

  test('o limite é 10 MB e o valor exato passa', () => {
    expect(checkEvidenceFile(file('grande.pdf', EVIDENCE_MAX_BYTES, 'application/pdf')).ok).toBe(true);
    const over = checkEvidenceFile(file('grande.pdf', EVIDENCE_MAX_BYTES + 1, 'application/pdf'));
    expect(over.ok).toBe(false);
    expect(over.message).toMatch(/limite é 10 MB/);
  });

  test('celular que não informa o tipo cai na extensão', () => {
    expect(checkEvidenceFile(file('IMG_0042.JPG', 2048)).ok).toBe(true);
    expect(checkEvidenceFile(file('scan', 2048)).ok).toBe(false);
  });

  test('extensão renomeada não passa por cima da lista', () => {
    // `.exe` renomeado com tipo mentido: a extensão manda, e ela não está na lista.
    expect(checkEvidenceFile(file('virus.exe', 2048, 'application/pdf')).ok).toBe(false);
  });

  test('tamanho aparece em português no aviso', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(12 * 1024 * 1024)).toBe('12,0 MB');
  });
});
