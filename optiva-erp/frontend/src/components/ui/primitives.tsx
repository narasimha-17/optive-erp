import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { OrderStatus, Tone } from '../../types'

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

/* ------------------------------ Dropdown ------------------------------ */
interface DropdownProps {
  trigger: (ctx: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  panelClassName?: string
  className?: string
}

export function Dropdown({ trigger, children, align = 'left', panelClassName, className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && (
        <div
          className={cn(
            'pop-in absolute top-full z-50 mt-2 min-w-[200px] rounded-xl border border-line bg-white p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
        danger ? 'text-coral-600 hover:bg-coral-50' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700',
        active && 'bg-brand-50 text-brand-700',
      )}
    >
      {icon && <span className="flex h-4 w-4 items-center justify-center">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  )
}

/* -------------------------------- Toast -------------------------------- */
interface ToastItem {
  id: number
  message: string
}
const ToastCtx = createContext<(message: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const push = useCallback((message: string) => {
    const id = ++idRef.current
    setItems(list => [...list.slice(-2), { id, message }])
    window.setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 px-4">
        {items.map(t => (
          <div
            key={t.id}
            role="status"
            className="pop-in pointer-events-auto flex items-center gap-2.5 rounded-lg bg-ink px-3.5 py-2.5 text-[13px] text-white shadow-pop"
          >
            <CheckCircle2 className="h-4 w-4 text-brand-300" />
            {t.message}
            <button
              type="button"
              aria-label="Dismiss"
              className="ml-1 text-white/60 hover:text-white"
              onClick={() => setItems(list => list.filter(x => x.id !== t.id))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ------------------------------ Card shell ------------------------------ */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('card flex flex-col', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={cn('flex-1 px-5 pb-5 pt-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ------------------------------ Status chips ------------------------------ */
type Status = OrderStatus | 'Running' | 'Paused' | (string & {})

const statusStyle: Record<string, { chip: string; dot: string }> = {
  Delivered: { chip: 'bg-ok-50 text-ok-600', dot: 'bg-ok-500' },
  Paid: { chip: 'bg-ok-50 text-ok-600', dot: 'bg-ok-500' },
  Running: { chip: 'bg-ok-50 text-ok-600', dot: 'bg-ok-500' },
  Approved: { chip: 'bg-ok-50 text-ok-600', dot: 'bg-ok-500' },
  Signed: { chip: 'bg-ok-50 text-ok-600', dot: 'bg-ok-500' },
  Processing: { chip: 'bg-brand-100 text-brand-700', dot: 'bg-brand-600' },
  'Awaiting signature': { chip: 'bg-brand-100 text-brand-700', dot: 'bg-brand-600' },
  'Awaiting payment': { chip: 'bg-warn-50 text-warn-600', dot: 'bg-warn-500' },
  'Pending approval': { chip: 'bg-warn-50 text-warn-600', dot: 'bg-warn-500' },
  Pending: { chip: 'bg-warn-50 text-warn-600', dot: 'bg-warn-500' },
  'On hold': { chip: 'bg-coral-50 text-coral-600', dot: 'bg-coral-500' },
  Paused: { chip: 'bg-coral-50 text-coral-600', dot: 'bg-coral-500' },
  Rejected: { chip: 'bg-coral-50 text-coral-600', dot: 'bg-coral-500' },
  Cancelled: { chip: 'bg-canvas text-ink-muted', dot: 'bg-ink-faint' },
  Superseded: { chip: 'bg-canvas text-ink-muted', dot: 'bg-ink-faint' },
  Draft: { chip: 'bg-canvas text-ink-soft', dot: 'bg-ink-faint' },
  Archived: { chip: 'bg-canvas text-ink-muted', dot: 'bg-ink-faint' },
}

export function StatusChip({ status }: { status: Status }) {
  const s = statusStyle[status] ?? statusStyle.Draft
  return (
    <span className={cn('chip whitespace-nowrap', s.chip)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {status}
    </span>
  )
}

export const toneStyle: Record<Tone, string> = {
  ok: 'bg-ok-50 text-ok-600',
  brand: 'bg-brand-100 text-brand-700',
  warn: 'bg-warn-50 text-warn-600',
  coral: 'bg-coral-50 text-coral-600',
  neutral: 'bg-canvas text-ink-soft',
}
