import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp, LogOut, X, Zap } from 'lucide-react'
import { footerNav, navGroups, type NavItem } from '../data/nav'
import { Dropdown, MenuItem, cn, useToast } from './ui/primitives'

export function Logo({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <img src="/mark.png" alt="Optiva ERP" className="h-9 w-9 object-contain" />
  ) : (
    <img src="/logo.png" alt="Optiva ERP" className="h-[38px] w-auto object-contain" />
  )
}

interface SidebarProps {
  onLogout: () => void
  active: string
  onNavigate: (id: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onClose: () => void
}

const workspaces = [
  { id: 'acme', name: 'Acme Corporation', plan: 'Head office' },
  { id: 'acme-west', name: 'Acme West Region', plan: 'Branch' },
  { id: 'acme-south', name: 'Acme South Region', plan: 'Branch' },
]

export function Sidebar({ onLogout, active, onNavigate, collapsed, onToggleCollapsed, mobileOpen, onClose }: SidebarProps) {
  const notify = useToast()
  const [planOpen, setPlanOpen] = useState(() => {
    try {
      return localStorage.getItem('optiva_plan_card') !== 'closed'
    } catch {
      return true
    }
  })
  const [accountOpen, setAccountOpen] = useState(() => {
    try {
      return localStorage.getItem('optiva_account_section') !== 'closed'
    } catch {
      return true
    }
  })
  const toggleAccount = () => {
    const next = !accountOpen
    setAccountOpen(next)
    try {
      localStorage.setItem('optiva_account_section', next ? 'open' : 'closed')
    } catch {
      /* storage unavailable */
    }
  }
  const setPlan = (open: boolean) => {
    setPlanOpen(open)
    try {
      localStorage.setItem('optiva_plan_card', open ? 'open' : 'closed')
    } catch {
      /* storage unavailable */
    }
  }
  /* labels are always shown in the mobile drawer; on md+ they follow `collapsed` */
  const hideWhenSlim = collapsed ? 'md:hidden' : ''
  const centerWhenSlim = collapsed ? 'md:justify-center md:px-0' : ''

  const renderItem = (item: NavItem) => {
    const isActive = item.id === active
    const Icon = item.icon
    return (
      <li key={item.id}>
        <button
          type="button"
          title={item.label}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => {
            onNavigate(item.id)
            onClose()
          }}
          className={cn(
            'group relative flex w-full items-center gap-3.5 rounded-xl px-3 py-[9px] text-[13.5px] font-semibold transition-colors',
            centerWhenSlim,
            isActive ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-canvas',
          )}
        >
          <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-brand-600' : 'text-ink')} strokeWidth={1.6} />
          <span className={cn('flex-1 truncate text-left', hideWhenSlim)}>{item.label}</span>
          {item.badge && (
            <span className={cn('rounded-full bg-coral-500 px-1.5 text-[10.5px] font-semibold leading-[18px] text-white', hideWhenSlim)}>
              {item.badge}
            </span>
          )}
          {item.badge && collapsed && <span className="absolute right-3 top-2 hidden h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white md:block" />}
        </button>
      </li>
    )
  }

  const label = (text: string) => (
    <p className={cn('mb-1 px-3 text-[12px] font-medium text-ink-faint', hideWhenSlim)}>{text}</p>
  )

  return (
    <>
      {/* mobile overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-ink/40 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        aria-label="Primary"
        className={cn(
          'fixed bottom-0 left-0 top-0 z-40 flex w-[284px] flex-col rounded-r-[22px] border border-line bg-white shadow-pop transition-[transform,width] duration-200',
          'md:bottom-3 md:left-3 md:top-3 md:translate-x-0 md:rounded-[22px] md:shadow-card',
          collapsed ? 'md:w-[76px]' : 'md:w-[256px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* collapse / expand toggle sits on the panel edge */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[22px] z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 md:flex"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        <div className={cn('flex h-[68px] shrink-0 items-center justify-between border-b border-line px-5', collapsed && 'md:justify-center md:px-0')}>
          <span className={hideWhenSlim}>
            <Logo />
          </span>
          {collapsed && (
            <span className="hidden md:block">
              <Logo compact />
            </span>
          )}
          <button type="button" aria-label="Close menu" onClick={onClose} className="icon-btn md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={cn('shrink-0 px-3 pb-2 pt-3', hideWhenSlim)}>
          <Dropdown
            className="w-full"
            panelClassName="w-[236px]"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-canvas px-2.5 py-2 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-semibold text-white">AC</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight">Acme Corporation</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">Head office</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            )}
          >
            {close => (
              <>
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">Companies</p>
                {workspaces.map((w, i) => (
                  <MenuItem
                    key={w.id}
                    active={i === 0}
                    onClick={() => {
                      close()
                      if (i !== 0) notify(`Switched to ${w.name}`)
                    }}
                    icon={i === 0 ? <Check className="h-4 w-4" /> : undefined}
                  >
                    <span className="block leading-tight">{w.name}</span>
                    <span className="block text-[11.5px] text-ink-muted">{w.plan}</span>
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
        </div>

        <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2">
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && 'mt-4')}>
              {label(group.title)}
              {collapsed && gi > 0 && <div className="mx-3 mb-2 hidden border-t border-line md:block" />}
              <ul className="space-y-0.5">{group.items.map(renderItem)}</ul>
            </div>
          ))}
        </nav>

        <div className={cn('shrink-0 border-t border-line px-3 pt-2', accountOpen ? 'pb-3' : 'pb-2', collapsed && 'md:pb-3 md:pt-3')}>
          <button
            type="button"
            onClick={toggleAccount}
            aria-expanded={accountOpen}
            aria-label={accountOpen ? 'Minimize account section' : 'Expand account section'}
            className={cn(
              'group flex w-full items-center justify-between rounded-lg px-3 py-1 text-[12px] font-medium text-ink-faint transition-colors hover:bg-canvas hover:text-ink',
              collapsed && 'md:hidden',
            )}
          >
            Account
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', !accountOpen && 'rotate-180')} />
          </button>
          <div className={cn('mt-1', !accountOpen && (collapsed ? 'hidden md:block' : 'hidden'))}>
          <ul className="space-y-0.5">
            {footerNav.map(renderItem)}
            <li>
              <button
                type="button"
                title="Log out"
                onClick={() => {
                  onClose()
                  onLogout()
                }}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-xl px-3 py-[9px] text-[13.5px] font-semibold text-ink transition-colors hover:bg-coral-50 hover:text-coral-600',
                  centerWhenSlim,
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                <span className={cn('flex-1 truncate text-left', hideWhenSlim)}>Log out</span>
              </button>
            </li>
          </ul>

          {/* plan card */}
          {collapsed && (
            <button
              type="button"
              title="Enterprise plan"
              onClick={() => notify('Enterprise plan · 312 of 400 user seats in use')}
              className="mx-auto mt-3 hidden h-12 w-12 items-center justify-center rounded-2xl text-white transition-transform hover:scale-105 md:flex"
              style={{ background: 'linear-gradient(160deg,#9d89ee 0%,#5b43c9 55%,#2b2063 100%)' }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60">
                <Zap className="h-4 w-4 fill-white" />
              </span>
            </button>
          )}
          {!planOpen && (
            <button
              type="button"
              onClick={() => setPlan(true)}
              className={cn(
                'mt-3 flex w-full items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[13px] font-semibold transition-colors hover:border-brand-200 hover:bg-brand-50',
                collapsed && 'md:hidden',
              )}
            >
              <Zap className="h-4 w-4 fill-brand-600 text-brand-600" />
              <span className="flex-1">Enterprise plan</span>
              <ChevronUp className="h-4 w-4 text-ink-faint" />
            </button>
          )}
          <div
            className={cn('relative mt-3 overflow-hidden rounded-2xl p-3.5 text-white', (collapsed || !planOpen) && 'md:hidden', !planOpen && 'hidden')}
            style={{ background: 'linear-gradient(160deg,#9d89ee 0%,#5b43c9 52%,#2b2063 100%)' }}
          >
            <span aria-hidden="true" className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
            <button
              type="button"
              aria-label="Close plan card"
              onClick={() => setPlan(false)}
              className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="relative flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60">
                <Zap className="h-[18px] w-[18px] fill-white" />
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold">Current plan :</p>
                <p className="text-[17px] font-semibold tracking-tight">Enterprise</p>
              </div>
            </div>
            <p className="relative mt-2.5 text-[12px] font-medium leading-snug text-white/90">
              312 of 400 user seats in use. Upgrade to add seats and advanced modules.
            </p>
            <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full w-4/5 rounded-full bg-white" />
            </div>
            <button
              type="button"
              onClick={() => notify('Plan management opens in billing settings')}
              className="relative mt-3 h-9 w-full rounded-full bg-white text-[13px] font-semibold text-ink transition-colors hover:bg-brand-50"
            >
              Manage plan
            </button>
          </div>
          </div>
        </div>
      </aside>
    </>
  )
}
