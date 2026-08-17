import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import type { AppointmentRequest } from '../../../types';
import {
  AppointmentAdminService,
  type InspectionOption,
  type InspectionPhotoOption,
} from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { useConfirmDialog } from '../../ui/ConfirmDialog';
import { Field } from '../../ui/Field';
import { Select } from '../../ui/Select';
import { errorMessage } from '../appointmentRequestsShared';
import { toast } from '../../../store/useToastStore';

interface AddPhotosModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onAdded: () => void;
}

export function AddPhotosModal({ request, onClose, onAdded }: AddPhotosModalProps) {
  const [inspections, setInspections] = useState<InspectionOption[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState(request.inspection_id || '');
  const [photos, setPhotos] = useState<InspectionPhotoOption[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [published, setPublished] = useState<{ id: string; caption: string | null; previewUrl?: string }[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadingInspections, setLoadingInspections] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadPublished = () => {
    AppointmentAdminService.listPublishedPhotos(request.id)
      .then(setPublished)
      .catch((err) => console.warn('[AddPhotosModal] Falha ao carregar fotos publicadas:', err));
  };
  useEffect(loadPublished, [request.id]);

  const allSelected = photos.length > 0 && selectedPhotoIds.size === photos.length;
  const toggleAll = () => {
    setSelectedPhotoIds(allSelected ? new Set() : new Set(photos.map((p) => p.photoId)));
  };

  const handleRemovePublished = async (id: string) => {
    const ok = await confirm({
      title: 'Remover foto do portal?',
      description: 'O cliente deixa de vê-la no portal.',
      confirmLabel: 'Remover foto',
    });
    if (!ok) return;
    setRemovingId(id);
    try {
      await AppointmentAdminService.removePublishedAttachment(id);
      loadPublished();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  useEffect(() => {
    if (!request.client_id) {
      setLoadingInspections(false);
      return;
    }
    AppointmentAdminService.listCompletedInspectionsForClient(request.client_id)
      .then(setInspections)
      .catch((err) => {
        console.error(err);
        setError('Falha ao carregar inspeções do cliente vinculado.');
      })
      .finally(() => setLoadingInspections(false));
  }, [request.client_id]);

  useEffect(() => {
    if (!selectedInspectionId) {
      setPhotos([]);
      return;
    }
    setLoadingPhotos(true);
    AppointmentAdminService.listInspectionPhotoOptions(selectedInspectionId)
      .then(setPhotos)
      .catch((err) => {
        console.error(err);
        setError('Falha ao carregar fotos da inspeção.');
      })
      .finally(() => setLoadingPhotos(false));
  }, [selectedInspectionId]);

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const handleSave = async () => {
    const selected = photos.filter((p) => selectedPhotoIds.has(p.photoId));
    if (selected.length === 0 || !selectedInspectionId) return;
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.addPhotosToPortal(request, selectedInspectionId, selected);
      onAdded();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err) || 'Falha ao publicar as fotos no portal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-photos-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl"
      >
        <CardContent className="p-6">
          <h3 id="add-photos-title" className="mb-1 text-xl font-bold text-navy">Adicionar fotos ao portal</h3>
          <p className="mb-6 text-sm text-navy-3">{request.unit_name}</p>

          {!request.client_id ? (
            <p className="rounded-xl border border-amber-soft-border bg-amber-soft p-4 text-sm text-amber-soft-ink">
              Esta solicitação ainda não está vinculada a um cliente. Confirme a solicitação
              vinculando um cliente antes de publicar fotos.
            </p>
          ) : loadingInspections ? (
            <div className="flex justify-center py-8" role="status" aria-label="Carregando inspeções">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : inspections.length === 0 ? (
            <p className="rounded-xl border border-default bg-surface-sunken p-4 text-sm text-navy-3">
              Nenhuma inspeção encontrada para o cliente vinculado.
            </p>
          ) : (
            <div className="space-y-4">
              <Field label="Inspeção" htmlFor="add-photos-inspection">
                <Select
                  value={selectedInspectionId}
                  onChange={(e) => {
                    setSelectedInspectionId(e.target.value);
                    setSelectedPhotoIds(new Set());
                  }}
                >
                  <option value="">Selecione a inspeção...</option>
                  {inspections.map((insp) => (
                    <option key={insp.id} value={insp.id}>
                      {new Date(insp.inspectionDate).toLocaleDateString('pt-BR')} —{' '}
                      {insp.status === 'completed' ? 'Finalizada' : 'Em andamento'}
                      {insp.consultantName ? ` · ${insp.consultantName}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {loadingPhotos ? (
                <div className="flex justify-center py-8" role="status" aria-label="Carregando fotos">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : selectedInspectionId && photos.length === 0 ? (
                <p className="rounded-xl border border-default bg-surface-sunken p-4 text-sm text-navy-3">
                  Esta inspeção não possui fotos sincronizadas no Storage.
                </p>
              ) : (
                photos.length > 0 && (
                  <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-navy-3">
                      {selectedPhotoIds.size} de {photos.length} selecionada(s)
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs font-bold text-primary-700 hover:underline"
                    >
                      {allSelected ? 'Limpar seleção' : 'Selecionar todas'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((photo) => {
                      const selected = selectedPhotoIds.has(photo.photoId);
                      return (
                        <button
                          key={photo.photoId}
                          type="button"
                          onClick={() => togglePhoto(photo.photoId)}
                          aria-pressed={selected}
                          aria-label={photo.caption || 'Foto da inspeção'}
                          className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                            selected ? 'border-primary-600 ring-2 ring-primary-200' : 'border-default'
                          }`}
                        >
                          {photo.previewUrl ? (
                            <img
                              src={photo.previewUrl}
                              alt={photo.caption || 'Foto da inspeção'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-surface-sunken text-xs text-navy-3">
                              sem preview
                            </div>
                          )}
                          {selected && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                )
              )}

              {published.length > 0 && (
                <div className="space-y-2 border-t border-default pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-navy-3">
                    Já publicadas no portal ({published.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {published.map((p) => (
                      <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-default bg-surface-sunken">
                        {p.previewUrl ? (
                          <img src={p.previewUrl} alt={p.caption || ''} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-navy-3">foto</div>
                        )}
                        <button
                          type="button"
                          disabled={removingId === p.id}
                          onClick={() => void handleRemovePublished(p.id)}
                          aria-label="Remover foto do portal"
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-danger/90 text-white opacity-0 transition-opacity hover:bg-danger-hover group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          {removingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Fechar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={saving || selectedPhotoIds.size === 0}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publicar {selectedPhotoIds.size > 0 ? `${selectedPhotoIds.size} foto(s)` : 'fotos'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  );
}
