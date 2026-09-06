import {
  Activity,
  BookOpen,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Headset,
  Home,
  Layers,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  /**
   * Página estática servida fora do SPA (hoje só `/biblioteca`). Precisa de uma
   * navegação de verdade: um `NavLink` faria o router procurar a rota dentro do
   * React, não achar e cair no catch-all, sem nunca pedir o arquivo ao servidor.
   */
  external?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Fonte única de verdade da navegação da equipe: docs/HANDOFF-FRONTEND.md § FE-06.
 * Sidebar (desktop) e o drawer "Mais" do BottomNav (mobile) consomem os mesmos
 * grupos, na mesma ordem — antes cada um mantinha a própria lista à mão e elas
 * divergiam (Roteiros, Biblioteca e Solicitações não apareciam no celular).
 * O item "Painel" existiu aqui até o FE-14, quando `/painel` foi absorvido por `/`.
 */
export const STAFF_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { to: '/', icon: Home, label: 'Início' },
      { to: '/clients', icon: Users, label: 'Clientes' },
      { to: '/schedules', icon: Calendar, label: 'Agendamentos' },
      { to: '/inspections', icon: ClipboardCheck, label: 'Inspeções' },
      { to: '/requests', icon: Headset, label: 'Solicitações' },
      { to: '/plano-de-acao', icon: ClipboardList, label: 'Plano de ação' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { to: '/templates', icon: FileText, label: 'Roteiros' },
      { to: '/legislations', icon: BookOpen, label: 'Biblioteca' },
      { to: '/biblioteca/', icon: Layers, label: 'Revestimentos', external: true },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/sync', icon: Activity, label: 'Sincronização' },
      { to: '/settings', icon: Settings, label: 'Configurações' },
    ],
  },
];

export const STAFF_NAV_ITEMS: NavItem[] = STAFF_NAV_GROUPS.flatMap((group) => group.items);

/** Conta com papel `client` no app principal (não é o Portal do Cliente, que nem usa Sidebar/BottomNav). */
export const CLIENT_NAV_ITEMS: NavItem[] = [
  { to: '/inspections', icon: ClipboardCheck, label: 'Minhas inspeções' },
];
