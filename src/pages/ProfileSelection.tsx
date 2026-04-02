import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { User } from 'lucide-react';

export function ProfileSelection() {
  const { setConsultant } = useSettingsStore();

  const handleSelect = (consultant: 'ana' | 'ester') => {
    setConsultant(consultant);
    // React re-renderiza App.tsx automaticamente porque settings.name muda
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-sm w-full mx-auto">
        <div className="text-center mb-8">
          <div className="bg-primary-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
             <User className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quem está usando?</h1>
          <p className="text-gray-500 text-sm mt-2">Escolha seu perfil para iniciar as inspeções.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleSelect('ester')}
            className="w-full relative overflow-hidden group p-6 bg-white border-2 border-primary-100 hover:border-primary-500 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left flex items-center justify-between"
          >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary-700 transition-colors">Ester</h3>
              <p className="text-sm text-gray-500 font-medium">Nutricionista</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
               <span className="text-primary-600 font-bold text-lg">E</span>
            </div>
          </button>

          <button
            onClick={() => handleSelect('ana')}
             className="w-full relative overflow-hidden group p-6 bg-white border-2 border-purple-100 hover:border-purple-500 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left flex items-center justify-between"
          >
             <div className="relative z-10">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors">Ana</h3>
              <p className="text-sm text-gray-500 font-medium">Assistente Social</p>
            </div>
             <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
               <span className="text-purple-600 font-bold text-lg">A</span>
            </div>
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-8">
          Você poderá alterar essa opção depois em Ajustes.
        </p>
      </div>
    </div>
  );
}
