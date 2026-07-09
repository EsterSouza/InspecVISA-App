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
  'network': 'Erro de rede no reconhecimento de voz. Verifique sua conexão e tente de novo.',
  'no-speech': 'Nenhuma fala foi detectada. Tente falar mais perto do microfone.',
};

/**
 * Botão de ditado por voz para os campos de texto do checklist. Usa a Web
 * Speech API do próprio navegador — sem suporte (ex. Safari/iOS mais restrito)
 * o componente simplesmente não renderiza nada. Só emite o transcript final;
 * quem concatena no campo é o componente pai.
 */
export function VoiceDictationButton({ onTranscript, className }: VoiceDictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  if (!SpeechRecognitionCtor) return null;

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
  };

  const start = () => {
    setErrorMessage(null);
    setInterimText('');

    // Instância nova a cada start: reaproveitar a mesma entre start/stop gera
    // InvalidStateError em alguns navegadores.
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      // Prova visual de que o microfone está captando fala, mesmo antes da
      // frase "fechar" — sem isso parecia que nada estava acontecendo.
      setInterimText(interim);
      if (finalText.trim()) {
        onTranscript(finalText.trim());
        setInterimText('');
      }
    };
    recognition.onerror = (event: any) => {
      console.error('[VoiceDictation] erro no reconhecimento de voz:', event.error);
      setErrorMessage(ERROR_MESSAGES[event.error] || `Não foi possível usar o microfone (${event.error}).`);
      setIsListening(false);
      setInterimText('');
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('[VoiceDictation] falha ao iniciar reconhecimento de voz:', err);
      setErrorMessage('Não foi possível iniciar o ditado. Tente novamente.');
      setIsListening(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => (isListening ? stop() : start())}
        title={isListening ? 'Parar ditado' : 'Ditar por voz (português)'}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
          isListening
            ? 'animate-pulse border-red-400 bg-red-50 text-red-600'
            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-primary-600',
          className
        )}
      >
        {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </button>
      {isListening && (
        <span className="ml-2 max-w-[180px] truncate text-[11px] italic text-gray-400">
          {interimText ? `"${interimText}"` : 'Ouvindo...'}
        </span>
      )}
      {errorMessage && (
        <div className="absolute right-0 top-9 z-10 w-64 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] leading-snug text-red-700 shadow-lg">
          {errorMessage}
          <button type="button" onClick={() => setErrorMessage(null)} className="ml-1 font-bold underline">
            Ok
          </button>
        </div>
      )}
    </div>
  );
}
