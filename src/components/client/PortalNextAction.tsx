import { AlertTriangle, CalendarClock, ChevronRight, ClipboardList, CreditCard, FileWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClientPortalAuditEventType } from '../../types';
import { formatDateBR } from '../../utils/clientPortalFormat';

export interface NextActionPaymentOverdue {
  type: 'payment_overdue';
  unitName?: string | null;
  dueDate: string | null;
  links: { label?: string; url: string }[];
}

export interface NextActionUpcomingAppointment {
  type: 'upcoming_appointment';
  unitName: string;
  date: string;
  time: string | null;
  publicToken: string;
}

export interface NextActionReturnedEvidence {
  type: 'evidence_returned';
  unitName: string;
  itemLabel: string;
  href: string;
}

export interface NextActionOverdueItem {
  type: 'item_overdue';
  unitName: string;
  itemLabel: string;
  dueDate: string;
  href: string;
}

export interface NextActionRequestAwaitingClient {
  type: 'request_awaiting_client';
  unitName: string;
  subject: string;
  href: string;
}

export type NextActionSignal =
  | NextActionPaymentOverdue
  | NextActionUpcomingAppointment
  | NextActionReturnedEvidence
  | NextActionOverdueItem
  | NextActionRequestAwaitingClient;

interface PortalNextActionProps {
  paymentOverdue?: NextActionPaymentOverdue | null;
  upcomingAppointment?: NextActionUpcomingAppointment | null;
  returnedEvidence?: NextActionReturnedEvidence | null;
  overdueItem?: NextActionOverdueItem | null;
  requestAwaitingClient?: NextActionRequestAwaitingClient | null;
  onAudit: (eventType: ClientPortalAuditEventType, payload?: Record<string, unknown>) => void;
}

/**
 * Ordem fixa: financeiro trava o serviço, então vem primeiro; o restante segue a
 * urgência de tempo/conformidade. Nunca mais de um sinal é mostrado por vez.
 */
function resolveSignal(props: PortalNextActionProps): NextActionSignal | null {
  return (
    props.paymentOverdue ||
    props.upcomingAppointment ||
    props.returnedEvidence ||
    props.overdueItem ||
    props.requestAwaitingClient ||
    null
  );
}

// Tom âmbar fica pra selo/indicador pontual (item vencido, atraso) — o próprio painel de
// "próxima ação" é orientação calma, não alarme, mesmo quando o conteúdo é urgente.
const cardTheme = 'border-primary-200 bg-primary-50';
const iconTheme = 'text-primary-700';

export function PortalNextAction(props: PortalNextActionProps) {
  const signal = resolveSignal(props);
  if (!signal) return null;

  const audit = () => props.onAudit('next_action_clicked', { action_type: signal.type });

  let icon = <AlertTriangle className={`h-6 w-6 shrink-0 ${iconTheme}`} />;
  let title = '';
  let description = '';
  let cta: { label: string; href: string; external?: boolean } | null = null;

  switch (signal.type) {
    case 'payment_overdue': {
      icon = <CreditCard className={`h-6 w-6 shrink-0 ${iconTheme}`} />;
      title = 'Pagamento pendente';
      description = signal.dueDate
        ? `Vencimento: ${formatDateBR(signal.dueDate)}. Regularize para manter o acompanhamento em dia.`
        : 'Regularize o pagamento para manter o acompanhamento em dia.';
      const link = signal.links[0];
      if (link) cta = { label: link.label || 'Pagar agora', href: link.url, external: true };
      break;
    }
    case 'upcoming_appointment': {
      icon = <CalendarClock className={`h-6 w-6 shrink-0 ${iconTheme}`} />;
      title = 'Compromisso próximo';
      description = `${signal.unitName} · ${formatDateBR(signal.date)}${signal.time ? ` às ${signal.time}` : ''}`;
      cta = { label: 'Ver detalhes', href: `/cliente/visita/${signal.publicToken}` };
      break;
    }
    case 'evidence_returned': {
      icon = <FileWarning className={`h-6 w-6 shrink-0 ${iconTheme}`} />;
      title = 'Evidência devolvida';
      description = `${signal.unitName} · ${signal.itemLabel}`;
      cta = { label: 'Ver orientação', href: signal.href };
      break;
    }
    case 'item_overdue': {
      icon = <AlertTriangle className={`h-6 w-6 shrink-0 ${iconTheme}`} />;
      title = 'Item vencido no plano de ação';
      description = `${signal.unitName} · ${signal.itemLabel} · prazo ${formatDateBR(signal.dueDate)}`;
      cta = { label: 'Ver item', href: signal.href };
      break;
    }
    case 'request_awaiting_client': {
      icon = <ClipboardList className={`h-6 w-6 shrink-0 ${iconTheme}`} />;
      title = 'Solicitação aguardando você';
      description = `${signal.unitName} · ${signal.subject}`;
      cta = { label: 'Responder', href: signal.href };
      break;
    }
  }

  return (
    <section
      aria-labelledby="portal-next-action"
      className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${cardTheme}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 id="portal-next-action" className="font-title text-base font-semibold text-navy">
            {title}
          </h3>
          <p className="text-sm text-navy-2">{description}</p>
        </div>
      </div>
      {cta &&
        (cta.external ? (
          <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={audit}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary-700 px-4 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-primary-800"
          >
            {cta.label} <ChevronRight className="h-4 w-4" />
          </a>
        ) : (
          <Link
            to={cta.href}
            onClick={audit}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary-700 px-4 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-primary-800"
          >
            {cta.label} <ChevronRight className="h-4 w-4" />
          </Link>
        ))}
    </section>
  );
}
