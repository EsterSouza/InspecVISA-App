import React from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { User, ShieldCheck, Check } from 'lucide-react';
import { Button } from '../ui/Button';

interface ProfileModalProps {
  onClose?: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { settings, setConsultant } = useSettingsStore();

  const handleSelect = (consultant: 'ana' | 'ester') => {
    setConsultant(consultant);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        <div className="bg-primary-600 p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-md">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Selecione seu Perfil</h2>
          <p className="text-primary-100 text-sm mt-1">Identifique-se para continuar o trabalho.</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Option: Ana */}
          <button
            onClick={() => handleSelect('ana')}
            className={`w-full group relative flex items-center p-4 rounded-xl border-2 transition-all ${
              settings.name === 'Ana Roberta Ribeiro'
                ? 'border-primary-500 bg-primary-50'
                : 'border-slate-100 bg-slate-50 hover:border-primary-200 hover:bg-white'
            }`}
          >
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center mr-4 text-primary-600 font-bold group-hover:scale-110 transition-transform">
              AR
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Ana Roberta Ribeiro</p>
              <p className="text-xs text-slate-500 font-medium">Nutrição (Responsável Técnica)</p>
            </div>
            {settings.name === 'Ana Roberta Ribeiro' && (
              <div className="ml-auto bg-primary-500 rounded-full p-1">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>

          {/* Option: Ester */}
          <button
            onClick={() => handleSelect('ester')}
            className={`w-full group relative flex items-center p-4 rounded-xl border-2 transition-all ${
              settings.name === 'Ester Caiafa'
                ? 'border-primary-500 bg-primary-50'
                : 'border-slate-100 bg-slate-50 hover:border-primary-200 hover:bg-white'
            }`}
          >
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-4 text-blue-600 font-bold group-hover:scale-110 transition-transform">
              EC
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Ester Caiafa</p>
              <p className="text-xs text-slate-500 font-medium">Saúde e Assistência Social</p>
            </div>
            {settings.name === 'Ester Caiafa' && (
              <div className="ml-auto bg-primary-500 rounded-full p-1">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center">
               <User className="h-3 w-3 mr-1" /> Profile Selection Required
            </p>
        </div>
      </div>
    </div>
  );
}
