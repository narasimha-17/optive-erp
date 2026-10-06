import {
  ClipboardList,
  File,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Receipt,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

export const typeIcon: Record<string, LucideIcon> = {
  Invoice: Receipt,
  Contract: FileSignature,
  NDA: ShieldCheck,
  'Purchase Order': ShoppingCart,
  'HR Document': UserRound,
  Policy: ScrollText,
  'Financial Report': FileSpreadsheet,
  'Meeting Minutes': ClipboardList,
  Proposal: FileText,
  Other: File,
}

export const iconForType = (type: string): LucideIcon => typeIcon[type] ?? File
