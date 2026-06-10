/** Cabeçalho compartilhado das telas públicas do portal de agendamento. */
export function PublicHeader() {
  return (
    <header className="border-b border-primary-100 bg-white">
      <div className="mx-auto flex max-w-[600px] items-center gap-3 px-4 py-4">
        <img
          src="/favicon.svg"
          alt="InspecVISA"
          className="h-11 w-11 rounded-xl bg-primary-900 shadow-sm"
        />
        <div>
          <h1 className="text-lg font-bold leading-tight text-gray-900">InspecVISA</h1>
          <p className="text-xs font-medium uppercase tracking-wide text-primary-700">
            HUB TREINAVISA SERVIÇOS
          </p>
        </div>
      </div>
    </header>
  );
}
