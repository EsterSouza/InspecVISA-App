import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'inspecvisa-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

/**
 * Banner discreto e dispensável para instalar o app (PWA).
 * - Android/Chrome/Edge: usa o evento beforeinstallprompt (botão "Instalar").
 * - iPhone/iPad: mostra instruções (Compartilhar → Adicionar à Tela de Início).
 */
export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch { /* ignore */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS não dispara beforeinstallprompt — mostramos as instruções.
    if (isIOS()) setVisible(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch { /* ignore */ }
  };

  const handleInstall = async () => {
    if (!deferred) {
      setIosHelp(true);
      return;
    }
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch { /* ignore */ }
    setDeferred(null);
    dismiss();
  };

  if (!visible) return null;

  const iosMode = !deferred && isIOS();

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="relative rounded-xl border border-primary-100 bg-white p-4 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-gray-400 hover:bg-gray-100"
          aria-label="Fechar aviso de instalação"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-5">
          <img src="/pwa-192x192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Instalar o InspecVISA</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Acesse mais rápido pela tela inicial, como um aplicativo.
            </p>

            {iosMode || iosHelp ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                Toque em <Share className="inline h-3.5 w-3.5" /> <span className="font-semibold">Compartilhar</span> e depois em
                <span className="font-semibold"> "Adicionar à Tela de Início"</span>.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800"
              >
                <Download className="h-3.5 w-3.5" /> Instalar app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
