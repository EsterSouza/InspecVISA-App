import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface ClientRouteProps {
  children: React.ReactNode;
}

/**
 * Protege rotas exclusivas de clientes.
 * - Admin/consultant são redirecionados para o dashboard.
 * - Sem tenantInfo (período de transição): redireciona para dashboard.
 */
export function ClientRoute({ children }: ClientRouteProps) {
  const { user, tenantInfo, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!tenantInfo || tenantInfo.role !== 'client') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
