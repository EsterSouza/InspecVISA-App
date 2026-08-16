import { Link } from 'react-router-dom';

export function PublicHeader() {
  return (
    <header className="border-b border-primary-100 bg-white">
      <Link
        to="/cliente"
        className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 transition-opacity hover:opacity-85 sm:px-6"
      >
        <img
          src="/logo-claro-192.png"
          alt="TreinaVISA"
          className="h-11 w-11 rounded-xl shadow-sm"
        />
        <div>
          <h1 className="text-lg font-bold leading-tight text-gray-900">InspecVISA</h1>
          <p className="text-xs font-medium uppercase tracking-wide text-primary-700">
            HUB TREINAVISA SERVIÇOS
          </p>
        </div>
      </Link>
    </header>
  );
}
