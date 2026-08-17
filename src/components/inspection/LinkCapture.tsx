import React, { useState } from 'react';
import { Link2, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';

interface LinkCaptureProps {
  inputId: string;
  links: string[];
  onChange: (links: string[]) => void;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function LinkCapture({ inputId, links, onChange }: LinkCaptureProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addLink = () => {
    const value = draft.trim();
    if (!value) {
      setError('Cole um link.');
      return;
    }
    if (!isValidHttpUrl(value)) {
      setError('Link inválido. Use um endereço começando com http:// ou https://');
      return;
    }
    onChange([...links, value]);
    setDraft('');
    setError(null);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="flex items-center gap-1.5">
        <Link2 className="h-4 w-4 text-navy-3" aria-hidden="true" /> Link / fonte consultada
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="url"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
          placeholder="https://..."
          className="min-h-11 flex-1 shadow-sm"
        />
        <button
          type="button"
          onClick={addLink}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 text-sm font-semibold text-primary-800 hover:bg-primary-100"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}

      {links.length > 0 && (
        <ul className="space-y-1.5">
          {links.map((link, index) => (
            <li key={`${link}-${index}`} className="flex items-center gap-2 rounded-md border border-default bg-surface-sunken px-3 py-2 text-sm">
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-primary-700 hover:underline"
                title={link}
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{link}</span>
              </a>
              <button
                type="button"
                onClick={() => removeLink(index)}
                className="shrink-0 rounded p-1 text-navy-3 hover:bg-danger-soft hover:text-danger"
                aria-label={`Remover link ${link}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
