import React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';
import { CalendarLegend } from './CalendarLegend';
import {
  MILESTONE_DOT_CLASSES,
  MILESTONE_LABEL,
  STATE_BADGE_VARIANT,
  STATE_EVENT_CLASSES,
  STATE_LABELS,
  type CalendarEventState,
} from './calendarEventState';

/**
 * Grade de semana (segunda a sexta), 09h-17h, um componente só para qualquer
 * agenda do produto (portal e admin) — muda o conteúdo do evento, nunca a
 * grade. Porta o protótipo aprovado em docs/prototipos/_src/shell.js
 * (renderCalendario).
 */

export type WeekCalendarEventState = CalendarEventState;

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

/**
 * Evento de dia inteiro (AGD-02: marco e entrega de pasta sanitária) — sem hora, então não
 * entra na grade horária. Aparece numa faixa de chips própria, entre o cabeçalho de dias e a
 * grade — cor fixa (rosa), fora do vocabulário de estado do compromisso.
 */
export interface WeekCalendarAllDayItem {
  id: string;
  dayIndex: number; // 0 = segunda ... 4 = sexta
  title: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface WeekCalendarProps {
  week: WeekCalendarWeek;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  hasPrevWeek?: boolean;
  hasNextWeek?: boolean;
  /**
   * Clicar num horário vago abre o agendamento já com aquele dia e hora.
   * Sem a prop, a grade continua só de leitura (é o caso do portal).
   */
  onSelectSlot?: (dayIndex: number, hour: number) => void;
  /** Sem a prop (o caso do portal), a faixa de dia inteiro não existe. */
  allDayItems?: WeekCalendarAllDayItem[];
  emptyMessage?: string;
  className?: string;
}

const DEFAULT_FIRST_HOUR = 9;
const DEFAULT_LAST_HOUR = 17;

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
  onSelectSlot,
  allDayItems,
  emptyMessage = 'Sem compromisso.',
  className,
}: WeekCalendarProps) {
  const eventsByDay = (dayIndex: number) =>
    week.events.filter((e) => e.dayIndex === dayIndex).sort((a, b) => a.startHour - b.startHour);
  const allDayByDay = (dayIndex: number) => allDayItems?.filter((item) => item.dayIndex === dayIndex) ?? [];
  const hasAllDayItems = (allDayItems?.length ?? 0) > 0;

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
              className="flex h-9 w-9 items-center justify-center rounded-md border border-default text-navy-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              disabled={!onNextWeek || !hasNextWeek}
              aria-label="Próxima semana"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-default text-navy-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
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
              className={cn('border-l border-default px-2 py-2 text-center', day.isToday && 'bg-canvas ring-2 ring-inset ring-control')}
            >
              <p className="text-[11px] font-semibold text-navy-3">{day.label}</p>
              <p className="mt-0.5 font-title text-lg font-bold tabular-nums text-navy">
                {day.dayNumber}
              </p>
              {day.isToday && (
                <span className="mt-0.5 inline-block rounded bg-surface px-1 text-[9px] font-bold uppercase tracking-wide text-navy-2">
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
              className={cn('relative grid auto-rows-[64px] border-l border-default', day.isToday && 'bg-canvas/70')}
            >
              {/* `gridRow` explícito aqui é essencial: sem ele, a auto-colocação
                  do CSS Grid empurra estas 9 linhas de fundo pra baixo dos
                  compromissos com posição explícita (ela pula linha ocupada
                  em vez de sobrepor), sobrando espaço fantasma depois do
                  último horário — achado da Ester em 16/08/2026, com print. */}
              {HOURS.map((hour, idx) =>
                onSelectSlot ? (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => onSelectSlot(dayIndex, hour)}
                    aria-label={`Agendar ${day.label} dia ${day.dayNumber} às ${formatHour(hour)}`}
                    style={{ gridRow: idx + 1 }}
                    className="group border-b border-default text-left hover:bg-surface-hover"
                  >
                    <span className="pointer-events-none block px-1.5 pt-1 text-[11px] font-semibold text-navy-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      + Agendar
                    </span>
                  </button>
                ) : (
                  <div key={hour} aria-hidden="true" style={{ gridRow: idx + 1 }} className="border-b border-default" />
                )
              )}
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
              {/* Marco/entrega (AGD-02): sem hora, então não ganha linha própria — só um sinal
                  no primeiro horário do dia (pedido da Ester, 29/08/2026), sem cobrir o botão
                  "+ Agendar" nem o compromisso que porventura já ocupe essa hora. */}
              {allDayByDay(dayIndex).length > 0 && (
                <div
                  style={{ gridColumn: 1, gridRow: 1 }}
                  className="pointer-events-none relative z-[2] flex flex-wrap justify-end gap-1 p-1"
                >
                  {allDayByDay(dayIndex).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      title={item.title}
                      disabled={!item.onClick}
                      className="pointer-events-auto flex max-w-[90%] items-center gap-1 truncate rounded-full border border-pink-soft-border bg-pink-soft px-1.5 py-0.5 text-[10px] font-semibold text-pink-soft-ink shadow-sm hover:shadow disabled:cursor-default"
                    >
                      {item.icon && <span aria-hidden="true">{item.icon}</span>}
                      <span className="truncate">{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* No celular a semana vira lista por dia — continua sendo a semana, só
          empilhada; nunca substitui a grade acima do breakpoint. */}
      <div className="divide-y divide-default min-[721px]:hidden">
        {week.days.map((day, dayIndex) => {
          const dayEvents = eventsByDay(dayIndex);
          const dayAllDay = allDayByDay(dayIndex);
          return (
            <div key={`${day.label}-${day.dayNumber}`}>
              <div className="flex items-baseline gap-2 bg-surface-sunken px-4 py-2">
                <h4 className="text-sm font-bold text-navy">{day.label} {day.dayNumber}</h4>
                {day.isToday && <Badge variant="default">Hoje</Badge>}
              </div>
              {dayAllDay.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-default px-4 py-2">
                  {dayAllDay.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="flex items-center gap-1.5 rounded-md border border-pink-soft-border bg-pink-soft px-2 py-1 text-xs font-semibold text-pink-soft-ink"
                    >
                      {item.icon && <span aria-hidden="true">{item.icon}</span>}
                      {item.title}
                    </button>
                  ))}
                </div>
              )}
              {dayEvents.length === 0 ? (
                dayAllDay.length === 0 && <p className="px-4 py-3 text-sm text-navy-3">{emptyMessage}</p>
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
              {onSelectSlot && (
                <button
                  type="button"
                  onClick={() => onSelectSlot(dayIndex, DEFAULT_FIRST_HOUR)}
                  className="min-h-11 w-full border-t border-default px-4 py-2 text-left text-sm font-semibold text-navy-2 hover:bg-surface-hover"
                >
                  + Agendar em {day.label} {day.dayNumber}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <CalendarLegend
        extraItems={hasAllDayItems ? [{ key: 'milestone', label: MILESTONE_LABEL, dotClassName: MILESTONE_DOT_CLASSES }] : undefined}
      />
    </div>
  );
}
