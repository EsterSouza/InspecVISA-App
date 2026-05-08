import React from 'react';
import { AlertTriangle, Camera, CheckCircle, Clock, Trash2, Maximize, X, PlusCircle, XCircle } from 'lucide-react';
import { compressImage, generateId } from '../../utils/imageUtils';
import type { InspectionPhoto } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PhotoCaptureProps {
  inputId: string;
  photos: InspectionPhoto[];
  onAddPhoto: (photo: Omit<InspectionPhoto, 'id'>) => void | Promise<void>;
  onRemovePhoto: (id: string) => void;
}

export function PhotoCapture({ inputId, photos, onAddPhoto, onRemovePhoto }: PhotoCaptureProps) {
  const [fullscreenPhoto, setFullscreenPhoto] = React.useState<string | null>(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const dataUrl = await compressImage(file);
      await onAddPhoto({
        responseId: '', // will be set by parent
        dataUrl,
        takenAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending'
      });
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Error compressing image:', err);
      alert('Erro ao processar imagem. Tente novamente.');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          id={`${inputId}-camera`}
          onChange={handleCapture}
          disabled={isCompressing}
        />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id={`${inputId}-gallery`}
          onChange={handleCapture}
          disabled={isCompressing}
        />
        
        <Button
          type="button"
          variant="outline"
          className="flex-1 flex items-center justify-center space-x-2 border-dashed border-2 bg-gray-50 py-4 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => document.getElementById(`${inputId}-camera`)?.click()}
          disabled={isCompressing}
        >
          <Camera className="h-4 w-4" />
          <span>Tirar Foto</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="flex-1 flex items-center justify-center space-x-2 border-dashed border-2 bg-gray-50 py-4 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => document.getElementById(`${inputId}-gallery`)?.click()}
          disabled={isCompressing}
        >
          <PlusCircle className="h-4 w-4" />
          <span>Galeria</span>
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-gray-500 text-center italic">
        {isCompressing ? 'Processando imagem...' : `${photos.length} foto(s) registrada(s)`}
      </p>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              onPreview={(dataUrl) => setFullscreenPhoto(dataUrl)}
              onRemove={() => onRemovePhoto(photo.id)}
            />
          ))}
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      <Modal
        isOpen={!!fullscreenPhoto}
        onClose={() => setFullscreenPhoto(null)}
        title="Visualizar Foto"
        className="max-w-3xl"
      >
        {fullscreenPhoto && (
          <div className="flex justify-center">
            <img src={fullscreenPhoto} alt="Evidência em tela cheia" className="max-h-[60vh] object-contain rounded-lg" />
          </div>
        )}
      </Modal>
    </div>
  );
}

function isInlineImage(dataUrl?: string | null) {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl || '');
}

function PhotoTile({ photo, onPreview, onRemove }: { photo: InspectionPhoto; onPreview: (dataUrl: string) => void; onRemove: () => void }) {
  const hasLocalImage = isInlineImage(photo.dataUrl);
  const hasHydrationError = Boolean(photo.syncError?.includes('ainda nao baixou'));

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      {hasLocalImage ? (
        <img
          src={photo.dataUrl}
          alt="Evidência"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          onClick={() => onPreview(photo.dataUrl)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 p-3 text-center text-[11px] font-semibold text-slate-500">
          {hasHydrationError ? (
            <>
              <XCircle className="h-5 w-5 text-amber-500" />
              <span>Foto no servidor</span>
              <span className="font-normal text-slate-400">Tente abrir online novamente</span>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 animate-pulse text-blue-500" />
              <span>Baixando foto</span>
              <span className="font-normal text-slate-400">As respostas ja estao visiveis</span>
            </>
          )}
        </div>
      )}

      <PhotoSyncBadge photo={photo} />
      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center space-x-2">
        {hasLocalImage && (
          <button
            type="button"
            onClick={() => onPreview(photo.dataUrl)}
            className="rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
          >
            <Maximize className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full bg-red-500/80 p-2 text-white hover:bg-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PhotoSyncBadge({ photo }: { photo: InspectionPhoto }) {
  if (!isInlineImage(photo.dataUrl) && (photo.storagePath || photo.dataUrl?.startsWith('storage://'))) {
    const failed = Boolean(photo.syncError?.includes('ainda nao baixou'));
    const Icon = failed ? AlertTriangle : Clock;
    return (
      <div className={`absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase shadow ${failed ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
        <Icon className="h-3 w-3" />
        {failed ? 'Remota' : 'Baixando'}
      </div>
    );
  }

  const status = photo.syncStatus;
  const config = {
    synced: { label: 'OK', className: 'bg-emerald-600 text-white', icon: CheckCircle },
    pending: { label: 'Pendente', className: 'bg-blue-600 text-white', icon: Clock },
    syncing: { label: 'Enviando', className: 'bg-blue-600 text-white', icon: Clock },
    failed: { label: 'Falha', className: 'bg-red-600 text-white', icon: XCircle },
    conflict: { label: 'Conflito', className: 'bg-amber-500 text-white', icon: AlertTriangle }
  }[status];
  const Icon = config.icon;

  return (
    <div className={`absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase shadow ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  );
}
