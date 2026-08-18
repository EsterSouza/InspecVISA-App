import React from 'react';
import { useInspectionStore } from '../../store/useInspectionStore';
import { getTemplates, getEffectiveTemplate } from '../../data/templates';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { Client } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';
import { Users2, Utensils, Activity } from 'lucide-react';

export function CollaborativeProgress() {
  const { currentInspection, responses } = useInspectionStore();
  const { settings } = useSettingsStore();

  if (!currentInspection) return null;

  const baseTemplate = getTemplates().find(t => t.id === currentInspection.templateId);
  if (!baseTemplate) return null;

  // Get full template (without role filtering)
  const fullTemplate = getEffectiveTemplate(
    baseTemplate,
    // `getEffectiveTemplate` pede um cliente, mas so le `state`, `city` e `foodTypes` — que a
    // inspecao carrega em cache. Passar a inspecao aqui e antigo e proposital; fica dito.
    currentInspection as unknown as Client,
    'ambos',
    true // full=true
  );

  const nutritionSectionIds = ['sec-fed-05', 'sec-fed-06'];
  
  // Health Items Calculation
  const healthItems = fullTemplate.sections
    .filter(s => !nutritionSectionIds.includes(s.id))
    .flatMap(s => s.items);
  const healthDone = healthItems.filter(item => 
    responses.some(r => r.itemId === item.id && r.result !== undefined)
  ).length;
  const healthProgress = healthItems.length > 0 ? (healthDone / healthItems.length) * 100 : 0;

  // Nutrition Items Calculation
  const nutritionItems = fullTemplate.sections
    .filter(s => nutritionSectionIds.includes(s.id))
    .flatMap(s => s.items);
  const nutritionDone = nutritionItems.filter(item => 
    responses.some(r => r.itemId === item.id && r.result !== undefined)
  ).length;
  const nutritionProgress = nutritionItems.length > 0 ? (nutritionDone / nutritionItems.length) * 100 : 0;

  const myRole = settings.consultantRole || 'saude';

  return (
    <div className="bg-surface border-b border-default px-4 py-3 shadow-sm sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Health Progress */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider">
              <div className="flex items-center text-accent-ink">
                <Activity className="mr-1 h-3 w-3" />
                Saúde e Assistência {myRole === 'saude' && '(Você)'}
              </div>
              <span className={healthProgress === 100 ? 'text-success' : 'text-navy-3'}>
                {healthDone}/{healthItems.length} ({Math.round(healthProgress)}%)
              </span>
            </div>
            <ProgressBar value={healthProgress} colorClass={healthProgress === 100 ? 'bg-success' : 'bg-primary-500'} heightClass="h-1.5" />
          </div>

          <div className="hidden sm:block w-px h-8 bg-surface-sunken" />

          {/* Nutrition Progress */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider">
              <div className="flex items-center text-amber-strong">
                <Utensils className="mr-1 h-3 w-3" />
                Nutrição {myRole === 'nutricao' && '(Você)'}
              </div>
              <span className={nutritionProgress === 100 ? 'text-success' : 'text-navy-3'}>
                {nutritionDone}/{nutritionItems.length} ({Math.round(nutritionProgress)}%)
              </span>
            </div>
            <ProgressBar value={nutritionProgress} colorClass={nutritionProgress === 100 ? 'bg-success' : 'bg-amber'} heightClass="h-1.5" />
          </div>

          <div className="flex items-center gap-2 bg-surface-sunken px-3 py-1.5 rounded-full border border-default">
            <Users2 className="h-3 w-3 text-navy-3" />
            <span className="text-[10px] font-bold text-navy-2 uppercase">Equipe Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
