import { CalendarPlus, ExternalLink, FileText, FolderOpen, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClientPortalAuditEventType } from '../../types';
import type { ClientPortalUnit } from '../../services/clientPortalService';

interface PortalQuickActionsProps {
  enabled: boolean;
  mainDriveFolderUrl: string | null;
  tutorialPdfUrl: string | null;
  supportWhatsapp: string | null;
  schedulingSuspended: boolean;
  units: ClientPortalUnit[];
  onAudit: (eventType: ClientPortalAuditEventType, payload?: Record<string, unknown>) => void;
}

function validHttpsUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function whatsappUrl(value: string | null | undefined): string | null {
  const number = value?.replace(/\D/g, '') || '';
  return number.length >= 10 && number.length <= 15 ? `https://wa.me/${number}` : null;
}

const actionClassName = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 sm:w-auto';

export function PortalQuickActions({
  enabled,
  mainDriveFolderUrl,
  tutorialPdfUrl,
  supportWhatsapp,
  schedulingSuspended,
  units,
  onAudit,
}: PortalQuickActionsProps) {
  if (!enabled) return null;

  const mainFolderUrl = validHttpsUrl(mainDriveFolderUrl);
  const tutorialUrl = validHttpsUrl(tutorialPdfUrl);
  const supportUrl = whatsappUrl(supportWhatsapp);
  const folderUnits = units.flatMap((unit) => {
    const url = unit.has_personalized_sanitary_folder ? validHttpsUrl(unit.personalized_sanitary_folder_url) : null;
    return url ? [{ unit, url }] : [];
  });

  return (
    <section aria-labelledby="portal-quick-actions" className="mb-6 rounded-xl border border-primary-100 bg-primary-50/60 p-4 shadow-sm sm:p-5">
      <h3 id="portal-quick-actions" className="mb-3 font-title text-base font-semibold text-primary-900">
        Acessos rápidos
      </h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mainFolderUrl && (
          <a
            href={mainFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAudit('main_drive_folder_opened')}
            className={`${actionClassName} border-primary-200 bg-surface text-primary-800 hover:bg-primary-100`}
          >
            <FolderOpen className="h-4 w-4" /> Abrir pasta principal completa <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {folderUnits.length > 0 && (
          <Link
            to="/cliente/pastas"
            onClick={() => onAudit('sanitary_folders_page_opened', { unit_count: folderUnits.length })}
            className={`${actionClassName} border-success-soft-border bg-surface text-success-soft-ink hover:bg-success-soft`}
          >
            <FolderOpen className="h-4 w-4" />
            {folderUnits.length === 1
              ? `Abrir Pasta Sanitária Personalizada — ${folderUnits[0].unit.client_name}`
              : `Pastas sanitárias personalizadas (${folderUnits.length} unidades)`}
          </Link>
        )}
        {tutorialUrl && (
          <a
            href={tutorialUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAudit('portal_tutorial_opened')}
            className={`${actionClassName} border-primary-200 bg-surface text-primary-800 hover:bg-primary-100`}
          >
            <FileText className="h-4 w-4" /> Abrir tutorial do portal (PDF) <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {!schedulingSuspended && (
          <Link
            to="/agendar"
            onClick={() => onAudit('schedule_cta_clicked', { source: 'quick_actions' })}
            className={`${actionClassName} border-primary-700 bg-primary-700 text-white hover:bg-primary-800`}
          >
            <CalendarPlus className="h-4 w-4" /> Agendar horário com as consultoras
          </Link>
        )}
        {supportUrl && (
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAudit('support_whatsapp_clicked')}
            className={`${actionClassName} border-success-soft-ink bg-success-soft-ink text-white hover:bg-success-soft-ink`}
          >
            <MessageCircle className="h-4 w-4" /> Falar com a consultoria <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </section>
  );
}
