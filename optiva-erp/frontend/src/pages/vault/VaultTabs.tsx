import { Download as DownloadIcon, FileClock, Lock, PenLine, ShieldAlert, ShieldCheck, Scale } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { StatusChip, cn, useToast } from '../../components/ui/primitives'
import type { ShellContext } from '../../layouts/AppShell'
import { iconForType } from './docIcons'
import { SignDialog } from './SignDialog'
import {
  formatDate,
  formatDateTime,
  retentionLabel,
  timeAgo,
  vault,
  type ApprovalItem,
  type AuditEntry,
  type RetentionData,
  type SignatureItem,
} from './vaultApi'

interface TabProps {
  onOpen: (id: string) => void
  tick: number
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      <p className="mt-1 text-[13px] text-ink-muted">{text}</p>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-line px-5 py-3.5">
        <h2 className="text-[14.5px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-[12.5px] text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Row({ type, title, onOpen, children, meta }: { type: string; title: string; onOpen: () => void; children?: ReactNode; meta: ReactNode }) {
  const Icon = iconForType(type)
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas/70">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-[17px] w-[17px]" strokeWidth={1.8} /></span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block max-w-full truncate text-left text-[13.5px] font-medium hover:text-brand-700 hover:underline">{title}</button>
        <p className="truncate text-[12px] text-ink-muted">{meta}</p>
      </div>
      {children}
    </li>
  )
}

/* ---------------------------------------------------------------- approvals */
export function ApprovalsTab({ onOpen, onChanged, tick }: TabProps & { onChanged: () => void }) {
  const [data, setData] = useState<{ assigned: ApprovalItem[]; requested: ApprovalItem[] } | null>(null)
  useEffect(() => { vault.approvals().then(setData).catch(() => setData({ assigned: [], requested: [] })) }, [tick])
  void onChanged

  if (!data) return <p className="mt-6 text-[13px] text-ink-muted">Loading approvals…</p>
  const pending = data.assigned.filter(a => a.status === 'Pending')
  const decided = data.assigned.filter(a => a.status !== 'Pending')

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Panel title="Waiting for your decision" subtitle="Open a document to approve or reject it">
        {pending.length === 0 ? <Empty title="You’re all caught up" text="Nothing is waiting for your approval." /> : (
          <ul className="divide-y divide-line">
            {pending.map(a => (
              <Row key={a.id} type={a.docType} title={a.docTitle} onOpen={() => onOpen(a.docId)} meta={<>Requested by {a.requestedBy} · {timeAgo(a.createdAt)}{a.requestNote ? ` · “${a.requestNote}”` : ''}</>}>
                <button type="button" className="btn-primary h-8" onClick={() => onOpen(a.docId)}>Review</button>
              </Row>
            ))}
          </ul>
        )}
        {decided.length > 0 && (
          <>
            <p className="border-t border-line bg-canvas px-5 py-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">Decided by you</p>
            <ul className="divide-y divide-line">
              {decided.map(a => (
                <Row key={a.id} type={a.docType} title={a.docTitle} onOpen={() => onOpen(a.docId)} meta={<>From {a.requestedBy} · {a.decidedAt ? timeAgo(a.decidedAt) : ''}{a.comment ? ` · “${a.comment}”` : ''}</>}>
                  <StatusChip status={a.status} />
                </Row>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Requested by you" subtitle="Documents you sent for approval">
        {data.requested.length === 0 ? <Empty title="No requests yet" text="Open a document and choose “Request approval”." /> : (
          <ul className="divide-y divide-line">
            {data.requested.map(a => (
              <Row key={a.id} type={a.docType} title={a.docTitle} onOpen={() => onOpen(a.docId)} meta={<>Approver {a.approver} · {timeAgo(a.createdAt)}{a.comment ? ` · “${a.comment}”` : ''}</>}>
                <StatusChip status={a.status} />
              </Row>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/* -------------------------------------------------------------- signatures */
export function SignaturesTab({ onOpen, onChanged, tick }: TabProps & { onChanged: () => void }) {
  const notify = useToast()
  const { user } = useOutletContext<ShellContext>()
  const [data, setData] = useState<{ toSign: SignatureItem[]; sent: SignatureItem[] } | null>(null)
  const [signing, setSigning] = useState<SignatureItem | null>(null)
  const [local, setLocal] = useState(0)
  useEffect(() => { vault.signatures().then(setData).catch(() => setData({ toSign: [], sent: [] })) }, [tick, local])

  if (!data) return <p className="mt-6 text-[13px] text-ink-muted">Loading signatures…</p>
  const open = data.toSign.filter(s => s.status === 'Pending')
  const done = data.toSign.filter(s => s.status !== 'Pending')

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Panel title="Waiting for your signature" subtitle="You are the named signer on these documents">
        {open.length === 0 ? <Empty title="Nothing to sign" text="Documents sent to you for e-signature appear here." /> : (
          <ul className="divide-y divide-line">
            {open.map(s => (
              <Row key={s.id} type={s.docType} title={s.docTitle} onOpen={() => onOpen(s.docId)} meta={<>Requested by {s.requestedBy} · v{s.version} · {timeAgo(s.createdAt)}</>}>
                {s.canSign ? (
                  <button type="button" className="btn-primary h-8" onClick={() => setSigning(s)}><PenLine className="h-3.5 w-3.5" /> Sign</button>
                ) : (
                  <span className="chip bg-canvas text-ink-muted">Newer version</span>
                )}
              </Row>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <>
            <p className="border-t border-line bg-canvas px-5 py-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">Your signing history</p>
            <ul className="divide-y divide-line">
              {done.map(s => (
                <Row key={s.id} type={s.docType} title={s.docTitle} onOpen={() => onOpen(s.docId)} meta={<>{s.signedAt ? `Signed ${timeAgo(s.signedAt)}` : s.status}</>}>
                  <StatusChip status={s.status} />
                </Row>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Signature requests you manage" subtitle="Progress on documents sent to other people">
        {data.sent.length === 0 ? <Empty title="No requests" text="Open a document and choose “Request signature”." /> : (
          <ul className="divide-y divide-line">
            {data.sent.map(s => (
              <Row key={s.id} type={s.docType} title={s.docTitle} onOpen={() => onOpen(s.docId)} meta={<>{s.signerName} · {s.signerEmail} · {s.signedAt ? `signed ${timeAgo(s.signedAt)}` : `sent ${timeAgo(s.createdAt)}`}</>}>
                <StatusChip status={s.status} />
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <SignDialog
        open={signing !== null}
        title={signing?.docTitle ?? ''}
        defaultName={user.name}
        onClose={() => setSigning(null)}
        onSign={async input => {
          if (!signing) return
          await vault.sign(signing.id, input)
          notify('Document signed')
          setLocal(n => n + 1)
          onChanged()
        }}
      />
    </div>
  )
}

/* --------------------------------------------------------------- retention */
export function RetentionTab({ onOpen, tick }: TabProps) {
  const [data, setData] = useState<RetentionData | null>(null)
  useEffect(() => { vault.retention().then(setData).catch(() => undefined) }, [tick])
  if (!data) return <p className="mt-6 text-[13px] text-ink-muted">Loading retention policies…</p>

  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: ShieldCheck, label: 'Policies in force', value: data.policies.length },
          { icon: Scale, label: 'Under legal hold', value: data.legalHold },
          { icon: ShieldAlert, label: 'Due for review', value: data.overdue },
          { icon: FileClock, label: 'Ending within a year', value: data.upcoming.length },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="card p-4">
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink-soft"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600"><Icon className="h-[15px] w-[15px]" /></span>{s.label}</span>
              <p className="mt-3 text-[26px] font-semibold leading-none">{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <Panel title="Retention policies" subtitle="Applied automatically from the document type, and adjustable per document">
            <ul className="divide-y divide-line">
              {data.policies.map(p => (
                <li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[13px] font-semibold text-brand-700">{p.years ? `${p.years} yr` : '∞'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{p.name}</p>
                    <p className="text-[12px] text-ink-muted">{p.description}</p>
                  </div>
                  <div className="text-right text-[12px] text-ink-muted">
                    <p><b className="text-[14px] text-ink">{p.documents ?? 0}</b> document{p.documents === 1 ? '' : 's'}</p>
                    {!!p.due && <p className="font-medium text-coral-600">{p.due} due for review</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <Panel title="Ending soon" subtitle="Retention periods that finish in the next 12 months">
          {data.upcoming.length === 0 ? <Empty title="Nothing ending soon" text="No document reaches the end of its retention period this year." /> : (
            <ul className="divide-y divide-line">
              {data.upcoming.map(d => {
                const r = retentionLabel(d.daysLeft)
                return (
                  <Row key={d.id} type={d.docType} title={d.title} onOpen={() => onOpen(d.id)} meta={<>Until {formatDate(d.retentionUntil)}</>}>
                    <span className={cn('chip', r.tone === 'coral' ? 'bg-coral-50 text-coral-600' : 'bg-warn-50 text-warn-600')}>{r.text}</span>
                    {d.legalHold && <Lock className="h-3.5 w-3.5 text-coral-500" aria-label="Legal hold" />}
                  </Row>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- audit */
function toCsv(rows: AuditEntry[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  return ['When,Who,Action,Document,Details', ...rows.map(r => [r.at, r.actor, r.action, r.docTitle, r.detail].map(esc).join(','))].join('\n')
}

export function AuditTab({ onOpen, tick }: TabProps) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setSearch(q), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => {
    vault.audit({ action, q: search }).then(r => { setEntries(r.entries); setActions(r.actions) }).catch(() => setEntries([]))
  }, [action, search, tick])

  const exportCsv = () => {
    if (!entries) return
    const url = URL.createObjectURL(new Blob([toCsv(entries)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `vault-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  const tone = (a: string) =>
    /Approved|Signed|Uploaded|Restored/.test(a) ? 'bg-ok-50 text-ok-600' : /Rejected|Deleted|Legal hold set|cancelled/.test(a) ? 'bg-coral-50 text-coral-600' : /requested|reminder/i.test(a) ? 'bg-warn-50 text-warn-600' : 'bg-canvas text-ink-soft'

  return (
    <section className="card mt-5 overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <div className="mr-auto">
          <h2 className="text-[14.5px] font-semibold tracking-tight">Audit trail</h2>
          <p className="text-[12.5px] text-ink-muted">Every view, change, approval and signature, recorded with who and when</p>
        </div>
        <input className="field-input h-9 w-[200px]" placeholder="Search the log" value={q} onChange={e => setQ(e.target.value)} aria-label="Search audit log" />
        <select className="field-select" value={action} onChange={e => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {actions.map(a => <option key={a}>{a}</option>)}
        </select>
        <button type="button" className="btn-secondary h-9" onClick={exportCsv} disabled={!entries?.length}><DownloadIcon className="h-3.5 w-3.5" /> Export CSV</button>
      </header>

      {!entries && <p className="px-5 py-10 text-center text-[13px] text-ink-muted">Loading the audit trail…</p>}
      {entries && entries.length === 0 && <Empty title="No matching entries" text="Try a different search or action." />}
      <ul className="divide-y divide-line">
        {entries?.map(e => (
          <li key={e.id} className="grid grid-cols-[1fr] gap-1 px-5 py-3 sm:grid-cols-[150px_150px_minmax(0,1fr)] sm:items-start sm:gap-4">
            <time className="text-[12px] text-ink-muted" title={formatDateTime(e.at)}>{formatDateTime(e.at)}</time>
            <span><span className={cn('chip', tone(e.action))}>{e.action}</span></span>
            <div className="min-w-0">
              <p className="text-[13px]">
                <span className="font-medium">{e.actor}</span>
                {e.docTitle && <> · {e.docId ? <button type="button" className="text-brand-700 hover:underline" onClick={() => onOpen(e.docId!)}>{e.docTitle}</button> : <span className="text-ink-soft">{e.docTitle}</span>}</>}
              </p>
              {e.detail && <p className="text-[12px] text-ink-muted">{e.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
