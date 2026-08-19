import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SyncIndicator } from '../ui/SyncIndicator';
import { Tooltip } from '../ui/Tooltip';
import { STAFF_NAV_GROUPS, CLIENT_NAV_ITEMS } from './navConfig';

export function Sidebar() {
  const settings = useSettingsStore((s) => s.settings);
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
  const { signOut, tenantInfo } = useAuthStore();

  const isClient = tenantInfo?.role === 'client';
  const groups = isClient ? [{ label: null, items: CLIENT_NAV_ITEMS }] : STAFF_NAV_GROUPS;
  const displayName = isClient ? tenantInfo?.email : settings.name || 'Consultora';
  const initials = (displayName || 'C').trim().charAt(0).toUpperCase();

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-default bg-surface transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      <div className={`flex items-start pb-4 pt-5 ${collapsed ? 'justify-center px-2' : 'justify-between gap-3 px-5'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <img
            src="/logo-claro-192.png"
            alt="TreinaVISA"
            className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-navy">InspecVISA</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-navy-3">
                Gestão sanitária
              </p>
            </div>
          )}
        </div>
        {!collapsed && <SyncIndicator compact />}
      </div>

      <div className={collapsed ? 'px-2 pb-4' : 'px-4 pb-4'}>
        {(() => {
          const newInspectionLink = (
            <NavLink
              to="/new"
              aria-label="Nova inspeção"
              className={({ isActive }) =>
                `flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-bold text-on-accent shadow-sm transition-colors ${
                  isActive ? 'bg-primary-800' : 'bg-primary-700 hover:bg-primary-800'
                }`
              }
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && 'Nova inspeção'}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip content="Nova inspeção" side="right" className="block w-full">
              {newInspectionLink}
            </Tooltip>
          ) : (
            newInspectionLink
          );
        })()}
      </div>

      <nav
        className={`flex-1 space-y-1 overflow-y-auto pb-4 ${collapsed ? 'px-2' : 'px-3'}`}
        aria-label="Navegação principal"
      >
        {groups.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className={groupIndex > 0 ? 'pt-3' : undefined}>
            {group.label && !collapsed && (
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-navy-3">
                {group.label}
              </p>
            )}
            {group.label && collapsed && <div className="mx-2 mb-2 border-t border-default" />}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      `group flex h-10 w-full items-center gap-3 rounded-md text-sm font-semibold transition-colors ${
                        collapsed ? 'justify-center px-0' : 'px-3'
                      } ${
                        isActive
                          ? 'bg-primary-50 text-primary-800'
                          : 'text-navy-2 hover:bg-surface-hover hover:text-navy'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? 'text-primary-700' : 'text-navy-3 group-hover:text-navy-2'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );
                return collapsed ? (
                  <Tooltip key={item.to} content={item.label} side="right" className="block w-full">
                    {link}
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`border-t border-default ${collapsed ? 'p-2' : 'p-4'}`}>
        {collapsed ? (
          <div className="mb-2 flex flex-col items-center gap-2">
            <Tooltip content={`${displayName} · ${tenantInfo?.role ?? 'staff'}`} side="right" className="block">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-sm font-bold text-navy-2">
                {initials}
              </div>
            </Tooltip>
            <Tooltip content="Sair" side="right" className="block w-full">
              <button
                type="button"
                onClick={signOut}
                className="flex h-9 w-full items-center justify-center rounded-md text-navy-3 transition-colors hover:bg-danger-soft hover:text-danger"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-sm font-bold text-navy-2">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-navy">{displayName}</p>
              <p className="truncate text-xs font-medium capitalize text-navy-3">{tenantInfo?.role ?? 'staff'}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md p-2 text-navy-3 transition-colors hover:bg-danger-soft hover:text-danger"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        {(() => {
          const toggleButton = (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold text-navy-3 transition-colors hover:bg-surface-hover hover:text-navy-2"
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-pressed={collapsed}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!collapsed && 'Recolher menu'}
            </button>
          );
          return collapsed ? (
            <Tooltip content="Expandir menu" side="right" className="mt-1 block w-full">
              {toggleButton}
            </Tooltip>
          ) : (
            <div className="mt-2">{toggleButton}</div>
          );
        })()}
      </div>
    </aside>
  );
}
