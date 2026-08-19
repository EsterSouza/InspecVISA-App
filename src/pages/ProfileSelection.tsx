import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { User, LogOut } from 'lucide-react';
import { SettingsService } from '../services/settingsService';

export function ProfileSelection() {
  const { replaceProfileSettings, setConsultant } = useSettingsStore();
  const { signOut } = useAuthStore();

  const handleSelect = (consultant: 'ana' | 'ester') => {
    setConsultant(consultant);
    if (navigator.onLine) {
      void SettingsService.load(consultant)
        .then((remoteSettings) => {
          if (remoteSettings?.name && useSettingsStore.getState().currentProfile === consultant) {
            replaceProfileSettings(consultant, remoteSettings);
          }
        })
        .catch((err) => console.warn('[ProfileSelection] Falha ao carregar perfil remoto:', err));
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="bg-surface rounded-2xl shadow-xl border border-default p-8 max-w-sm w-full mx-auto">
        <div className="text-center mb-8">
          <div className="bg-primary-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-surface shadow-sm">
             <User className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Quem está usando?</h1>
          <p className="text-navy-3 text-sm mt-2">Escolha seu perfil para iniciar as inspeções.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleSelect('ester')}
            className="w-full relative overflow-hidden group p-6 bg-surface border-2 border-primary-100 hover:border-primary-500 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left flex items-center justify-between"
          >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-navy group-hover:text-primary-700 transition-colors">Ester</h3>
              <p className="text-sm text-navy-3 font-medium">Enfermeira</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
               <span className="text-primary-600 font-bold text-lg">E</span>
            </div>
          </button>

          <button
            onClick={() => handleSelect('ana')}
             className="w-full relative overflow-hidden group p-6 bg-surface border-2 border-secondary-100 hover:border-secondary-500 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left flex items-center justify-between"
          >
             <div className="relative z-10">
              <h3 className="text-xl font-bold text-navy group-hover:text-secondary-700 transition-colors">Ana</h3>
              <p className="text-sm text-navy-3 font-medium">Nutricionista</p>
            </div>
             <div className="w-10 h-10 rounded-full bg-secondary-50 flex items-center justify-center group-hover:bg-secondary-100 transition-colors">
               <span className="text-secondary-600 font-bold text-lg">A</span>
            </div>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-default flex flex-col items-center gap-4">
          <p className="text-center text-[11px] text-navy-3">
            Você poderá alterar essa opção depois em Ajustes.
          </p>
          
          <button
            onClick={() => signOut()}
            className="flex items-center text-danger hover:text-danger-soft-ink text-xs font-bold transition-colors"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
