import type { ReactNode } from 'react';
import { CalendarCheck, CalendarClock, FileText, FolderOpen, Headphones, ShieldCheck } from 'lucide-react';
import type { ClientPortalUnit, ClientPortalVisit } from '../../services/clientPortalService';

function formatDateBR(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

const ACTIVE_STATUSES = new Set(['requested', 'confirmed', 'rescheduled']);
const DONE_STATUSES = new Set(['completed', 'report_available']);

function nextPlanned(visits: ClientPortalVisit[], type: string): ClientPortalVisit | null {
  const candidates = visits
    .filter((v) => v.appointment_type === type && ACTIVE_STATUSES.has(v.status) && v.requested_date)
    .sort((a, b) => (a.requested_date! < b.requested_date! ? -1 : 1));
  return candidates[0] || null;
}

function lastCompleted(visits: ClientPortalVisit[], type: string): ClientPortalVisit | null {
  const candidates = visits
    .filter((v) => v.appointment_type === type && DONE_STATUSES.has(v.status))
    .sort((a, b) => {
      const ad = a.requested_date || a.created_at;
      const bd = b.requested_date || b.created_at;
      return ad < bd ? 1 : -1;
    });
  return candidates[0] || null;
}

interface MilestoneRow {
  key: string;
  icon: ReactNode;
  label: string;
  plannedLabel: string | null;
  /** Data (dd/mm/aaaa) de realização, quando existe. */
  completedDate: string | null;
  /** Estado sem data associada (ex.: "Entregue", "Concluída"). */
  completedStatus: string | null;
}

function buildMilestones(unit: ClientPortalUnit): MilestoneRow[] {
  const visits = unit.visits || [];
  const milestones: MilestoneRow[] = [];

  // Inspeção — sempre aplicável.
  const nextInspection = nextPlanned(visits, 'inspection');
  const lastInspection = lastCompleted(visits, 'inspection');
  milestones.push({
    key: 'inspection',
    icon: <ShieldCheck className="h-4 w-4" />,
    label: 'Inspeção',
    plannedLabel: nextInspection ? formatDateBR(nextInspection.requested_date) : null,
    completedDate: lastInspection ? formatDateBR(lastInspection.requested_date) : null,
    completedStatus: null,
  });

  // Relatório — acompanha a inspeção. Sem timestamp de entrega: mostra estado, não data fictícia.
  const inspectionWithDueDate = [...visits]
    .filter((v) => v.appointment_type === 'inspection' && v.report_due_at)
    .sort((a, b) => (a.requested_date || '') < (b.requested_date || '') ? 1 : -1)[0];
  const anyReportDelivered = visits.some((v) => v.appointment_type === 'inspection' && (v.report_count || 0) > 0);
  if (inspectionWithDueDate || anyReportDelivered) {
    milestones.push({
      key: 'report',
      icon: <FileText className="h-4 w-4" />,
      label: 'Relatório',
      plannedLabel: inspectionWithDueDate ? formatDateBR(inspectionWithDueDate.report_due_at) : null,
      completedDate: null,
      completedStatus: anyReportDelivered ? 'Entregue' : null,
    });
  }

  // Pasta Sanitária Personalizada — estado apenas, não existe timestamp de criação.
  if (unit.has_personalized_sanitary_folder) {
    milestones.push({
      key: 'sanitary_folder',
      icon: <FolderOpen className="h-4 w-4" />,
      label: 'Pasta Sanitária Personalizada',
      plannedLabel: null,
      completedDate: null,
      completedStatus: 'Concluída',
    });
  }

  // Auditoria — só aparece se o cliente contratou.
  if (unit.has_audit_service) {
    const nextAudit = nextPlanned(visits, 'audit');
    const lastAudit = lastCompleted(visits, 'audit');
    milestones.push({
      key: 'audit',
      icon: <CalendarCheck className="h-4 w-4" />,
      label: 'Auditoria',
      plannedLabel: nextAudit ? formatDateBR(nextAudit.requested_date) : null,
      completedDate: lastAudit ? formatDateBR(lastAudit.requested_date) : null,
      completedStatus: null,
    });
  }

  // Acompanhamento online — só aparece se o cliente contratou.
  if (unit.has_online_followup) {
    const nextFollowup = nextPlanned(visits, 'online_followup');
    const lastFollowup = lastCompleted(visits, 'online_followup');
    milestones.push({
      key: 'online_followup',
      icon: <Headphones className="h-4 w-4" />,
      label: 'Acompanhamento online',
      plannedLabel: nextFollowup ? formatDateBR(nextFollowup.requested_date) : null,
      completedDate: lastFollowup ? formatDateBR(lastFollowup.requested_date) : null,
      completedStatus: null,
    });
  }

  return milestones;
}

export interface ContractTimelineProps {
  unit: ClientPortalUnit;
}

export function ContractTimeline({ unit }: ContractTimelineProps) {
  const milestones = buildMilestones(unit);
  if (milestones.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
        Cronograma do contrato
      </h3>
      <ul className="space-y-3">
        {milestones.map((m) => (
          <li key={m.key} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              {m.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{m.label}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                {m.plannedLabel && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> Previsto: {m.plannedLabel}
                  </span>
                )}
                {m.completedDate && (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <CalendarCheck className="h-3 w-3" /> Realizado: {m.completedDate}
                  </span>
                )}
                {m.completedStatus && (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <CalendarCheck className="h-3 w-3" /> {m.completedStatus}
                  </span>
                )}
                {!m.plannedLabel && !m.completedDate && !m.completedStatus && (
                  <span className="text-gray-500">Sem data prevista</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
