import { CornerDownLeft, FilePlus2, Search, UserPlus, Workflow as WorkflowIcon, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { footerNav, navGroups } from '../data/nav'
import type { Order, Workflow } from '../types'
import { cn } from './ui/primitives'
import type { LucideIcon } from 'lucide-react'

interface Command {
  id: string
  group: 'Actions' | 'Orders' | 'Workflows' | 'Pages'
  label: string
  hint?: string
  icon: LucideIcon
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
  notify: (message: string) => void
  orders: Order[]
  workflows: Workflow[]
}

export function CommandPalette({ open, onClose, onNavigate, notify, orders, workflows }: Props) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const commands = useMemo<Command[]>(() => {
    const pages = [...navGroups.flatMap(g => g.items), ...footerNav].map<Command>(i => ({
      id: `page-${i.id}`,
      group: 'Pages',
      label: i.label,
      icon: i.icon,
      run: () => onNavigate(i.id),
    }))
    return [
      { id: 'a1', group: 'Actions', label: 'New sales order', hint: 'Sales & CRM', icon: ShoppingCart, run: () => notify('New sales order form opens here') },
      { id: 'a2', group: 'Actions', label: 'New invoice', hint: 'Finance & Accounting', icon: FilePlus2, run: () => notify('New invoice form opens here') },
      { id: 'a3', group: 'Actions', label: 'Add customer', hint: 'Sales & CRM', icon: UserPlus, run: () => notify('New customer form opens here') },
      ...orders.map<Command>(o => ({ id: `order-${o.id}`, group: 'Orders', label: `${o.id} · ${o.customer}`, hint: o.amount, icon: ShoppingCart, run: () => notify(`Opening ${o.id}`) })),
      ...workflows.map<Command>(w => ({ id: `wf-${w.id}`, group: 'Workflows', label: w.name, hint: w.status, icon: WorkflowIcon, run: () => onNavigate('automations') })),
      ...pages,
    ]
  }, [onNavigate, notify, orders, workflows])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? commands.filter(c => `${c.label} ${c.hint ?? ''} ${c.group}`.toLowerCase().includes(q)) : commands.slice(0, 12)
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  const choose = (c?: Command) => {
    if (!c) return
    onClose()
    c.run()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(results.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[index]) }
    else if (e.key === 'Escape') onClose()
  }

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/40 px-4 pt-[12vh]" onMouseDown={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="pop-in w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search customers, orders, invoices..."
            className="h-14 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-faint focus-visible:ring-0"
          />
          <kbd className="rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-ink-muted">Esc</kbd>
        </div>

        <ul ref={listRef} className="scroll-thin max-h-[360px] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-10 text-center text-[13px] text-ink-muted">No results for “{query}”</li>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup
            lastGroup = c.group
            const Icon = c.icon
            return (
              <li key={c.id} role="presentation">
                {header && <p className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">{c.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  data-i={i}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(c)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px]', i === index ? 'bg-brand-50 text-brand-700' : 'text-ink-soft')}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="flex-1 truncate font-medium">{c.label}</span>
                  {c.hint && <span className="text-[12px] text-ink-faint">{c.hint}</span>}
                  {i === index && <CornerDownLeft className="h-3.5 w-3.5" />}
                </button>
              </li>
            )
          })}
        </ul>

        <footer className="flex items-center gap-4 border-t border-line bg-canvas px-4 py-2 text-[11.5px] text-ink-muted">
          <span><kbd className="font-medium">↑↓</kbd> navigate</span>
          <span><kbd className="font-medium">↵</kbd> select</span>
          <span className="ml-auto">Optiva ERP command menu</span>
        </footer>
      </div>
    </div>
  )
}
