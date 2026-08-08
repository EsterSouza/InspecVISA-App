import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  Headset,
  Home,
  LogOut,
  Plus,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SyncIndicator } from '../ui/SyncIndicator';

const staffNavItems = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/templates', icon: FileText, label: 'Roteiros' },
  { to: '/legislations', icon: BookOpen, label: 'Biblioteca' },
  { to: '/schedules', icon: Calendar, label: 'Agendamentos' },
  { to: '/requests', icon: Headset, label: 'Solicitações' },
  { to: '/inspections', icon: ClipboardCheck, label: 'Inspeções' },
  { to: '/sync', icon: Activity, label: 'Sincronização' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

const clientNavItems = [
  { to: '/inspections', icon: ClipboardCheck, label: 'Minhas inspeções' },
  { to: '/profile', icon: User, label: 'Meu perfil' },
];

export function Sidebar() {
  const settings = useSettingsStore((s) => s.settings);
  const { signOut, tenantInfo } = useAuthStore();

  const isClient = tenantInfo?.role === 'client';
  const navItems = isClient ? clientNavItems : staffNavItems;
  const displayName = isClient ? tenantInfo?.email : settings.name || 'Consultora';
  const initials = (displayName || 'C').trim().charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logo-claro-192.png"
              alt="TreinaVISA"
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-gray-950">InspecVISA</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Gestão sanitária
              </p>
            </div>
          </div>
          <SyncIndicator compact />
        </div>
      </div>

      <div className="px-4 pb-4">
        <NavLink
          to="/new"
          className={({ isActive }) =>
            `flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-bold text-white shadow-sm transition-colors ${
              isActive ? 'bg-primary-800' : 'bg-primary-700 hover:bg-primary-800'
            }`
          }
        >
          <Plus className="h-4 w-4" />
          Nova inspeção
        </NavLink>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Navegação principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-primary-700' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-950">{displayName}</p>
            <p className="truncate text-xs font-medium capitalize text-gray-500">{tenantInfo?.role ?? 'staff'}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
