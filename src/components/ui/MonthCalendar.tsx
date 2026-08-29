import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';
import { CalendarLegend } from './CalendarLegend';
import {
  MILESTONE_BADGE_CLASSES,
  MILESTONE_DOT_CLASSES,
  MILESTONE_EVENT_CLASSES,
  MILESTONE_LABEL,
  STATE_BADGE_VARIANT,
  STATE_DOT_CLASSES,
  STATE_EVENT_CLASSES,
  STATE_LABELS,
  type CalendarEventState,
} from './calendarEventState';
import { toDateKey } from '../../utils/date';
import { buildMonthGrid, firstOfMonth, formatDayLong, formatMonthLabel, isSameMonth } from '../../utils/monthCalendarDates';

/**
 * Grade de mês (segunda a sexta, sem fim de semana) — a visão de longe da mesma agenda que o
 * `WeekCalendar` mostra de perto: mesmas cores, mesmas palavras de estado e a
 * mesma legenda. Clicar num dia vago agenda naquele dia (`onSelectDay`).
 *
 * Abaixo de 721px a grade fica compacta (número + marcadores) e o dia tocado
 * abre a lista de compromissos embaixo — no celular a célula com texto vira
 * ilegível bem antes de caber.
 */

export interface MonthCalendarEvent {
  id: string;
  date: Date;
  time?: string; // "09:00"
  title: string;
  subtitle?: string;
  state?: CalendarEventState;
  /**
   * `'milestone'` (AGD-02) é evento de dia inteiro fora do vocabulário de estado do
   * compromisso — cor fixa (rosa), sem hora, sem confirmação. Padrão `'appointment'`.
   */
  kind?: 'appointment' | 'milestone';
  /** Ícone pequeno antes do título — hoje só usado por `kind: 'milestone'`. */
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface MonthCalendarProps {
  month: Date; // qualquer dia do mês exibido
  events: MonthCalendarEvent[];
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
  /** Sem esta prop o mês fica só de leitura. */
  onSelectDay?: (date: Date) => void;
  emptyMessage?: string;
  className?: string;
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const VISIBLE_EVENTS_PER_DAY = 3;

export function MonthCalendar({
  month,
  events,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDay,
  emptyMessage = 'Sem compromisso.',
  className,
}: MonthCalendarProps) {
  const days = buildMonthGrid(month);
  const todayKey = toDateKey(new Date());
  // Célula que a pessoa mandou mostrar por inteiro (o "+N" do desktop).
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Dia aberto no celular. Derivado, não sincronizado por efeito: trocar de mês
  // sozinho já devolve a escolha ao padrão (hoje, ou o dia 1) sem deixar o
  // painel de baixo falando de um dia que não está mais na grade.
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const selectedKey =
    pickedKey && days.some((day) => toDateKey(day) === pickedKey)
      ? pickedKey
      : isSameMonth(month, new Date())
        ? todayKey
        : toDateKey(firstOfMonth(month));

  const eventsOfDay = (day: Date) =>
    events
      .filter((event) => toDateKey(event.date) === toDateKey(day))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

  const selectedDay = days.find((day) => toDateKey(day) === selectedKey) ?? firstOfMonth(month);
  const selectedEvents = eventsOfDay(selectedDay);
  const hasMilestones = events.some((event) => event.kind === 'milestone');

  // A grade não tem sábado nem domingo. Compromisso que caia num deles não
  // pode sumir em silêncio: sai numa linha abaixo da grade, clicável como os
  // outros. Sem nenhum, a linha não existe.
  const weekendEvents = events
    .filter((event) => isSameMonth(event.date, month) && !days.some((day) => toDateKey(day) === toDateKey(event.date)))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-default bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default bg-surface-sunken px-4 py-3">
        <p className="font-title text-sm font-bold first-letter:uppercase text-navy">{formatMonthLabel(month)}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={!onPrevMonth}
            aria-label="Mês anterior"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-default text-navy-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
          >
            ‹
          </button>
          {onToday && (
            <button
              type="button"
              onClick={onToday}
              className="flex h-9 items-center justify-center rounded-md border border-default px-3 text-sm font-semibold text-navy-2 hover:bg-surface [@media(pointer:coarse)]:min-h-11"
            >
              Hoje
            </button>
          )}
          <button
            type="button"
            onClick={onNextMonth}
            disabled={!onNextMonth}
            aria-label="Próximo mês"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-default text-navy-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
          >
            ›
          </button>
        </div>
      </div>

      {/* Grade com o conteúdo do dia — só acima de 721px. */}
      <div className="hidden min-[721px]:block">
        <div className="grid grid-cols-5 border-b border-default bg-surface">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="border-l border-default px-2 py-2 text-center text-[11px] font-semibold text-navy-3 first:border-l-0">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5">
          {days.map((day) => {
            const key = toDateKey(day);
            const dayEvents = eventsOfDay(day);
            const expanded = expandedKey === key;
            const shown = expanded ? dayEvents : dayEvents.slice(0, VISIBLE_EVENTS_PER_DAY);
            const hidden = dayEvents.length - shown.length;
            const inMonth = isSameMonth(day, month);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                role="group"
                aria-label={formatDayLong(day)}
                className={cn(
                  'flex min-h-[132px] flex-col gap-1 border-b border-l border-default p-1.5 [&:nth-child(5n+1)]:border-l-0',
                  inMonth ? 'bg-surface' : 'bg-canvas',
                  isToday && 'ring-2 ring-inset ring-control'
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn(
                      'font-title text-sm font-bold tabular-nums',
                      inMonth ? 'text-navy' : 'text-navy-3'
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {isToday && (
                    <span className="rounded bg-canvas px-1 text-[9px] font-bold uppercase tracking-wide text-navy-2">Hoje</span>
                  )}
                </div>

                {shown.map((event) => {
                  const isMilestone = event.kind === 'milestone';
                  const state = event.state || 'padrao';
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={event.onClick}
                      aria-label={
                        isMilestone
                          ? `${MILESTONE_LABEL}: ${event.title}, ${formatDayLong(day)}`
                          : `${event.title}, ${formatDayLong(day)}${event.time ? `, ${event.time}` : ''}, ${STATE_LABELS[state]}`
                      }
                      className={cn(
                        'overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow hover:shadow-md',
                        isMilestone ? MILESTONE_EVENT_CLASSES : STATE_EVENT_CLASSES[state]
                      )}
                    >
                      {isMilestone && event.icon && (
                        <span className="mr-1 inline-flex align-middle" aria-hidden="true">{event.icon}</span>
                      )}
                      {event.time && <span className="mr-1 font-bold tabular-nums">{event.time}</span>}
                      <span className="font-semibold">{event.title}</span>
                    </button>
                  );
                })}

                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedKey(key)}
                    className="rounded px-1 text-left text-[11px] font-semibold text-navy-2 hover:underline"
                  >
                    +{hidden} {hidden === 1 ? 'compromisso' : 'compromissos'}
                  </button>
                )}
                {expanded && dayEvents.length > VISIBLE_EVENTS_PER_DAY && (
                  <button
                    type="button"
                    onClick={() => setExpandedKey(null)}
                    className="rounded px-1 text-left text-[11px] font-semibold text-navy-2 hover:underline"
                  >
                    Recolher
                  </button>
                )}

                {onSelectDay && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    aria-label={`Agendar em ${formatDayLong(day)}`}
                    className="group min-h-[28px] flex-1 rounded-md border border-dashed border-transparent text-left hover:border-control hover:bg-surface-hover"
                  >
                    <span className="pointer-events-none block px-1 text-[11px] font-semibold text-navy-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      + Agendar
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* No celular: grade compacta + o dia escolhido aberto embaixo. */}
      <div className="min-[721px]:hidden">
        <div className="grid grid-cols-5 border-b border-default">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1.5 text-center text-[10px] font-semibold text-navy-3">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5">
          {days.map((day) => {
            const key = toDateKey(day);
            const dayEvents = eventsOfDay(day);
            const inMonth = isSameMonth(day, month);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPickedKey(key)}
                aria-pressed={isSelected}
                aria-label={`${formatDayLong(day)}, ${dayEvents.length === 0 ? 'sem compromisso' : `${dayEvents.length} compromisso(s)`}`}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center gap-1 border-b border-l border-default py-1.5 [&:nth-child(5n+1)]:border-l-0',
                  isSelected ? 'bg-inverse' : inMonth ? 'bg-surface' : 'bg-canvas',
                  !isSelected && isToday && 'ring-2 ring-inset ring-control'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    isSelected ? 'text-inverse-ink' : inMonth ? 'text-navy' : 'text-navy-3'
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full border',
                        isSelected
                          ? 'border-inverse-ink bg-inverse-ink'
                          : event.kind === 'milestone'
                            ? MILESTONE_DOT_CLASSES
                            : STATE_DOT_CLASSES[event.state || 'padrao']
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-default">
          <div className="bg-surface-sunken px-4 py-2">
            <h4 className="text-sm font-bold first-letter:uppercase text-navy">{formatDayLong(selectedDay)}</h4>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="px-4 py-3 text-sm text-navy-3">{emptyMessage}</p>
          ) : (
            selectedEvents.map((event) => {
              const isMilestone = event.kind === 'milestone';
              const state = event.state || 'padrao';
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={event.onClick}
                  className="flex w-full items-start gap-3 border-t border-default px-4 py-3 text-left hover:bg-surface-hover"
                >
                  <span className="w-[52px] shrink-0 text-xs tabular-nums text-navy-3">{!isMilestone && event.time}</span>
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{event.title}</p>
                    {event.subtitle && <p className="truncate text-xs text-navy-3">{event.subtitle}</p>}
                  </span>
                  {isMilestone ? (
                    <Badge className={MILESTONE_BADGE_CLASSES}>{MILESTONE_LABEL}</Badge>
                  ) : (
                    <Badge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABELS[state]}</Badge>
                  )}
                </button>
              );
            })
          )}
          {onSelectDay && (
            <button
              type="button"
              onClick={() => onSelectDay(selectedDay)}
              className="min-h-11 w-full border-t border-default px-4 py-2 text-left text-sm font-semibold text-navy-2 hover:bg-surface-hover"
            >
              + Agendar neste dia
            </button>
          )}
        </div>
      </div>

      {weekendEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-default bg-surface-sunken px-4 py-3">
          <span className="text-xs font-semibold text-navy-2">No fim de semana:</span>
          {weekendEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={event.onClick}
              className={cn(
                'rounded-md border px-2 py-1 text-xs hover:bg-surface-hover',
                event.kind === 'milestone'
                  ? 'border-pink-soft-border bg-pink-soft text-pink-soft-ink'
                  : 'border-default bg-surface text-navy-2'
              )}
            >
              <span className="font-semibold capitalize">
                {event.date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })}
              </span>
              {event.time ? ` · ${event.time}` : ''} · {event.title}
            </button>
          ))}
        </div>
      )}

      <CalendarLegend
        extraItems={hasMilestones ? [{ key: 'milestone', label: MILESTONE_LABEL, dotClassName: MILESTONE_DOT_CLASSES }] : undefined}
      />
    </div>
  );
}
