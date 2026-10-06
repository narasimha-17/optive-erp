import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileText,
  Headset,
  IndianRupee,
  LineChart,
  type LucideIcon,
  PackageSearch,
  Plug,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  FolderKanban,
  Landmark,
  Handshake,
  UserRound,
  Store,
} from 'lucide-react'

/** Icon names sent by the API -> Lucide icons. */
export const iconMap: Record<string, LucideIcon> = {
  // KPIs
  revenue: IndianRupee,
  orders: ShoppingCart,
  receivables: Receipt,
  inventory: Boxes,
  fulfilment: Truck,
  // activity feed
  paid: CheckCircle2,
  approval: ClipboardCheck,
  stock: PackageSearch,
  payroll: Wallet,
  report: FileText,
  support: Headset,
  alert: AlertTriangle,
  // modules
  finance: Landmark,
  sales: Handshake,
  procurement: Store,
  people: UserRound,
  // add-on modules
  factory: Factory,
  projects: FolderKanban,
  analytics: LineChart,
  commerce: Plug,
  users: Users,
}

export const iconFor = (key: string): LucideIcon => iconMap[key] ?? FileText
