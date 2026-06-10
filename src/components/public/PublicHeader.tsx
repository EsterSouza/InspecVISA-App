import { ShieldCheck } from 'lucide-react';

/** Cabeçalho compartilhado das telas públicas do portal de agendamento. */
export function PublicHeader() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-[600px] items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-gray-900">InspecVISA</h1>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            HUB TREINAVISA SERVIÇOS
          </p>
        </div>
      </div>
    </header>
  );
}
