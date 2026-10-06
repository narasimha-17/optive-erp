import {
  BarChart3,
  ClipboardCheck,
  Cog,
  FileClock,
  FileText,
  Handshake,
  Headset,
  Boxes,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Plug,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  Vault,
  Workflow,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'Menu',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'vault', label: 'Vault', icon: Vault },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    title: 'Business',
    items: [
      { id: 'finance', label: 'Finance & Accounting', icon: Landmark },
      { id: 'sales', label: 'Sales & CRM', icon: Handshake },
      { id: 'procurement', label: 'Procurement', icon: Store },
      { id: 'inventory', label: 'Inventory', icon: Boxes },
      { id: 'people', label: 'Human Resources', icon: UserRound },
      { id: 'operations', label: 'Operations', icon: Cog },
      { id: 'service', label: 'Customer Service', icon: Headset },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { id: 'approvals', label: 'Approvals', icon: ClipboardCheck, badge: '3' },
      { id: 'automations', label: 'Automations', icon: Workflow },
    ],
  },
  {
    title: 'Administration',
    items: [
      { id: 'roles', label: 'Users & Roles', icon: ShieldCheck },
      { id: 'audit', label: 'Audit Log', icon: FileClock },
      { id: 'integrations', label: 'Integrations', icon: Plug },
    ],
  },
]

export const footerNav: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help & Support', icon: LifeBuoy },
]
