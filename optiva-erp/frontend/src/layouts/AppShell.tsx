import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { CommandPalette } from '../components/CommandPalette'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'
import { cn, useToast } from '../components/ui/primitives'
import type { DashboardData, User } from '../types'

export interface ShellContext {
  user: User
  data: DashboardData | null
  error: string | null
  reload: () => void
  go: (id: string) => void
}

/** Pages that exist in the app. Every other sidebar entry shows a placeholder message. */
const ROUTES: Record<string, string> = { dashboard: '/app', vault: '/app/vault' }

export default function AppShell() {
  const notify = useToast()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const active = location.pathname.startsWith('/app/vault') ? 'vault' : 'dashboard'

  const load = useCallback(() => {
    setError(null)
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch(e => {
        if (e?.status === 401) logout()
        else setError(e?.message ?? 'Could not load the dashboard.')
      })
  }, [logout])

  useEffect(load, [load])

  /* ⌘K / Ctrl+K opens the command menu */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* lock page scroll while the mobile drawer is open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const go = useCallback(
    (id: string) => {
      const path = ROUTES[id]
      if (path) navigate(path)
      else notify('This module is outside the demo')
    },
    [navigate, notify],
  )

  if (!user) return null
  const context: ShellContext = { user, data, error, reload: load, go }

  return (
    <div className="min-h-screen">
      <Sidebar
        active={active}
        onNavigate={go}
        onLogout={logout}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[100px]' : 'md:pl-[280px]')}>
        <Topbar
          user={user}
          notifications={data?.notifications ?? []}
          onMenu={() => setMobileOpen(true)}
          onSearch={() => setPaletteOpen(true)}
          onLogout={logout}
        />
        <main className="mx-auto max-w-[1480px] px-4 pb-12 pt-6 sm:px-6">
          <Outlet context={context} />
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-[12px] text-ink-faint">
            <span>© 2026 Agentosys. Optiva ERP.</span>
            <span>All systems operational</span>
          </footer>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={go}
        notify={notify}
        orders={data?.orders ?? []}
        workflows={data?.workflows ?? []}
      />
    </div>
  )
}
