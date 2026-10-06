import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from './primitives'

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, description, children, footer, width = 'max-w-[520px]' }: ModalProps) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={e => e.stopPropagation()}
        className={cn('pop-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-pop sm:rounded-2xl', width)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn -mr-2 -mt-1 h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

export function Drawer({ open, onClose, label, children }: DrawerProps) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-ink/35" onMouseDown={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={e => e.stopPropagation()}
        className="drawer-in flex h-full w-full max-w-[760px] flex-col border-l border-line bg-white shadow-pop"
      >
        {children}
      </aside>
    </div>
  )
}
