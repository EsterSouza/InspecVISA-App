import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import type { SectionIndexEntry } from './ExecutionSectionIndex';

interface MobileExecutionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  isSaving: boolean;
  answered: number;
  total: number;
  sections: SectionIndexEntry[];
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  allCollapsed: boolean;
  onToggleCollapseAll: () => void;
  onPreviewReport: () => void;
  onTeamResponses: () => void;
  onAddExtraItem: () => void;
  onSaveAndExit: () => void;
  hideClientInfo: boolean;
  onToggleHideClient: () => void;
  isCompleted: boolean;
  onFinish: () => void;
  onReopen: () => void;
}

/**
 * O menu ⋮ da execução no celular (opção 3a do handoff).
 *
 * Não há barra inferior nem FAB: tudo o que o cabeçalho de desktop carrega em
 * três colunas mora aqui — estado do salvamento, salto de seção, as ações da
 * visita e o "Encerrar e entregar". O cabeçalho compacto fica com 85px.
 */
export function MobileExecutionSheet({
  isOpen,
  onClose,
  isOnline,
  isSaving,
  answered,
  total,
  sections,
  activeSectionId,
  onSelectSection,
  allCollapsed,
  onToggleCollapseAll,
  onPreviewReport,
  onTeamResponses,
  onAddExtraItem,
  onSaveAndExit,
  hideClientInfo,
  onToggleHideClient,
  isCompleted,
  onFinish,
  onReopen,
}: MobileExecutionSheetProps) {
  /** Toda ação da folha fecha a folha: quem escolheu já sabe o que vai acontecer. */
  const run = (action: () => void) => () => { onClose(); action(); };

  const rowClass = 'flex w-full min-h-[52px] items-center gap-2.5 border-t border-default bg-transparent text-left text-[14.5px] font-semibold leading-tight text-navy';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Ações da inspeção">
      {/* Estado em três canais: cor, ícone e a palavra escrita. */}
      <div className="flex items-center gap-2 px-0.5 pb-2.5 text-xs font-semibold text-navy-2">
        {!isOnline ? (
          <>
            <CloudOff className="h-3.5 w-3.5 shrink-0 text-amber-strong" aria-hidden="true" />
            <span>Sem conexão · salvo no aparelho · {answered}/{total}</span>
          </>
        ) : isSaving ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-secondary-700" aria-hidden="true" />
            <span>Salvando na nuvem · {answered}/{total}</span>
          </>
        ) : (
          <>
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-success" aria-hidden="true" />
            <span>Salvo no aparelho e na nuvem · {answered}/{total}</span>
          </>
        )}
      </div>

      <button type="button" onClick={run(onToggleCollapseAll)} className={rowClass}>
        {allCollapsed ? 'Abrir todas as seções' : 'Recolher todas as seções'}
      </button>

      <div className="border-t border-default pb-1 pt-2.5 font-title text-[11px] font-bold text-navy-3">
        Ir para a seção
      </div>
      {/* Com 11 seções a lista sozinha enchia a folha e empurrava as ações
          para fora da vista. Ela rola por dentro; o resto fica alcançável. */}
      <nav aria-label="Seções do roteiro" className="max-h-[34vh] overflow-y-auto overscroll-contain">
        {sections.map((section) => {
          const pct = section.total > 0 ? Math.round((section.answered / section.total) * 100) : 0;
          const done = section.total > 0 && section.answered === section.total;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={activeSectionId === section.id ? 'true' : undefined}
              onClick={run(() => onSelectSection(section.id))}
              className="flex min-h-12 w-full items-center gap-2.5 rounded-lg bg-transparent px-1 py-1 text-left aria-[current]:bg-primary-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-tight text-navy">{section.label}</span>
                <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className={`block h-full rounded-full ${done ? 'bg-success' : 'bg-primary-700'}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </span>
              <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-navy-3">
                {section.answered}/{section.total}
              </span>
            </button>
          );
        })}
      </nav>

      <button type="button" onClick={run(onPreviewReport)} className={`${rowClass} mt-2`}>
        Pré-visualizar o relatório
      </button>
      {!isCompleted && (
        <button type="button" onClick={run(onTeamResponses)} className={rowClass}>
          Ver o que a equipe preencheu
        </button>
      )}
      <button type="button" onClick={run(onToggleHideClient)} className={rowClass}>
        {hideClientInfo ? 'Mostrar dados do cliente' : 'Ocultar dados do cliente'}
      </button>
      {!isCompleted && (
        <button type="button" onClick={run(onAddExtraItem)} className={rowClass}>
          Acrescentar um item que o roteiro não prevê
        </button>
      )}
      <button type="button" onClick={run(onSaveAndExit)} className={rowClass}>
        Salvar e sair
      </button>

      {/* A ação que fecha a visita não some no fim da rolagem da folha. */}
      <div className="sticky bottom-0 -mx-3 bg-surface px-3 pb-1 pt-3">
        {isCompleted ? (
          <button
            type="button"
            onClick={run(onReopen)}
            className="h-[52px] w-full rounded-[10px] border border-amber-soft-border bg-amber-soft text-[15px] font-bold text-amber-soft-ink"
          >
            Reabrir inspeção
          </button>
        ) : (
          <button
            type="button"
            onClick={run(onFinish)}
            className="h-[52px] w-full rounded-[10px] bg-primary-700 text-[15px] font-bold text-on-accent"
          >
            Encerrar e entregar
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
