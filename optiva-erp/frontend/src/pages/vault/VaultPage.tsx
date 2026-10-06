import {
  Archive,
  ArchiveRestore,
  Clock,
  Download,
  Eye,
  FileClock,
  FolderOpen,
  HardDrive,
  Lock,
  MoreHorizontal,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
  ClipboardCheck,
  Files,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Dropdown, MenuItem, StatusChip, cn, useToast } from '../../components/ui/primitives'
import type { ShellContext } from '../../layouts/AppShell'
import { iconForType } from './docIcons'
import { DocumentDrawer } from './DocumentDrawer'
import { UploadDialog } from './UploadDialog'
import { ApprovalsTab, AuditTab, RetentionTab, SignaturesTab } from './VaultTabs'
import {
  DOC_STATUSES,
  DOC_TYPES,
  FOLDERS,
  downloadDocument,
  formatBytes,
  retentionLabel,
  timeAgo,
  vault,
  type DocSummary,
  type ListResponse,
  type Overview,
} from './vaultApi'

type Tab = 'documents' | 'approvals' | 'signatures' | 'retention' | 'audit'

const EXAMPLES = ['unsigned contracts', 'invoices above 1 lakh', 'pending approval', 'policies last 3 months', 'retention expiring']

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function VaultPage() {
  const notify = useToast()
  const { user } = useOutletContext<ShellContext>()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (['approvals', 'signatures', 'retention', 'audit'].includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'documents'))
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [docType, setDocType] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('relevance')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [list, setList] = useState<ListResponse | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(() => params.get('doc'))
  const [uploadOpen, setUploadOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const debounced = useDebounced(query, 250)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    vault.overview().then(setOverview).catch(() => setError('Could not load the Vault. Check that the server is running.'))
  }, [tick])

  useEffect(() => {
    let live = true
    setLoadingList(true)
    vault
      .list({ q: debounced, folder, type: docType, status: statusFilter, sort })
      .then(r => live && (setList(r), setError('')))
      .catch(() => live && setError('Could not load documents.'))
      .finally(() => live && setLoadingList(false))
    return () => {
      live = false
    }
  }, [debounced, folder, docType, statusFilter, sort, tick])

  const clearFilters = () => {
    setQuery('')
    setFolder('')
    setDocType('')
    setStatusFilter('')
    setSort('relevance')
  }
  const filtered = Boolean(query || folder || docType || statusFilter)

  const archive = async (d: DocSummary, archived: boolean) => {
    try {
      await vault.patch(d.id, { archived })
      notify(archived ? `${d.title} archived` : `${d.title} restored`)
      refresh()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update the document')
    }
  }

  const stats = [
    { id: 'total', icon: Files, label: 'Documents', value: overview?.total ?? '–', note: 'Active in the Vault', onClick: () => { clearFilters(); setTab('documents') } },
    { id: 'approvals', icon: ClipboardCheck, label: 'Awaiting your approval', value: overview?.pendingApprovals ?? '–', note: 'Assigned to you', onClick: () => setTab('approvals'), alert: (overview?.pendingApprovals ?? 0) > 0 },
    { id: 'sign', icon: PenLine, label: 'Awaiting your signature', value: overview?.awaitingSignature ?? '–', note: 'Needs e-signature', onClick: () => setTab('signatures'), alert: (overview?.awaitingSignature ?? 0) > 0 },
    { id: 'retention', icon: Clock, label: 'Retention ending', value: overview?.expiringSoon ?? '–', note: 'Within 90 days', onClick: () => setTab('retention') },
    { id: 'storage', icon: HardDrive, label: 'Storage used', value: overview ? formatBytes(overview.storageBytes) : '–', note: 'All versions', onClick: () => undefined },
  ]

  const tabs: { id: Tab; label: string; icon: typeof Files; count?: number }[] = [
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'approvals', label: 'Approvals', icon: ClipboardCheck, count: overview?.pendingApprovals },
    { id: 'signatures', label: 'E-signatures', icon: PenLine, count: overview?.awaitingSignature },
    { id: 'retention', label: 'Retention', icon: ShieldCheck },
    { id: 'audit', label: 'Audit trail', icon: FileClock },
  ]

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-ink-muted">Optiva Vault</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[28px]">Document management</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Store, classify, approve and sign company documents with a full audit trail, {user.name.split(' ')[0]}.
          </p>
        </div>
        <button type="button" className="btn-primary h-10" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload documents
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-coral-100 bg-coral-50 px-4 py-3 text-[13px] text-coral-600">
          {error}
          <button type="button" className="btn-secondary h-8" onClick={refresh}>Try again</button>
        </div>
      )}

      <section aria-label="Vault summary" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={s.onClick}
              className={cn(
                'card group flex flex-col p-4 text-left transition-shadow hover:shadow-pop',
                i === stats.length - 1 && 'col-span-2 md:col-span-1',
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', s.alert ? 'bg-coral-50 text-coral-600' : 'bg-brand-50 text-brand-600')}>
                  <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
                </span>
                <span className="text-[13px] font-medium text-ink-soft">{s.label}</span>
              </span>
              <span className="mt-3 text-[26px] font-semibold leading-none tracking-tight">{s.value}</span>
              <span className="mt-2 text-[12px] text-ink-muted">{s.note}</span>
            </button>
          )
        })}
      </section>

      <nav aria-label="Vault sections" className="scroll-thin mt-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
        {tabs.map(t => {
          const Icon = t.icon
          const on = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 px-3.5 pb-3 pt-2 text-[13.5px] font-medium transition-colors',
                on ? 'text-brand-700' : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.9} />
              {t.label}
              {!!t.count && <span className="rounded-full bg-coral-500 px-1.5 text-[10.5px] font-semibold leading-[18px] text-white">{t.count}</span>}
              {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          )
        })}
      </nav>

      {tab === 'documents' && (
        <div className="mt-5">
          {/* smart search */}
          <div className="card p-3 sm:p-4">
            <label className="flex h-12 items-center gap-3 rounded-lg border border-line bg-canvas px-3.5 transition-colors focus-within:border-brand-300 focus-within:bg-white">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Search or ask, e.g. "unsigned contracts from last month"'
                aria-label="Search documents"
                className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint focus-visible:ring-0"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-ink-faint hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
              <Search className="h-4 w-4 shrink-0 text-ink-faint" />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
              {list && list.interpreted.length > 0 ? (
                <>
                  <span className="font-medium text-ink-muted">Understood as</span>
                  {list.interpreted.map(c => (
                    <span key={c.kind + c.label} className="chip bg-brand-50 text-brand-700">{c.label}</span>
                  ))}
                  {list.terms.length > 0 && <span className="text-ink-muted">containing “{list.terms.join(' ')}”</span>}
                </>
              ) : (
                <>
                  <span className="font-medium text-ink-muted">Try</span>
                  {EXAMPLES.map(ex => (
                    <button key={ex} type="button" onClick={() => setQuery(ex)} className="chip bg-canvas text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700">
                      {ex}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* folders + filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFolder('')}
              className={cn('chip px-3 py-1.5 text-[12.5px] transition-colors', !folder ? 'bg-brand-600 text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:ring-brand-200')}
            >
              All folders
            </button>
            {FOLDERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFolder(folder === f ? '' : f)}
                className={cn('chip px-3 py-1.5 text-[12.5px] transition-colors', folder === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:ring-brand-200')}
              >
                {f}
                <span className={cn('tabular-nums', folder === f ? 'text-white/80' : 'text-ink-faint')}>{overview?.folders[f] ?? 0}</span>
              </button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <select aria-label="Document type" value={docType} onChange={e => setDocType(e.target.value)} className="field-select">
                <option value="">All types</option>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select aria-label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field-select">
                <option value="">All statuses</option>
                {DOC_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} className="field-select">
                <option value="relevance">Best match</option>
                <option value="updated">Recently updated</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>
            </div>
          </div>

          {/* results */}
          <section className="card mt-3 overflow-hidden" aria-busy={loadingList}>
            <div className="hidden grid-cols-[minmax(0,2.6fr)_1.15fr_1fr_1fr_1fr_36px] gap-3 border-b border-line px-5 py-2.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint lg:grid">
              <span>Document</span>
              <span>Status</span>
              <span>Folder</span>
              <span>Updated</span>
              <span>Retention</span>
              <span />
            </div>

            {!list && loadingList && <div className="px-5 py-16 text-center text-[13px] text-ink-muted">Loading documents…</div>}

            {list && list.results.length === 0 && (
              <div className="px-5 py-16 text-center">
                <p className="text-[14px] font-medium">No documents match</p>
                <p className="mt-1 text-[13px] text-ink-muted">Try a different search, or clear the filters.</p>
                {filtered && <button type="button" className="btn-secondary mt-4 h-8" onClick={clearFilters}>Clear filters</button>}
              </div>
            )}

            <ul className={cn('divide-y divide-line', loadingList && list && 'opacity-60 transition-opacity')}>
              {list?.results.map(d => {
                const Icon = iconForType(d.docType)
                const ret = retentionLabel(d.daysToRetention)
                return (
                  <li key={d.id} className="group relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(d.id)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(d.id))}
                      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_36px] items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas/70 sm:px-5 lg:grid-cols-[minmax(0,2.6fr)_1.15fr_1fr_1fr_1fr_36px]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
                            <span className="truncate">{d.title}</span>
                            {d.visibility === 'Private' && <Lock className="h-3 w-3 shrink-0 text-ink-faint" aria-label="Private" />}
                            {d.legalHold && <span className="chip bg-coral-50 px-1.5 py-0 text-[10.5px] text-coral-600">Legal hold</span>}
                          </p>
                          <p className="truncate text-[12px] text-ink-muted">
                            {d.docType} · v{d.version} · {formatBytes(d.size)} · {d.owner.name}
                            <span className="lg:hidden"> · {timeAgo(d.updatedAt)}</span>
                          </p>
                          {d.snippet && <p className="mt-0.5 truncate text-[12px] text-ink-faint">{d.snippet}</p>}
                          <p className="mt-1 flex flex-wrap gap-1 lg:hidden"><StatusChip status={d.status} /></p>
                        </div>
                      </div>
                      <div className="hidden lg:block"><StatusChip status={d.status} /></div>
                      <p className="hidden text-[12.5px] text-ink-soft lg:block">{d.folder}</p>
                      <p className="hidden text-[12.5px] text-ink-soft lg:block">{timeAgo(d.updatedAt)}</p>
                      <p className={cn('hidden text-[12.5px] lg:block', ret.tone === 'coral' ? 'font-medium text-coral-600' : ret.tone === 'warn' ? 'font-medium text-warn-600' : 'text-ink-soft')}>
                        {ret.text}
                      </p>
                      <span onClick={e => e.stopPropagation()}>
                        <Dropdown
                          align="right"
                          panelClassName="w-[200px]"
                          trigger={({ open, toggle }) => (
                            <button type="button" aria-label={`Actions for ${d.title}`} aria-expanded={open} onClick={toggle} className="icon-btn h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                        >
                          {close => (
                            <>
                              <MenuItem icon={<Eye className="h-4 w-4" />} onClick={() => { close(); setSelected(d.id) }}>Open details</MenuItem>
                              <MenuItem icon={<Download className="h-4 w-4" />} onClick={() => { close(); downloadDocument(d.id, d.filename).catch(() => notify('Download failed')) }}>Download</MenuItem>
                              {d.archived ? (
                                <MenuItem icon={<ArchiveRestore className="h-4 w-4" />} onClick={() => { close(); archive(d, false) }}>Restore from archive</MenuItem>
                              ) : (
                                <MenuItem icon={<Archive className="h-4 w-4" />} onClick={() => { close(); archive(d, true) }}>Archive</MenuItem>
                              )}
                            </>
                          )}
                        </Dropdown>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
            {list && list.results.length > 0 && (
              <footer className="flex items-center justify-between border-t border-line bg-canvas px-5 py-2.5 text-[12px] text-ink-muted">
                <span>{list.total} document{list.total === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Showing only what you have access to</span>
              </footer>
            )}
          </section>
        </div>
      )}

      {tab === 'approvals' && <ApprovalsTab onOpen={setSelected} onChanged={refresh} tick={tick} />}
      {tab === 'signatures' && <SignaturesTab onOpen={setSelected} onChanged={refresh} tick={tick} />}
      {tab === 'retention' && <RetentionTab onOpen={setSelected} tick={tick} />}
      {tab === 'audit' && <AuditTab onOpen={setSelected} tick={tick} />}

      <DocumentDrawer docId={selected} onClose={() => setSelected(null)} onChanged={refresh} />
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={refresh} onOpenDoc={id => { setUploadOpen(false); setSelected(id) }} />
    </>
  )
}
