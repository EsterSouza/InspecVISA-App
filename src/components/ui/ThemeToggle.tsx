import { Moon, Sun } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

/**
 * FE-12 — o controle de tema para quem não tem a tela de Configurações.
 *
 * A consultora troca o tema em Configurações → Aparência. O cliente não tem essa
 * tela: se o portal abrir escuro e ele quiser claro, não havia por onde. Este botão
 * é a saída, e fica no cabeçalho do portal.
 *
 * Escreve no mesmo `settings.theme` da consultora, de propósito: é um só
 * `localStorage` por dispositivo, então a Ester trocando no portal também troca no
 * admin — "claro e escuro são um só sistema" vale para o controle também.
 *
 * O rótulo é a **ação**, não o estado ("Tema claro" quando está escuro), e vem
 * escrito ao lado do ícone: nenhuma informação depende só da forma do desenho.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
      aria-pressed={isDark}
      title={isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      className={`inline-flex items-center gap-1.5 rounded-md border border-default bg-surface px-3 py-2 text-xs font-medium text-navy-2 hover:bg-surface-hover [@media(pointer:coarse)]:min-h-11 ${className}`}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
      {isDark ? 'Tema claro' : 'Tema escuro'}
    </button>
  );
}
