import { Copy, Download, Eye, MoreHorizontal, Plus, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Order } from '../types'
import { Dropdown, MenuItem, SectionCard, StatusChip, useToast } from './ui/primitives'

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')

export function RecentOrders({ orders }: { orders: Order[] }) {
  const [rows, setRows] = useState<Order[]>(orders)
  const notify = useToast()
  useEffect(() => setRows(orders), [orders])

  const markPaid = (id: string) => {
    setRows(list => list.map(o => (o.id === id ? { ...o, status: 'Paid' } : o)))
    notify(`${id} marked as paid`)
  }

  return (
    <SectionCard
      title="Recent sales orders"
      subtitle="Latest orders across all branches"
      className="h-full"
      bodyClassName="px-0 pb-2 pt-3"
      action={
        <button type="button" className="btn-secondary h-8" onClick={() => notify('New sales order form opens here')}>
          <Plus className="h-3.5 w-3.5" /> New order
        </button>
      }
    >
      <div className="hidden grid-cols-[minmax(0,2.2fr)_1.1fr_1fr_0.9fr_36px] gap-3 border-b border-line px-5 pb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint sm:grid">
        <span>Order</span>
        <span>Status</span>
        <span>Date</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {rows.map(o => (
          <li
            key={o.id}
            className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas/70 sm:grid-cols-[minmax(0,2.2fr)_1.1fr_1fr_0.9fr_36px]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[12px] font-semibold text-brand-700">
                {initials(o.customer)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">
                  {o.customer} <span className="font-normal text-ink-faint">· {o.id}</span>
                </p>
                <p className="truncate text-[12px] text-ink-muted">
                  {o.items}
                  <span className="sm:hidden"> · {o.amount} · {o.status}</span>
                </p>
              </div>
            </div>
            <div className="hidden sm:block">
              <StatusChip status={o.status} />
            </div>
            <p className="hidden text-[12.5px] text-ink-soft sm:block">{o.date}</p>
            <p className="hidden text-right text-[13px] font-medium tabular-nums sm:block">{o.amount}</p>
            <Dropdown
              align="right"
              panelClassName="w-[210px]"
              trigger={({ open, toggle }) => (
                <button type="button" aria-label={`Actions for ${o.id}`} aria-expanded={open} onClick={toggle} className="icon-btn h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              )}
            >
              {close => (
                <>
                  <MenuItem icon={<Eye className="h-4 w-4" />} onClick={() => { close(); notify(`Opening ${o.id}`) }}>View order</MenuItem>
                  {o.status === 'Awaiting payment' && (
                    <MenuItem icon={<Wallet className="h-4 w-4" />} onClick={() => { close(); markPaid(o.id) }}>Mark as paid</MenuItem>
                  )}
                  <MenuItem icon={<Download className="h-4 w-4" />} onClick={() => { close(); notify(`Invoice for ${o.id} downloaded`) }}>Download invoice</MenuItem>
                  <MenuItem icon={<Copy className="h-4 w-4" />} onClick={() => { close(); notify(`${o.id} duplicated as a draft`) }}>Duplicate</MenuItem>
                </>
              )}
            </Dropdown>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
