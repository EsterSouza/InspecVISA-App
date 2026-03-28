import React from 'react';
import { Camera, Trash2, Maximize, X } from 'lucide-react';
import { compressImage, generateId } from '../../utils/imageUtils';
import type { InspectionPhoto } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PhotoCaptureProps {
  inputId: string;
  photos: InspectionPhoto[];
  onAddPhoto: (photo: Omit<InspectionPhoto, 'id'>) => void;
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
      const dataUrl = await compressImage(file, 1200, 0.85);
      onAddPhoto({
        responseId: '', // will be set by parent
        dataUrl,
        takenAt: new Date(),
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
      {/* Action Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          id={inputId}
          onChange={handleCapture}
          disabled={isCompressing}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center space-x-2 border-dashed border-2 bg-gray-50 py-6 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={isCompressing}
        >
          <Camera className="h-5 w-5" />
          <span>{isCompressing ? 'Processando...' : 'Registrar evidência fotográfica'}</span>
        </Button>
        <p className="mt-2 text-xs text-gray-500 text-center">
          {photos.length} foto{photos.length !== 1 && 's'} adicionada{photos.length !== 1 && 's'}
        </p>
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
            >
              <img
                src={photo.dataUrl}
                alt="Evidência"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                onClick={() => setFullscreenPhoto(photo.dataUrl)}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setFullscreenPhoto(photo.dataUrl)}
                  className="rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
                >
                  <Maximize className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePhoto(photo.id);
                  }}
                  className="rounded-full bg-red-500/80 p-2 text-white hover:bg-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
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
