import { ExternalLink, FolderOpen } from 'lucide-react';
import type { ClientPortalUnit } from '../../services/clientPortalService';
import { CopyLinkButton } from './CopyLinkButton';

interface PortalFoldersProps {
  mainDriveFolderUrl: string | null;
  units: ClientPortalUnit[];
  onOpen: (unitName?: string) => void;
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

/**
 * Página própria pra pasta sanitária personalizada de cada unidade — antes eram N botões
 * empilhados em "Acessos rápidos" (um por unidade), poluindo a Visão geral de contas grandes.
 * Aqui dá pra abrir a pasta ou copiar o link pra mandar pra outra pessoa (ex.: o gestor da
 * unidade, que não tem por que abrir as pastas das outras casas da rede).
 */
export function PortalFolders({ mainDriveFolderUrl, units, onOpen }: PortalFoldersProps) {
  const mainFolderUrl = validHttpsUrl(mainDriveFolderUrl);
  const folderUnits = units.flatMap((unit) => {
    const url = unit.has_personalized_sanitary_folder ? validHttpsUrl(unit.personalized_sanitary_folder_url) : null;
    return url ? [{ unit, url }] : [];
  });

  if (!mainFolderUrl && folderUnits.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-default bg-surface p-8 text-center text-sm text-navy-2">
        Nenhuma pasta sanitária cadastrada ainda.
      </section>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-title text-2xl font-semibold text-navy">Pastas sanitárias</h1>
        <p className="mt-1 max-w-[72ch] text-sm text-navy-2">
          Abra a pasta de cada unidade ou copie o link pra mandar direto pra quem cuida dela.
        </p>
      </div>

      {mainFolderUrl && (
        <div className="mb-6 rounded-lg border border-default bg-surface shadow-sm">
          <div className="border-b border-default px-4 py-3">
            <h2 className="font-title text-base font-semibold text-navy">Pasta principal completa</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-navy-2">Todas as unidades da rede, num só lugar.</p>
            <div className="flex shrink-0 gap-2">
              <a
                href={mainFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpen()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-700 px-3 text-xs font-semibold text-white hover:bg-primary-800"
              >
                <FolderOpen className="h-3.5 w-3.5" /> Abrir <ExternalLink className="h-3 w-3" />
              </a>
              <CopyLinkButton url={mainFolderUrl} label="pasta principal completa" />
            </div>
          </div>
        </div>
      )}

      {folderUnits.length > 0 && (
        <div className="rounded-lg border border-default bg-surface shadow-sm">
          <div className="border-b border-default px-4 py-3">
            <h2 className="font-title text-base font-semibold text-navy">Por unidade</h2>
          </div>
          <div className="divide-y divide-default">
            {folderUnits.map(({ unit, url }) => (
              <div key={unit.client_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="min-w-0 truncate text-sm font-semibold text-navy">{unit.client_name}</p>
                <div className="flex shrink-0 gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOpen(unit.client_name)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-success-soft-border bg-surface px-3 text-xs font-semibold text-success-soft-ink hover:bg-success-soft"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                  <CopyLinkButton url={url} label={`pasta de ${unit.client_name}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
