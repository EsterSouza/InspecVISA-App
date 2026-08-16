import {
  Activity,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  Gauge,
  Headset,
  Home,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Fonte única de verdade da navegação da equipe: docs/HANDOFF-FRONTEND.md § FE-06.
 * Sidebar (desktop) e o drawer "Mais" do BottomNav (mobile) consomem os mesmos
 * grupos, na mesma ordem — antes cada um mantinha a própria lista à mão e elas
 * divergiam (Painel, Roteiros, Biblioteca e Solicitações não apareciam no celular).
 */
export const STAFF_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { to: '/', icon: Home, label: 'Início' },
      { to: '/painel', icon: Gauge, label: 'Painel' },
      { to: '/clients', icon: Users, label: 'Clientes' },
      { to: '/schedules', icon: Calendar, label: 'Agendamentos' },
      { to: '/inspections', icon: ClipboardCheck, label: 'Inspeções' },
      { to: '/requests', icon: Headset, label: 'Solicitações' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { to: '/templates', icon: FileText, label: 'Roteiros' },
      { to: '/legislations', icon: BookOpen, label: 'Biblioteca' },
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
