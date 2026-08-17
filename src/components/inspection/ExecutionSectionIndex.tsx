import React from 'react';
import { Card } from '../ui/Card';

export interface SectionIndexEntry {
  id: string;
  label: string;
  total: number;
  answered: number;
}

/**
 * Índice de seções como coluna própria (decisão 23). O acordeão sozinho só
 * marca posição rolando; pular da cozinha para os resíduos passava por 40 itens.
 */
export function ExecutionSectionIndex({ sections, activeId, onSelect }: {
  sections: SectionIndexEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <div className="border-b border-default px-4 py-3">
        <h2 className="text-sm font-semibold text-navy">Seções</h2>
      </div>
      <nav aria-label="Seções do roteiro">
        {sections.map((section) => {
          const pct = section.total > 0 ? Math.round((section.answered / section.total) * 100) : 0;
          const done = section.total > 0 && section.answered === section.total;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={activeId === section.id ? 'true' : undefined}
              onClick={() => onSelect(section.id)}
              className={`flex w-full items-start gap-2 border-b border-default px-4 py-3 text-left last:border-b-0 hover:bg-surface-hover aria-[current]:bg-primary-50`}
              style={{ minHeight: 44 }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-navy">{section.label}</span>
                <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className={`block h-full rounded-full ${done ? 'bg-success' : 'bg-primary-700'}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-navy-3">
                {section.answered}/{section.total}
              </span>
            </button>
          );
        })}
      </nav>
    </Card>
  );
}
