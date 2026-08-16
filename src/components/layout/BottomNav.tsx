import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Gauge, Home, MoreHorizontal, PlusCircle, Users } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { SyncIndicator } from '../ui/SyncIndicator';
import { Drawer } from '../ui/Drawer';
import { STAFF_NAV_GROUPS, CLIENT_NAV_ITEMS, type NavItem } from './navConfig';

/**
 * Barra de atalhos + gaveta "Mais": docs/HANDOFF-FRONTEND.md § FE-06. A barra
 * espelha o início da nova ordem do Sidebar (Início, Painel, Clientes); o
 * resto de STAFF_NAV_GROUPS (Agendamentos, Inspeções, Solicitações, Roteiros,
 * Biblioteca, Sincronização, Configurações) mora na gaveta — antes esses 4
 * primeiros não tinham nenhum acesso no celular.
 */
const staffQuickItems: NavItem[] = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/painel', icon: Gauge, label: 'Painel' },
  { to: '/clients', icon: Users, label: 'Clientes' },
];

const quickPaths = new Set(staffQuickItems.map((item) => item.to));

function MoreDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Mais opções" side="right">
      <nav className="space-y-4" aria-label="Mais navegação">
        {STAFF_NAV_GROUPS.map((group, groupIndex) => {
          const items = group.items.filter((item) => !quickPaths.has(item.to));
          if (items.length === 0) return null;
          return (
            <div key={group.label ?? `group-${groupIndex}`}>
              {group.label && (
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
                          isActive ? 'bg-primary-50 text-primary-800' : 'text-gray-600 hover:bg-gray-50'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </Drawer>
  );
}

export function BottomNav() {
  const { tenantInfo } = useAuthStore();
  const isClient = tenantInfo?.role === 'client';
  const quickItems = isClient ? CLIENT_NAV_ITEMS : staffQuickItems;
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white pb-safe lg:hidden">
        <div className="flex justify-center -mt-4 mb-2 pointer-events-none">
          <div className="pointer-events-auto scale-90 origin-bottom">
            <SyncIndicator />
          </div>
        </div>
        <div className="flex h-16 items-center justify-around px-2">
          {quickItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center space-y-1 p-2 ${
                    isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 ${isActive ? 'fill-primary-50 stroke-primary-600' : ''}`} />
                    <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          <NavLink
            to="/new"
            className={({ isActive }) =>
              `flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-95 ${
                isActive ? 'bg-primary-700' : 'bg-primary-600 hover:bg-primary-700'
              }`
            }
          >
            <PlusCircle className="h-6 w-6" />
          </NavLink>

          {!isClient && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center space-y-1 p-2 text-gray-500 hover:text-gray-900"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          )}
        </div>
      </nav>

      {!isClient && <MoreDrawer isOpen={moreOpen} onClose={() => setMoreOpen(false)} />}
    </>
  );
}
