import React, { useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

function getSpeechRecognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Mensagens amigáveis para os códigos de erro da Web Speech API — sem isso o
// botão falhava em silêncio (sem pedir permissão nem avisar nada), deixando a
// consultora sem saber se apertou errado ou se o navegador bloqueou o microfone.
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Habilite o microfone para este site nas configurações do navegador (ícone de cadeado na barra de endereço) e tente de novo.',
  'service-not-allowed': 'Permissão de microfone negada. Habilite o microfone para este site nas configurações do navegador e tente de novo.',
  'audio-capture': 'Nenhum microfone foi encontrado neste dispositivo.',
  'network': 'Erro de rede no reconhecimento de voz (o navegador precisa de internet pra transcrever). Verifique sua conexão e tente de novo.',
  'no-speech': 'Nenhuma fala foi detectada. Tente falar mais perto do microfone.',
  'aborted': 'Ditado interrompido.',
};

type Status = 'idle' | 'listening' | 'speech-detected';

const STATUS_LABEL: Record<Status, string> = {
  idle: '',
  listening: 'Ouvindo...',
  'speech-detected': 'Reconhecendo...',
};

/**
 * Botão de ditado por voz para os campos de texto do checklist. Usa a Web
 * Speech API do próprio navegador — sem suporte (ex. Safari/iOS mais restrito)
 * o componente simplesmente não renderiza nada. Só emite o transcript final;
 * quem concatena no campo é o componente pai.
 *
 * Usa continuous=false + reinício automático em vez de continuous=true: o modo
 * contínuo tem bugs conhecidos no Chrome desktop onde a captura fica "ouvindo"
 * sem nunca disparar onresult. Reiniciar a cada frase é o padrão mais estável
 * entre navegadores/plataformas.
 */
export function VoiceDictationButton({ onTranscript, className }: VoiceDictationButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  if (!SpeechRecognitionCtor) return null;

  const stop = () => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus('idle');
    setInterimText('');
  };

  const startRecognitionInstance = () => {
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onspeechstart = () => setStatus('speech-detected');
    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setInterimText(interim);
      if (finalText.trim()) onTranscript(finalText.trim());
    };
    recognition.onerror = (event: any) => {
      // 'no-speech' é esperado ao reiniciar em silêncio — não interrompe o ciclo.
      if (event.error === 'no-speech' && shouldListenRef.current) return;
      console.error('[VoiceDictation] erro no reconhecimento de voz:', event.error);
      shouldListenRef.current = false;
      setErrorMessage(ERROR_MESSAGES[event.error] || `Não foi possível usar o microfone (${event.error}).`);
      setStatus('idle');
      setInterimText('');
    };
    recognition.onend = () => {
      setInterimText('');
      if (shouldListenRef.current) {
        // Reinicia pra próxima frase (padrão mais estável que continuous=true).
        startRecognitionInstance();
      } else {
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus('listening');
    } catch (err) {
      console.error('[VoiceDictation] falha ao iniciar reconhecimento de voz:', err);
      shouldListenRef.current = false;
      setErrorMessage('Não foi possível iniciar o ditado. Tente novamente.');
      setStatus('idle');
    }
  };

  const start = () => {
    setErrorMessage(null);
    setInterimText('');
    shouldListenRef.current = true;
    startRecognitionInstance();
  };

  const isListening = status !== 'idle';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => (isListening ? stop() : start())}
        title={isListening ? 'Parar ditado' : 'Ditar por voz (português)'}
        aria-label={isListening ? 'Parar o ditado' : 'Ditar por voz'}
        className={cn(
          // No dedo o alvo vai a 44px (decisão 7); no ponteiro fino continua discreto.
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11',
          isListening
            ? 'animate-pulse border-danger bg-danger-soft text-danger'
            : 'border-default bg-surface text-navy-3 hover:bg-surface-hover hover:text-primary-600',
          className
        )}
      >
        {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </button>
      {isListening && (
        <span className="ml-2 max-w-[180px] truncate text-[11px] italic text-navy-3">
          {interimText ? `"${interimText}"` : STATUS_LABEL[status]}
        </span>
      )}
      {errorMessage && (
        <div className="absolute right-0 top-9 z-10 w-64 rounded-md border border-danger-soft-border bg-danger-soft p-2 text-[11px] leading-snug text-danger-soft-ink shadow-lg">
          {errorMessage}
          <button type="button" onClick={() => setErrorMessage(null)} className="ml-1 font-bold underline">
            Ok
          </button>
        </div>
      )}
    </div>
  );
}
