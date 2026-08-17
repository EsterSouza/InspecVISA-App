import { useCallback, useEffect, useState } from 'react';
import { Loader2, Paperclip, Trash2 } from 'lucide-react';
import type { AppointmentAttachment } from '../../types';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import { Button } from '../ui/Button';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { errorMessage } from './appointmentRequestsShared';
import { toast } from '../../store/useToastStore';

export function PublishedFilesPanel({ requestId, busy }: { requestId: string; busy: boolean }) {
  const [files, setFiles] = useState<AppointmentAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadFiles = useCallback(() => {
    setLoading(true);
    AppointmentAdminService.listAttachments(requestId)
      .then((rows) => setFiles(rows.filter((row) => row.kind !== 'photo')))
      .catch((err) => console.warn('[PublishedFilesPanel] Falha ao carregar anexos:', err))
      .finally(() => setLoading(false));
  }, [requestId]);

  useEffect(() => {
    if (!busy) loadFiles();
  }, [busy, loadFiles]);

  const handleRemove = async (file: AppointmentAttachment) => {
    const ok = await confirm({
      title: `Remover "${file.file_name || 'arquivo'}" do portal?`,
      description: 'O cliente deixa de vê-lo no portal.',
      confirmLabel: 'Remover arquivo',
    });
    if (!ok) return;
    setRemovingId(file.id);
    try {
      await AppointmentAdminService.removePublishedAttachment(file.id);
      loadFiles();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading && files.length === 0) {
    return (
      <div className="rounded-xl border border-default bg-surface-sunken p-3 text-xs text-navy-3">
        Carregando arquivos publicados...
      </div>
    );
  }

  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-default bg-surface-sunken p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-3">Relatórios e anexos no portal</p>
        <button type="button" onClick={loadFiles} className="text-xs font-semibold text-primary-700 hover:text-primary-900">
          Atualizar
        </button>
      </div>
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-2 rounded-lg border border-default bg-surface px-3 py-2">
            <Paperclip className="h-4 w-4 shrink-0 text-navy-3" />
            <span className="min-w-0 flex-1 break-words text-sm text-navy-2">
              {file.file_name || (file.kind === 'report_pdf' ? 'Relatório PDF' : 'Anexo')}
            </span>
            {file.signed_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(file.signed_url, '_blank', 'noopener,noreferrer')}
                aria-label={`Abrir ${file.file_name || 'arquivo'}`}
              >
                Abrir
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removingId === file.id}
              onClick={() => void handleRemove(file)}
              className="text-danger hover:bg-danger-soft"
              aria-label={`Remover ${file.file_name || 'arquivo'} do portal`}
            >
              {removingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ))}
      </div>
      {confirmDialog}
    </div>
  );
}
