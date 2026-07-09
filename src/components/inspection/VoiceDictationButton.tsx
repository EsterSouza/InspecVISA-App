import React, { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

function getSpeechRecognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/**
 * Botão de ditado por voz para os campos de texto do checklist. Usa a Web
 * Speech API do próprio navegador — sem suporte (ex. Safari/iOS mais restrito)
 * o componente simplesmente não renderiza nada. Só emite o transcript final;
 * quem concatena no campo é o componente pai.
 */
export function VoiceDictationButton({ onTranscript, className }: VoiceDictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  if (!SpeechRecognitionCtor) return null;

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const start = () => {
    // Instância nova a cada start: reaproveitar a mesma entre start/stop gera
    // InvalidStateError em alguns navegadores.
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText.trim()) onTranscript(finalText.trim());
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => (isListening ? stop() : start())}
      title={isListening ? 'Parar ditado' : 'Ditar por voz'}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
        isListening
          ? 'animate-pulse border-red-400 bg-red-50 text-red-600'
          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-primary-600',
        className
      )}
    >
      <Mic className="h-3.5 w-3.5" />
    </button>
  );
}
