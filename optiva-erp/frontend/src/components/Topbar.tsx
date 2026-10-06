import { Bell, BookOpen, Building2, ChevronDown, CircleHelp, Keyboard, LogOut, Menu, Search, Settings, UserRound } from 'lucide-react'
import type { Notice, User } from '../types'
import { Dropdown, MenuItem, cn, useToast } from './ui/primitives'

interface TopbarProps {
  user: User
  notifications: Notice[]
  onMenu: () => void
  onSearch: () => void
  onLogout: () => void
}

const branches = ['All branches', 'Head office', 'West region', 'South region']

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('')

export function Topbar({ user, notifications, onMenu, onSearch, onLogout }: TopbarProps) {
  const notify = useToast()
  const unread = notifications.filter(n => n.unread).length

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <button type="button" aria-label="Open menu" onClick={onMenu} className="icon-btn -ml-2 md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onSearch}
        className="group flex h-10 w-full max-w-[460px] flex-1 items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 text-left text-[13px] text-ink-faint transition-colors hover:border-brand-200 hover:bg-white"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">
          <span className="sm:hidden">Search...</span>
          <span className="hidden sm:inline">Search customers, orders, invoices...</span>
        </span>
        <kbd className="hidden rounded border border-line-strong bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-muted sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <Dropdown
          className="hidden lg:block"
          trigger={({ open, toggle }) => (
            <button type="button" onClick={toggle} aria-expanded={open} className="btn-secondary h-9">
              <Building2 className="h-4 w-4 text-ink-muted" />
              All branches
              <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
            </button>
          )}
        >
          {close => (
            <>
              {branches.map((b, i) => (
                <MenuItem
                  key={b}
                  active={i === 0}
                  onClick={() => {
                    close()
                    if (i !== 0) notify(`Showing data for ${b}`)
                  }}
                >
                  {b}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>

        <Dropdown
          align="right"
          panelClassName="w-[320px] max-w-[calc(100vw-2rem)] p-0"
          trigger={({ open, toggle }) => (
            <button type="button" aria-label="Notifications" aria-expanded={open} onClick={toggle} className="icon-btn relative">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white" />}
            </button>
          )}
        >
          {close => (
            <div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-[13px] font-semibold">Notifications</p>
                <button
                  type="button"
                  className="text-[12px] font-medium text-brand-600 hover:underline"
                  onClick={() => {
                    close()
                    notify('All notifications marked as read')
                  }}
                >
                  Mark all read
                </button>
              </div>
              <ul className="max-h-[320px] overflow-y-auto py-1">
                {notifications.map(n => (
                  <li key={n.id}>
                    <button type="button" onClick={close} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-50">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.unread ? 'bg-brand-600' : 'bg-line-strong')} />
                      <span>
                        <span className="block text-[13px] leading-snug">{n.title}</span>
                        <span className="text-[11.5px] text-ink-muted">{n.time}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Dropdown>

        <Dropdown
          align="right"
          className="hidden sm:block"
          trigger={({ open, toggle }) => (
            <button type="button" aria-label="Help" aria-expanded={open} onClick={toggle} className="icon-btn">
              <CircleHelp className="h-[18px] w-[18px]" />
            </button>
          )}
        >
          {close => (
            <>
              <MenuItem icon={<BookOpen className="h-4 w-4" />} onClick={close}>Documentation</MenuItem>
              <MenuItem icon={<Keyboard className="h-4 w-4" />} onClick={close}>Keyboard shortcuts</MenuItem>
              <MenuItem icon={<CircleHelp className="h-4 w-4" />} onClick={close}>Contact support</MenuItem>
            </>
          )}
        </Dropdown>

        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />

        <Dropdown
          align="right"
          panelClassName="w-[250px]"
          trigger={({ open, toggle }) => (
            <button type="button" onClick={toggle} aria-expanded={open} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-brand-50 sm:pr-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">{initials(user.name)}</span>
              <span className="hidden text-left leading-tight xl:block">
                <span className="block text-[13px] font-medium">{user.name}</span>
                <span className="block text-[11.5px] text-ink-muted">{user.role}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-ink-faint xl:block" />
            </button>
          )}
        >
          {close => (
            <>
              <div className="border-b border-line px-2.5 pb-2.5 pt-1.5">
                <p className="text-[13px] font-medium">{user.name}</p>
                <p className="truncate text-[12px] text-ink-muted">{user.role} · {user.email}</p>
                <p className="text-[12px] text-ink-muted">{user.company}</p>
              </div>
              <div className="pt-1.5">
                <MenuItem icon={<UserRound className="h-4 w-4" />} onClick={close}>Profile</MenuItem>
                <MenuItem icon={<Settings className="h-4 w-4" />} onClick={close}>Preferences</MenuItem>
                <MenuItem icon={<LogOut className="h-4 w-4" />} danger onClick={() => { close(); onLogout() }}>Log out</MenuItem>
              </div>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  )
}
