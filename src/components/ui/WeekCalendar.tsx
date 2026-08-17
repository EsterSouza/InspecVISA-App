import React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';

/**
 * Grade de semana (segunda a sexta), 09h-17h, um componente só para qualquer
 * agenda do produto (portal e admin) — muda o conteúdo do evento, nunca a
 * grade. Porta o protótipo aprovado em docs/prototipos/_src/shell.js
 * (renderCalendario).
 */

export type WeekCalendarEventState = 'confirmado' | 'a-confirmar' | 'atencao' | 'padrao';

export interface WeekCalendarEvent {
  id: string;
  dayIndex: number; // 0 = segunda ... 4 = sexta
  startHour: number; // hora cheia de início, 9-17 (a régua cresce se sair dessa faixa)
  durationHours: number;
  title: string;
  subtitle?: string;
  state?: WeekCalendarEventState;
  onClick?: () => void;
}

export interface WeekCalendarDay {
  label: string; // "Seg"
  dayNumber: string | number;
  isToday?: boolean;
}

export interface WeekCalendarWeek {
  periodLabel: string;
  days: WeekCalendarDay[]; // exatamente 5, segunda a sexta
  events: WeekCalendarEvent[];
}

export interface WeekCalendarProps {
  week: WeekCalendarWeek;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  hasPrevWeek?: boolean;
  hasNextWeek?: boolean;
  emptyMessage?: string;
  className?: string;
}

const DEFAULT_FIRST_HOUR = 9;
const DEFAULT_LAST_HOUR = 17;

const STATE_LABELS: Record<WeekCalendarEventState, string> = {
  confirmado: 'Confirmado',
  'a-confirmar': 'A confirmar',
  atencao: 'Precisa de atenção',
  padrao: 'Agendado',
};

const STATE_EVENT_CLASSES: Record<WeekCalendarEventState, string> = {
  confirmado: 'border-success-soft-border border-l-success bg-success-soft text-success-soft-ink',
  'a-confirmar': 'border-default border-l-control border-l-dashed bg-surface-sunken text-navy-2',
  atencao: 'border-amber-soft-border border-l-amber bg-amber-soft text-amber-soft-ink',
  padrao: 'border-primary-200 border-l-primary-700 bg-primary-50 text-primary-900',
};

const STATE_BADGE_VARIANT: Record<WeekCalendarEventState, 'success' | 'neutral' | 'warning' | 'default'> = {
  confirmado: 'success',
  'a-confirmar': 'neutral',
  atencao: 'warning',
  padrao: 'default',
};

const STATE_DOT_CLASSES: Record<WeekCalendarEventState, string> = {
  confirmado: 'border-success bg-success-soft',
  'a-confirmar': 'border-control bg-surface-sunken',
  atencao: 'border-amber bg-amber-soft',
  padrao: 'border-primary-700 bg-primary-50',
};

function formatHour(hour: number): string {
  return `${hour < 10 ? '0' : ''}${hour}h`;
}

function formatRange(event: WeekCalendarEvent): string {
  return `${formatHour(event.startHour)} às ${formatHour(event.startHour + event.durationHours)}`;
}

export function WeekCalendar({
  week,
  onPrevWeek,
  onNextWeek,
  hasPrevWeek = true,
  hasNextWeek = true,
  emptyMessage = 'Sem compromisso.',
  className,
}: WeekCalendarProps) {
  const eventsByDay = (dayIndex: number) =>
    week.events.filter((e) => e.dayIndex === dayIndex).sort((a, b) => a.startHour - b.startHour);

  // A régua padrão é 09h-17h (pedido da Ester em 16/08/2026: intervalo mais
  // estreito, sem sábado, pra sobrar mais espaço vertical por compromisso),
  // mas cresce (nunca corta) se algum compromisso começar antes ou terminar
  // depois disso.
  const firstHour = Math.min(DEFAULT_FIRST_HOUR, ...week.events.map((e) => e.startHour));
  const lastHour = Math.max(DEFAULT_LAST_HOUR, ...week.events.map((e) => e.startHour + e.durationHours));
  const HOURS = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-default bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default bg-surface-sunken px-4 py-3">
        <p className="font-title text-sm font-bold text-navy">{week.periodLabel}</p>
        {(onPrevWeek || onNextWeek) && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPrevWeek}
              disabled={!onPrevWeek || !hasPrevWeek}
              aria-label="Semana anterior"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-default text-navy-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              disabled={!onNextWeek || !hasNextWeek}
              aria-label="Próxima semana"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-default text-navy-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Grade seg-sex. Abaixo de 721px vira lista por dia (bloco seguinte) — a
          regra base do grid precisa continuar visível acima do breakpoint, por
          isso os dois blocos usam `hidden`/`min-[721px]:` em vez de display:none
          fixo, evitando o bug de ordem de especificidade do protótipo original. */}
      <div className="hidden overflow-x-auto min-[721px]:block">
        <div className="sticky top-0 z-10 grid min-w-[660px] grid-cols-[52px_repeat(5,minmax(0,1fr))] border-b border-default bg-surface">
          <div />
          {week.days.map((day) => (
            <div
              key={`${day.label}-${day.dayNumber}`}
              className={cn('border-l border-default px-2 py-2 text-center', day.isToday && 'bg-primary-50')}
            >
              <p className="text-[11px] font-semibold text-navy-3">{day.label}</p>
              <p className={cn('mt-0.5 font-title text-lg font-bold tabular-nums', day.isToday ? 'text-primary-800' : 'text-navy')}>
                {day.dayNumber}
              </p>
              {day.isToday && (
                <span className="mt-0.5 inline-block text-[9px] font-bold uppercase tracking-wide text-primary-700">
                  Hoje
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="grid min-w-[660px] grid-cols-[52px_repeat(5,minmax(0,1fr))]">
          <div aria-hidden="true" className="grid auto-rows-[64px]">
            {HOURS.map((hour, idx) => (
              <div
                key={hour}
                style={{ gridRow: idx + 1 }}
                className="pr-2 pt-0.5 text-right text-[11px] tabular-nums text-navy-3"
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>
          {week.days.map((day, dayIndex) => (
            <div
              key={`${day.label}-${day.dayNumber}`}
              role="group"
              aria-label={`${day.label}, dia ${day.dayNumber}`}
              className={cn('relative grid auto-rows-[64px] border-l border-default', day.isToday && 'bg-primary-50/40')}
            >
              {/* `gridRow` explícito aqui é essencial: sem ele, a auto-colocação
                  do CSS Grid empurra estas 9 linhas de fundo pra baixo dos
                  compromissos com posição explícita (ela pula linha ocupada
                  em vez de sobrepor), sobrando espaço fantasma depois do
                  último horário — achado da Ester em 16/08/2026, com print. */}
              {HOURS.map((hour, idx) => (
                <div key={hour} aria-hidden="true" style={{ gridRow: idx + 1 }} className="border-b border-default" />
              ))}
              {eventsByDay(dayIndex).map((event) => {
                const state = event.state || 'padrao';
                const startRow = event.startHour - firstHour + 1;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={event.onClick}
                    aria-label={`${event.title}, ${day.label} dia ${day.dayNumber}, ${formatRange(event)}, ${STATE_LABELS[state]}${event.subtitle ? `, ${event.subtitle}` : ''}`}
                    style={{ gridColumn: 1, gridRow: `${startRow} / span ${event.durationHours}` }}
                    className={cn(
                      'z-[1] m-0.5 overflow-hidden rounded-md border border-l-[3px] p-1.5 text-left text-[11px] leading-tight transition-shadow hover:shadow-md',
                      STATE_EVENT_CLASSES[state]
                    )}
                  >
                    <span className="block font-bold tabular-nums">{formatHour(event.startHour)}</span>
                    <p className="mt-0.5 truncate font-semibold">{event.title}</p>
                    {event.subtitle && <p className="truncate opacity-80">{event.subtitle}</p>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* No celular a semana vira lista por dia — continua sendo a semana, só
          empilhada; nunca substitui a grade acima do breakpoint. */}
      <div className="divide-y divide-default min-[721px]:hidden">
        {week.days.map((day, dayIndex) => {
          const dayEvents = eventsByDay(dayIndex);
          return (
            <div key={`${day.label}-${day.dayNumber}`}>
              <div className="flex items-baseline gap-2 bg-surface-sunken px-4 py-2">
                <h4 className="text-sm font-bold text-navy">{day.label} {day.dayNumber}</h4>
                {day.isToday && <Badge variant="default">Hoje</Badge>}
              </div>
              {dayEvents.length === 0 ? (
                <p className="px-4 py-3 text-sm text-navy-3">{emptyMessage}</p>
              ) : (
                dayEvents.map((event) => {
                  const state = event.state || 'padrao';
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={event.onClick}
                      className="flex w-full items-start gap-3 border-t border-default px-4 py-3 text-left hover:bg-surface-hover"
                    >
                      <span className="w-[72px] shrink-0 text-xs tabular-nums text-navy-3">{formatRange(event)}</span>
                      <span className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{event.title}</p>
                        {event.subtitle && <p className="truncate text-xs text-navy-3">{event.subtitle}</p>}
                      </span>
                      <Badge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABELS[state]}</Badge>
                    </button>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-default px-4 py-3 text-xs text-navy-2">
        {(['confirmado', 'a-confirmar', 'atencao'] as WeekCalendarEventState[]).map((state) => (
          <span key={state} className="inline-flex items-center gap-2">
            <span className={cn('h-3 w-3 rounded-sm border', STATE_DOT_CLASSES[state])} />
            {STATE_LABELS[state]}
          </span>
        ))}
      </div>
    </div>
  );
}
