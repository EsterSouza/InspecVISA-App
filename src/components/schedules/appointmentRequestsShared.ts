import { useState } from 'react';
import type { AppointmentRequest } from '../../types';
import { getLocalActor } from '../../utils/localActor';

export const PERIOD_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  integral: 'Integral',
};

// Aviso pós-ação (relatório publicado / confirmação / remarcação / cancelamento).
export type EventNotifyKind = 'report_available' | 'confirmed' | 'rescheduled' | 'cancelled';
export const EVENT_NOTIFY_TITLES: Record<EventNotifyKind, string> = {
  report_available: 'Relatório publicado',
  confirmed: 'Compromisso confirmado',
  rescheduled: 'Compromisso remarcado',
  cancelled: 'Compromisso cancelado',
};

// Consultoras da equipe — quem fica responsável pela visita (a inspeção herda).
export const SCHEDULE_CONSULTANTS = ['Ester Caiafa', 'Ana Roberta Ribeiro'];
export function defaultScheduleConsultants(): string[] {
  const me = getLocalActor().name;
  return SCHEDULE_CONSULTANTS.includes(me) ? [me] : [];
}

export const STATUS_LABELS: Record<AppointmentRequest['status'], string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Relatório em andamento',
  report_available: 'Relatório disponível',
  cancelled: 'Cancelada',
};

export const STATUS_BADGES: Record<AppointmentRequest['status'], string> = {
  requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  rescheduled: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  report_available: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

// Classe padrão de texto/data/select — placeholder com contraste AA (text-gray-500, não o
// text-gray-400 padrão do Tailwind, que fica abaixo de 4.5:1 em fundo branco).
export const TEXT_INPUT = 'w-full rounded-xl border border-gray-300 p-3 text-sm placeholder:text-gray-500';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'operação falhou.';
}

// Quantos cartões cada seção mostra por vez (evita a rolagem sem fim).
export const PAGE_SIZE = 10;

// Fatia a lista em páginas. Se a lista encolher (ex.: após excluir), volta para
// a última página válida em vez de mostrar vazio.
export function usePagedList<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  return {
    page: current,
    totalPages,
    items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    setPage,
  };
}

export function formatDateBR(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function requestDateTimeValue(request: AppointmentRequest): number {
  if (request.requested_starts_at) return new Date(request.requested_starts_at).getTime();
  const date = request.requested_date || request.created_at;
  const time = request.requested_time || '23:59';
  return new Date(`${date.split('T')[0]}T${time}`).getTime();
}

export function requestTimeValue(request: AppointmentRequest): string {
  if (request.requested_time) return request.requested_time.slice(0, 5);
  if (request.requested_starts_at) {
    return new Date(request.requested_starts_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return '09:00';
}
