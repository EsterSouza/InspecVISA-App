import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, ClipboardList, Eye, EyeOff, Loader2, Paperclip, RotateCcw } from 'lucide-react';
import type { ClientActionEvidence, ClientActionItem } from '../../types';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { errorMessage, formatDateBR } from './appointmentRequestsShared';
import { toast } from '../../store/useToastStore';

const ACTION_PRIORITY_LABELS: Record<ClientActionItem['priority'], string> = {
  urgent: 'Urgente',
  important: 'Importante',
  recommended: 'Recomendada',
};

const ACTION_STATUS_LABELS: Record<ClientActionItem['status'], string> = {
  published: 'Visível ao cliente',
  hidden: 'Oculto',
  resolved: 'Resolvido',
};

/**
 * Os itens nascem da publicação do relatório (InspectionSummary). Aqui a consultora revisa o
 * que o cliente vê: ocultar item inadequado, republicar, resolver e reabrir. Nada disso toca
 * em `responses` — é a projeção que muda.
 */
const EVIDENCE_STATUS_LABELS: Record<ClientActionEvidence['status'], string> = {
  pending: 'Aguardando revisão',
  approved: 'Aprovada',
  changes_requested: 'Devolvida',
};

const EVIDENCE_STATUS_THEME: Record<ClientActionEvidence['status'], string> = {
  pending: 'bg-sky-100 text-sky-700',
  approved: 'bg-success-soft text-success-soft-ink',
  changes_requested: 'bg-amber-soft text-amber-soft-ink',
};

/**
 * P360-011 — revisão técnica da prova enviada pelo cliente.
 *
 * "Aprovar" e "Aprovar e resolver" são dois botões, não um botão com pergunta: aceitar o
 * arquivo e dar a pendência sanitária por encerrada são decisões diferentes, e a segunda é
 * sempre explícita. Devolver exige orientação — o cliente precisa saber o que refazer.
 */
export function EvidenceReview({
  evidence,
  onReviewed,
}: {
  evidence: ClientActionEvidence[];
  onReviewed: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const review = async (
    row: ClientActionEvidence,
    status: 'approved' | 'changes_requested',
    resolveItem: boolean
  ) => {
    let note = row.review_note || undefined;
    if (status === 'changes_requested') {
      const typed = window.prompt('O que o cliente precisa ajustar? (o texto vai para ele)', note || '');
      if (typed === null) return;
      if (!typed.trim()) {
        toast.error('Devolver exige uma orientação.');
        return;
      }
      note = typed;
    } else {
      const typed = window.prompt('Comentário para o cliente (opcional):', '');
      if (typed === null) return;
      note = typed.trim() || undefined;
    }

    setBusyId(row.id);
    try {
      await AppointmentAdminService.reviewEvidence(row.id, { status, note, resolveItem });
      void AppointmentAdminService.notifyEvidenceReviewed(row.id);
      onReviewed();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const openFile = async (row: ClientActionEvidence) => {
    setBusyId(row.id);
    try {
      // URL temporária, assinada na hora: se expirar, é só clicar de novo.
      const url = await AppointmentAdminService.evidenceSignedUrl(row);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (evidence.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 border-t border-dashed border-default pt-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-3">
        Evidências do cliente · {evidence.length}
      </p>
      {evidence.map((row) => (
        <div key={row.id} className="rounded-md bg-surface-sunken px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${EVIDENCE_STATUS_THEME[row.status]}`}>
              {EVIDENCE_STATUS_LABELS[row.status]}
            </span>
            <span className="break-all text-[11px] font-medium text-navy-2">{row.file_name}</span>
            <span className="text-[11px] text-navy-3">{formatDateBR(row.submitted_at)}</span>
          </div>
          {row.client_note && (
            <p className="mt-1 break-words text-[11px] text-navy-2">
              <span className="font-semibold">Cliente: </span>
              {row.client_note}
            </p>
          )}
          {row.review_note && (
            <p className="mt-1 break-words text-[11px] text-navy-2">
              <span className="font-semibold">Sua orientação: </span>
              {row.review_note}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busyId === row.id}
              onClick={() => void openFile(row)}
              className="text-navy-2 hover:bg-surface-active"
            >
              <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Abrir arquivo
            </Button>
            {row.status !== 'approved' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyId === row.id}
                onClick={() => void review(row, 'approved', false)}
                className="text-success-soft-ink hover:bg-success-soft"
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Aprovar
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busyId === row.id}
              onClick={() => void review(row, 'approved', true)}
              className="text-primary-700 hover:bg-primary-50"
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Aprovar e resolver
            </Button>
            {row.status !== 'changes_requested' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyId === row.id}
                onClick={() => void review(row, 'changes_requested', false)}
                className="text-amber-soft-ink hover:bg-amber-soft"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Devolver
              </Button>
            )}
            {busyId === row.id && <Loader2 className="h-4 w-4 animate-spin text-navy-3" />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionPlanPanel({ requestId, busy }: { requestId: string; busy: boolean }) {
  const [items, setItems] = useState<ClientActionItem[]>([]);
  const [evidence, setEvidence] = useState<ClientActionEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    AppointmentAdminService.listActionItems(requestId)
      .then(async (rows) => {
        setItems(rows);
        setEvidence(await AppointmentAdminService.listActionItemEvidence(rows.map((row) => row.id)));
      })
      .catch((err) => console.warn('[ActionPlanPanel] Falha ao carregar o plano de acao:', err))
      .finally(() => setLoading(false));
  }, [requestId]);

  useEffect(() => {
    if (!busy) loadItems();
  }, [busy, loadItems]);

  const changeStatus = async (item: ClientActionItem, status: ClientActionItem['status']) => {
    setSavingId(item.id);
    try {
      await AppointmentAdminService.setActionItemStatus(item.id, status);
      loadItems();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="rounded-xl border border-default bg-surface-sunken p-3 text-xs text-navy-3">
        Carregando plano de ação do portal...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-default bg-surface-sunken p-3 text-xs text-navy-3">
        Nenhum item de plano de ação para esta visita.
      </div>
    );
  }

  const visible = items.filter((item) => item.status === 'published').length;
  const awaitingReview = evidence.filter((row) => row.status === 'pending').length;

  return (
    <div className="rounded-xl border border-default bg-surface-sunken p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-3">
          <ClipboardList className="h-3.5 w-3.5" /> Plano de ação no portal · {visible} de {items.length} visível(is)
          {awaitingReview > 0 && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
              {awaitingReview} evidência(s) para revisar
            </span>
          )}
        </p>
        <button type="button" onClick={loadItems} className="text-xs font-semibold text-primary-700 hover:text-primary-900">
          Atualizar
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-default bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-bold uppercase text-navy-2">
                {ACTION_PRIORITY_LABELS[item.priority]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  item.status === 'published'
                    ? 'bg-success-soft text-success-soft-ink'
                    : item.status === 'hidden'
                      ? 'bg-amber-soft text-amber-soft-ink'
                      : 'bg-surface-sunken text-navy-3'
                }`}
              >
                {ACTION_STATUS_LABELS[item.status]}
              </span>
              {item.occurrence_count > 1 && (
                <span className="text-[10px] font-bold uppercase text-purple-700">
                  Reincidente ({item.occurrence_count}x)
                </span>
              )}
              <span className="text-[11px] text-navy-3">
                {item.due_date ? `Prazo ${formatDateBR(item.due_date)}` : 'Sem prazo'}
                {item.responsible ? ` · ${item.responsible}` : ''}
              </span>
            </div>
            <p className="mt-1 break-words text-sm font-semibold text-navy">{item.title}</p>
            <dl className="mt-1.5 space-y-1 text-[11px] text-navy-2">
              <div>
                <dt className="inline font-semibold text-navy-2">Situação encontrada: </dt>
                <dd className="inline break-words">{item.situation}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-navy-2">O que fazer: </dt>
                <dd className="inline break-words">{item.recommended_action}</dd>
              </div>
            </dl>
            {item.client_status && (
              <p
                className={`mt-1.5 rounded-md px-2 py-1 text-[11px] ${
                  item.client_status === 'not_done'
                    ? 'bg-amber-soft text-amber-soft-ink'
                    : item.client_status === 'in_progress'
                      ? 'bg-sky-50 text-sky-900'
                      : 'bg-success-soft text-success-soft-ink'
                }`}
              >
                <span className="font-bold uppercase">
                  {item.client_status === 'not_done'
                    ? 'Cliente: ainda não fez'
                    : item.client_status === 'in_progress'
                      ? 'Cliente: providenciando'
                      : 'Cliente: já corrigiu'}
                </span>
                {item.client_status_note ? ` — ${item.client_status_note}` : ''}
                {item.client_status_by_name ? ` (${item.client_status_by_name})` : ''}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.status !== 'published' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={savingId === item.id}
                  onClick={() => void changeStatus(item, 'published')}
                  className="text-success-soft-ink hover:bg-success-soft"
                >
                  {item.status === 'resolved'
                    ? <><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reabrir</>
                    : <><Eye className="mr-1.5 h-3.5 w-3.5" /> Publicar</>}
                </Button>
              )}
              {item.status === 'published' && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={savingId === item.id}
                    onClick={() => void changeStatus(item, 'hidden')}
                    className="text-amber-soft-ink hover:bg-amber-soft"
                  >
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Ocultar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={savingId === item.id}
                    onClick={() => void changeStatus(item, 'resolved')}
                    className="text-primary-700 hover:bg-primary-50"
                  >
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Resolver
                  </Button>
                </>
              )}
              {savingId === item.id && <Loader2 className="h-4 w-4 animate-spin text-navy-3" />}
            </div>
            <EvidenceReview
              evidence={evidence.filter((row) => row.action_item_id === item.id)}
              onReviewed={loadItems}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
