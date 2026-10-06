import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Bell,
  Download,
  History,
  Loader2,
  Lock,
  PenLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
  ClipboardCheck,
  Info,
  Globe,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Drawer, Modal } from '../../components/ui/overlays'
import { StatusChip, cn, useToast } from '../../components/ui/primitives'
import type { ShellContext } from '../../layouts/AppShell'
import { iconForType } from './docIcons'
import { SignDialog } from './SignDialog'
import {
  DOC_TYPES,
  FOLDERS,
  downloadDocument,
  fileToBase64,
  formatBytes,
  formatDate,
  formatDateTime,
  retentionLabel,
  timeAgo,
  vault,
  type DocDetail,
  type Person,
  type Policy,
} from './vaultApi'

type Tab = 'overview' | 'versions' | 'approvals' | 'signatures' | 'access' | 'activity'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'versions', label: 'Versions' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'access', label: 'Access' },
  { id: 'activity', label: 'Activity' },
]

const errText = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong')

function Block({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold">{icon}{title}</h3>
        {action}
      </header>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{children}</dd>
    </div>
  )
}

function Pills({ items, empty = '—' }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-ink-faint">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map(i => <span key={i} className="chip bg-canvas text-ink-soft">{i}</span>)}
    </span>
  )
}

export function DocumentDrawer({ docId, onClose, onChanged }: { docId: string | null; onClose: () => void; onChanged: () => void }) {
  const notify = useToast()
  const { user } = useOutletContext<ShellContext>()
  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [people, setPeople] = useState<Person[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [busy, setBusy] = useState(false)
  const [signing, setSigning] = useState<{ id: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [versionNote, setVersionNote] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  useEffect(() => {
    if (!docId) {
      setDoc(null)
      return
    }
    setDoc(null)
    setError('')
    setTab('overview')
    vault.get(docId).then(setDoc).catch(e => setError(errText(e)))
    vault.people().then(setPeople).catch(() => undefined)
    vault.retention().then(r => setPolicies(r.policies)).catch(() => undefined)
  }, [docId])

  /** Run a mutation, store the returned document and tell the page to refresh. */
  const act = useCallback(
    async (fn: () => Promise<DocDetail>, message?: string): Promise<boolean> => {
      setBusy(true)
      try {
        const next = await fn()
        setDoc(next)
        onChanged()
        if (message) notify(message)
        return true
      } catch (e) {
        notify(errText(e))
        return false
      } finally {
        setBusy(false)
      }
    },
    [notify, onChanged],
  )

  const open = docId !== null
  const Icon = iconForType(doc?.docType ?? 'Other')

  const uploadVersion = async () => {
    if (!doc || !pendingFile) return
    const file = pendingFile
    const ok = await act(
      async () => vault.addVersion(doc.id, { filename: file.name, content_b64: await fileToBase64(file), note: versionNote }),
      `Version ${doc.version + 1} added`,
    )
    if (ok) {
      setPendingFile(null)
      setVersionNote('')
    }
  }

  const doDelete = async () => {
    if (!doc) return
    setBusy(true)
    try {
      await vault.remove(doc.id)
      notify(`${doc.title} deleted`)
      setConfirmDelete(false)
      onChanged()
      onClose()
    } catch (e) {
      notify(errText(e))
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} label="Document details">
      {error && (
        <div className="p-6">
          <p role="alert" className="text-[13px] text-coral-600">{error}</p>
          <button type="button" className="btn-secondary mt-4" onClick={onClose}>Close</button>
        </div>
      )}

      {!doc && !error && <div className="flex flex-1 items-center justify-center text-[13px] text-ink-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading document…</div>}

      {doc && (
        <>
          <header className="border-b border-line px-5 pb-0 pt-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
              <div className="min-w-0 flex-1">
                <TitleEditor doc={doc} disabled={!doc.caps.edit || busy} onSave={title => act(() => vault.patch(doc.id, { title }), 'Title updated')} />
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
                  <StatusChip status={doc.status} />
                  <span>v{doc.version}</span>
                  <span>·</span>
                  <span>{doc.docType}</span>
                  <span>·</span>
                  <span>{formatBytes(doc.size)}</span>
                  {doc.visibility === 'Private' ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Private</span> : <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> Company</span>}
                  {doc.legalHold && <span className="chip bg-coral-50 text-coral-600">Legal hold</span>}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={onClose} className="icon-btn -mr-2 h-8 w-8"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary h-8" onClick={() => downloadDocument(doc.id, doc.filename).catch(() => notify('Download failed'))}>
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              {doc.caps.edit && (
                <button type="button" className="btn-secondary h-8" onClick={() => { setTab('versions'); setTimeout(() => fileInput.current?.click(), 50) }}>
                  <Upload className="h-3.5 w-3.5" /> New version
                </button>
              )}
              {doc.caps.edit && !['Pending approval', 'Awaiting signature', 'Archived'].includes(doc.status) && (
                <button type="button" className="btn-secondary h-8" onClick={() => setTab('approvals')}><ClipboardCheck className="h-3.5 w-3.5" /> Request approval</button>
              )}
              {doc.caps.edit && !['Pending approval', 'Awaiting signature', 'Archived', 'Signed'].includes(doc.status) && (
                <button type="button" className="btn-secondary h-8" onClick={() => setTab('signatures')}><PenLine className="h-3.5 w-3.5" /> Request signature</button>
              )}
              {doc.caps.approve && <button type="button" className="btn-primary h-8" onClick={() => setTab('approvals')}>Review approval</button>}
              {doc.caps.sign && <button type="button" className="btn-primary h-8" onClick={() => setTab('signatures')}>Sign now</button>}
            </div>

            <nav className="scroll-thin -mx-1 mt-3 flex gap-0.5 overflow-x-auto overflow-y-hidden" role="tablist">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn('relative shrink-0 px-3 pb-2.5 pt-1.5 text-[13px] font-medium transition-colors', tab === t.id ? 'text-brand-700' : 'text-ink-muted hover:text-ink')}
                >
                  {t.label}
                  {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
                </button>
              ))}
            </nav>
          </header>

          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto bg-canvas/50 px-5 py-5">
            {tab === 'overview' && (
              <>
                <Block title="Details" icon={<Info className="h-4 w-4 text-brand-600" />}>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                    <Fact label="Type">
                      {doc.caps.edit ? (
                        <select className="field-select w-full" value={doc.docType} disabled={busy} onChange={e => act(() => vault.patch(doc.id, { doc_type: e.target.value }), 'Type updated')}>
                          {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      ) : doc.docType}
                    </Fact>
                    <Fact label="Folder">
                      {doc.caps.edit ? (
                        <select className="field-select w-full" value={doc.folder} disabled={busy} onChange={e => act(() => vault.patch(doc.id, { folder: e.target.value }), 'Folder updated')}>
                          {FOLDERS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      ) : doc.folder}
                    </Fact>
                    <Fact label="Owner">{doc.owner.name}</Fact>
                    <Fact label="Created">{formatDate(doc.createdAt)}</Fact>
                    <Fact label="Last updated">{timeAgo(doc.updatedAt)}</Fact>
                    <Fact label="File">{doc.filename}</Fact>
                  </dl>
                  <div className="mt-4">
                    <TagEditor tags={doc.tags} disabled={!doc.caps.edit || busy} onChange={tags => act(() => vault.patch(doc.id, { tags }))} />
                  </div>
                </Block>

                <Block
                  title="Automatic classification"
                  icon={<Sparkles className="h-4 w-4 text-brand-600" />}
                  action={doc.caps.edit && <button type="button" className="btn-ghost h-7 px-2 text-[12px]" disabled={busy} onClick={() => act(() => vault.reclassify(doc.id), 'Reclassified')}><RotateCcw className="h-3.5 w-3.5" /> Re-run</button>}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[13px]">Detected as <b>{doc.classification.docType}</b></span>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round(doc.confidence * 100)}%` }} /></div>
                    <span className="text-[12px] text-ink-muted">{Math.round(doc.confidence * 100)}% confidence</span>
                  </div>
                  <p className="mt-2 text-[12px] text-ink-muted">Filed under {doc.classification.suggestedFolder} with the {policies.find(p => p.id === doc.classification.suggestedRetention)?.name ?? 'standard'} retention policy.</p>
                </Block>

                <Block title="Document intelligence" icon={<Sparkles className="h-4 w-4 text-brand-600" />}>
                  {doc.intelligence.summary ? (
                    <p className="text-[13px] leading-relaxed text-ink-soft">{doc.intelligence.summary}</p>
                  ) : (
                    <p className="text-[13px] text-ink-muted">No readable text was found in this file, so nothing could be extracted. PDF, DOCX and text files are supported.</p>
                  )}
                  {doc.intelligence.flags.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {doc.intelligence.flags.map(f => (
                        <li key={f.label} className={cn('chip', f.level === 'warn' ? 'bg-warn-50 text-warn-600' : 'bg-brand-50 text-brand-700')}>
                          {f.level === 'warn' && <AlertTriangle className="h-3 w-3" />}{f.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Fact label="Parties"><Pills items={doc.intelligence.parties} /></Fact>
                    <Fact label="Amounts"><Pills items={doc.intelligence.amounts} /></Fact>
                    <Fact label="Dates"><Pills items={doc.intelligence.dates} /></Fact>
                    <Fact label="References"><Pills items={doc.intelligence.references} /></Fact>
                    <Fact label="Key terms"><Pills items={doc.intelligence.keyTerms} /></Fact>
                    <Fact label="Contacts"><Pills items={doc.intelligence.emails} /></Fact>
                  </dl>
                </Block>

                <Block title="Retention & legal hold" icon={<ShieldCheck className="h-4 w-4 text-brand-600" />}>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Fact label="Policy">
                      {doc.caps.manage ? (
                        <select className="field-select w-full" value={doc.retentionPolicy ?? ''} disabled={busy} onChange={e => act(() => vault.patch(doc.id, { retention_policy: e.target.value }), 'Retention policy updated')}>
                          {policies.map(p => <option key={p.id} value={p.id}>{p.name} ({p.years ? `${p.years} yr` : 'indefinite'})</option>)}
                        </select>
                      ) : doc.retention.policy?.name ?? '—'}
                    </Fact>
                    <Fact label="Keep until">
                      {doc.retention.until ? <>{formatDate(doc.retention.until)} <span className="text-ink-muted">({retentionLabel(doc.daysToRetention).text})</span></> : 'Indefinitely'}
                    </Fact>
                    <Fact label="Legal hold">
                      <label className={cn('inline-flex items-center gap-2', doc.caps.manage ? 'cursor-pointer' : 'opacity-60')}>
                        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={doc.legalHold} disabled={!doc.caps.manage || busy} onChange={e => act(() => vault.patch(doc.id, { legal_hold: e.target.checked }), e.target.checked ? 'Legal hold set' : 'Legal hold released')} />
                        {doc.legalHold ? 'On hold' : 'Off'}
                      </label>
                    </Fact>
                  </dl>
                  {doc.retention.policy && <p className="mt-3 text-[12px] text-ink-muted">{doc.retention.policy.description}</p>}
                </Block>

                {doc.preview && (
                  <Block title="Text preview">
                    <pre className="scroll-thin max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink-soft">{doc.preview}</pre>
                  </Block>
                )}

                {(doc.caps.manage || doc.caps.delete) && (
                  <Block title="Manage">
                    <div className="flex flex-wrap gap-2">
                      {doc.caps.manage && (
                        <button type="button" className="btn-secondary h-8" disabled={busy} onClick={() => act(() => vault.patch(doc.id, { archived: !doc.archived }), doc.archived ? 'Restored from archive' : 'Document archived')}>
                          {doc.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          {doc.archived ? 'Restore from archive' : 'Archive'}
                        </button>
                      )}
                      {doc.caps.delete && (
                        <button type="button" className="btn h-8 border border-coral-100 bg-coral-50 text-coral-600 hover:bg-coral-100" disabled={busy} onClick={() => setConfirmDelete(true)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[12px] text-ink-muted">Documents under legal hold or inside their retention period can’t be deleted. Archive them instead.</p>
                  </Block>
                )}
              </>
            )}

            {tab === 'versions' && (
              <>
                {doc.caps.edit && (
                  <Block title="Add a new version" icon={<History className="h-4 w-4 text-brand-600" />}>
                    <input ref={fileInput} type="file" hidden onChange={e => { setPendingFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
                    {pendingFile ? (
                      <div className="space-y-3">
                        <p className="text-[13px]"><b>{pendingFile.name}</b> <span className="text-ink-muted">({formatBytes(pendingFile.size)})</span></p>
                        <input className="field-input" placeholder="What changed in this version?" value={versionNote} onChange={e => setVersionNote(e.target.value)} />
                        <div className="flex gap-2">
                          <button type="button" className="btn-primary h-8" disabled={busy} onClick={uploadVersion}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload version {doc.version + 1}</button>
                          <button type="button" className="btn-secondary h-8" onClick={() => setPendingFile(null)}>Cancel</button>
                        </div>
                        {['Approved', 'Signed', 'Awaiting signature', 'Pending approval'].includes(doc.status) && (
                          <p className="text-[12px] text-warn-600">A new version resets this document to Draft and cancels open approval and signature requests.</p>
                        )}
                      </div>
                    ) : (
                      <button type="button" className="btn-secondary h-8" onClick={() => fileInput.current?.click()}><Upload className="h-3.5 w-3.5" /> Choose file</button>
                    )}
                  </Block>
                )}
                <Block title={`Version history (${doc.versions.length})`}>
                  <ol className="space-y-3">
                    {doc.versions.map(v => (
                      <li key={v.version} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
                        <span className={cn('flex h-8 w-10 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold', v.current ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-soft')}>v{v.version}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{v.filename}{v.current && <span className="ml-2 chip bg-ok-50 text-ok-600">Current</span>}</p>
                          <p className="text-[12px] text-ink-muted">{v.note || 'No note'} · {v.uploadedBy} · {formatDateTime(v.createdAt)} · {formatBytes(v.size)}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-faint" title={v.sha256}>SHA-256 {v.sha256.slice(0, 20)}…</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button" className="btn-secondary h-8 px-2.5" onClick={() => downloadDocument(doc.id, v.filename, v.version).catch(() => notify('Download failed'))}><Download className="h-3.5 w-3.5" /></button>
                          {doc.caps.edit && !v.current && (
                            <button type="button" className="btn-secondary h-8" disabled={busy} onClick={() => act(() => vault.restore(doc.id, v.version), `Restored v${v.version} as the newest version`)}><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Block>
              </>
            )}

            {tab === 'approvals' && <ApprovalsPanel doc={doc} people={people} userId={user.id} busy={busy} act={act} />}
            {tab === 'signatures' && <SignaturesPanel doc={doc} people={people} userName={user.name} userEmail={user.email} busy={busy} act={act} onSign={id => setSigning({ id })} />}
            {tab === 'access' && <AccessPanel doc={doc} people={people} busy={busy} act={act} />}

            {tab === 'activity' && (
              <Block title="Audit trail" icon={<History className="h-4 w-4 text-brand-600" />}>
                <ol className="relative space-y-4">
                  {doc.audit.map(a => (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]"><b className="font-medium">{a.action}</b> <span className="text-ink-muted">by {a.actor}</span></p>
                        {a.detail && <p className="text-[12px] text-ink-muted">{a.detail}</p>}
                        <p className="text-[11.5px] text-ink-faint">{formatDateTime(a.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Block>
            )}
          </div>

          <SignDialog
            open={signing !== null}
            title={doc.title}
            defaultName={user.name}
            onClose={() => setSigning(null)}
            onSign={async input => {
              if (!signing) return
              const next = await vault.sign(signing.id, input)
              setDoc(next)
              onChanged()
              notify('Document signed')
            }}
          />

          <Modal
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            title="Delete this document?"
            description="This removes every version and cannot be undone. The audit trail keeps a record that it was deleted."
            footer={
              <>
                <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button type="button" className="btn bg-coral-500 text-white hover:bg-coral-600" disabled={busy} onClick={doDelete}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete</button>
              </>
            }
          >
            <p className="text-[13px]"><b>{doc.title}</b></p>
          </Modal>
        </>
      )}
    </Drawer>
  )
}

/* ------------------------------------------------------------- small editors */
function TitleEditor({ doc, disabled, onSave }: { doc: DocDetail; disabled: boolean; onSave: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(doc.title)
  useEffect(() => setValue(doc.title), [doc.title])
  if (!editing) {
    return (
      <h2 className="truncate text-[17px] font-semibold tracking-tight">
        {doc.title}
        {!disabled && <button type="button" className="ml-2 text-[12px] font-medium text-brand-600 hover:underline" onClick={() => setEditing(true)}>Rename</button>}
      </h2>
    )
  }
  const save = () => {
    setEditing(false)
    if (value.trim() && value.trim() !== doc.title) onSave(value.trim())
  }
  return (
    <input
      autoFocus
      className="field-input h-9 text-[15px] font-semibold"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(doc.title); setEditing(false) } }}
    />
  )
}

function TagEditor({ tags, disabled, onChange }: { tags: string[]; disabled: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }
  return (
    <div>
      <p className="text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">Tags</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {tags.map(t => (
          <span key={t} className="chip bg-brand-50 text-brand-700">
            {t}
            {!disabled && <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter(x => x !== t))}><X className="h-3 w-3" /></button>}
          </span>
        ))}
        {!tags.length && disabled && <span className="text-[13px] text-ink-faint">—</span>}
        {!disabled && (
          <input
            className="h-7 w-28 rounded-md border border-dashed border-line-strong bg-white px-2 text-[12px] outline-none placeholder:text-ink-faint focus:border-brand-400"
            placeholder="Add tag"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            onBlur={add}
          />
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- panels */
type Act = (fn: () => Promise<DocDetail>, message?: string) => Promise<boolean>

function ApprovalsPanel({ doc, people, userId, busy, act }: { doc: DocDetail; people: Person[]; userId: number; busy: boolean; act: Act }) {
  const [approver, setApprover] = useState('')
  const [note, setNote] = useState('')
  const [comments, setComments] = useState<Record<number, string>>({})
  const canRequest = doc.caps.edit && !['Pending approval', 'Awaiting signature', 'Archived'].includes(doc.status)
  const choices = people.filter(p => p.id !== userId)

  return (
    <>
      {canRequest && (
        <Block title="Request approval" icon={<ClipboardCheck className="h-4 w-4 text-brand-600" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="appr">Approver</label>
              <select id="appr" className="field-select w-full" value={approver} onChange={e => setApprover(e.target.value)}>
                <option value="">Choose a colleague…</option>
                {choices.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="appr-note">Note (optional)</label>
              <input id="appr-note" className="field-input h-9" value={note} onChange={e => setNote(e.target.value)} placeholder="What should they check?" />
            </div>
          </div>
          <button type="button" className="btn-primary mt-3 h-8" disabled={busy || !approver} onClick={() => act(() => vault.requestApproval(doc.id, { approver_id: Number(approver), note }), 'Approval requested').then(ok => ok && (setApprover(''), setNote('')))}>
            Send for approval
          </button>
          <p className="mt-2 text-[12px] text-ink-muted">The document is locked as “Pending approval” until the approver decides. You can’t approve your own request.</p>
        </Block>
      )}

      <Block title={`Approval history (${doc.approvals.length})`}>
        {doc.approvals.length === 0 && <p className="text-[13px] text-ink-muted">No approvals have been requested yet.</p>}
        <ol className="space-y-3">
          {doc.approvals.map(a => (
            <li key={a.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={a.status} />
                <span className="text-[13px] font-medium">{a.approver.name}</span>
                <span className="text-[12px] text-ink-muted">· requested by {a.requestedBy} for v{a.version} · {timeAgo(a.createdAt)}</span>
              </div>
              {a.requestNote && <p className="mt-1.5 text-[12.5px] text-ink-soft">“{a.requestNote}”</p>}
              {a.comment && <p className="mt-1.5 text-[12.5px] text-ink-soft"><b className="font-medium">{a.approver.name.split(' ')[0]}:</b> {a.comment}</p>}
              {a.canDecide && (
                <div className="mt-3 space-y-2 rounded-lg bg-brand-50/60 p-3">
                  <input className="field-input h-9" placeholder="Add a comment (required to reject)" value={comments[a.id] ?? ''} onChange={e => setComments(c => ({ ...c, [a.id]: e.target.value }))} />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary h-8" disabled={busy} onClick={() => act(() => vault.decide(a.id, { decision: 'Approved', comment: comments[a.id] ?? '' }), 'Document approved')}>Approve</button>
                    <button type="button" className="btn h-8 border border-coral-100 bg-coral-50 text-coral-600 hover:bg-coral-100" disabled={busy} onClick={() => act(() => vault.decide(a.id, { decision: 'Rejected', comment: comments[a.id] ?? '' }), 'Document rejected')}>Reject</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </Block>
    </>
  )
}

function SignaturesPanel({ doc, people, userName, userEmail, busy, act, onSign }: { doc: DocDetail; people: Person[]; userName: string; userEmail: string; busy: boolean; act: Act; onSign: (id: number) => void }) {
  const notify = useToast()
  const [signers, setSigners] = useState<{ name: string; email: string }[]>([{ name: '', email: '' }])
  const canRequest = doc.caps.edit && !['Pending approval', 'Awaiting signature', 'Archived', 'Signed'].includes(doc.status)
  const current = doc.signatures.filter(s => s.version === doc.version)
  const earlier = doc.signatures.filter(s => s.version !== doc.version)
  const valid = signers.every(s => s.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.email.trim()))
  const setSigner = (i: number, p: Partial<{ name: string; email: string }>) => setSigners(l => l.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const addPerson = (id: string) => {
    const p = people.find(x => String(x.id) === id)
    if (!p) return
    setSigners(l => (l.some(s => s.email === p.email) ? l : [...l.filter(s => s.name || s.email), { name: p.name, email: p.email }].slice(0, 6)))
  }

  return (
    <>
      {canRequest && (
        <Block title="Request e-signatures" icon={<PenLine className="h-4 w-4 text-brand-600" />}>
          <div className="space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                <input className="field-input h-9" placeholder="Full name" value={s.name} onChange={e => setSigner(i, { name: e.target.value })} aria-label={`Signer ${i + 1} name`} />
                <input className="field-input h-9" placeholder="Email" type="email" value={s.email} onChange={e => setSigner(i, { email: e.target.value })} aria-label={`Signer ${i + 1} email`} />
                <button type="button" aria-label="Remove signer" className="icon-btn h-9 w-8" disabled={signers.length === 1} onClick={() => setSigners(l => l.filter((_, k) => k !== i))}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost h-8" disabled={signers.length >= 6} onClick={() => setSigners(l => [...l, { name: '', email: '' }])}><Plus className="h-3.5 w-3.5" /> Add signer</button>
            <select className="field-select" value="" onChange={e => addPerson(e.target.value)} aria-label="Add a colleague as signer">
              <option value="">Add a colleague…</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn-ghost h-8" onClick={() => addPerson(String(people.find(p => p.email === userEmail)?.id ?? ''))}><UserPlus className="h-3.5 w-3.5" /> Add me ({userName.split(' ')[0]})</button>
          </div>
          <button type="button" className="btn-primary mt-3 h-8" disabled={busy || !valid} onClick={() => act(() => vault.requestSignatures(doc.id, signers.map(s => ({ name: s.name.trim(), email: s.email.trim() }))), 'Signature request sent').then(ok => ok && setSigners([{ name: '', email: '' }]))}>
            Send for signature
          </button>
          <p className="mt-2 text-[12px] text-ink-muted">Each person signs for themselves while logged in with the email address you enter. A new version cancels open requests.</p>
        </Block>
      )}

      <Block
        title={`Signers for v${doc.version} (${current.length})`}
        icon={<BadgeCheck className="h-4 w-4 text-brand-600" />}
        action={doc.status === 'Awaiting signature' && doc.caps.edit && <button type="button" className="btn-ghost h-7 px-2 text-[12px]" disabled={busy} onClick={() => act(() => vault.cancelSignatures(doc.id), 'Signature request cancelled')}>Cancel request</button>}
      >
        {current.length === 0 && <p className="text-[13px] text-ink-muted">No signatures have been requested for this version.</p>}
        <ul className="space-y-3">
          {current.map(s => (
            <li key={s.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">{s.signerName.split(' ').slice(0, 2).map(w => w[0]).join('')}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{s.signerName}</p>
                  <p className="truncate text-[12px] text-ink-muted">{s.signerEmail}</p>
                </div>
                <StatusChip status={s.status} />
                {s.canSign && <button type="button" className="btn-primary h-8" onClick={() => onSign(s.id)}><PenLine className="h-3.5 w-3.5" /> Sign</button>}
                {s.status === 'Pending' && !s.canSign && doc.caps.edit && (
                  <button type="button" className="btn-secondary h-8" onClick={() => vault.remind(s.id).then(() => notify(`Reminder sent to ${s.signerName}`)).catch(() => notify('Could not send the reminder'))}><Bell className="h-3.5 w-3.5" /> Remind</button>
                )}
              </div>
              {s.status === 'Signed' && (
                <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-ok-50/70 p-3">
                  {s.drawing && <img src={s.drawing} alt={`Signature of ${s.signerName}`} className="h-12 rounded bg-white p-1" />}
                  <div className="min-w-0 text-[12px]">
                    <p className="font-serif text-[20px] italic leading-tight text-ink">{s.typedName}</p>
                    <p className="text-ink-muted">Signed {s.signedAt ? formatDateTime(s.signedAt) : ''}</p>
                    <p className="truncate font-mono text-[11px] text-ink-faint" title={s.docHash}>SHA-256 {s.docHash.slice(0, 32)}…</p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {doc.status === 'Signed' && <p className="mt-3 text-[12px] text-ok-600">All signatures collected. The fingerprints above prove which exact file was signed.</p>}
      </Block>

      {earlier.length > 0 && (
        <Block title="Earlier versions">
          <ul className="space-y-2 text-[12.5px] text-ink-soft">
            {earlier.map(s => <li key={s.id} className="flex items-center justify-between gap-2"><span>v{s.version} · {s.signerName}</span><StatusChip status={s.status} /></li>)}
          </ul>
        </Block>
      )}
    </>
  )
}

function AccessPanel({ doc, people, busy, act }: { doc: DocDetail; people: Person[]; busy: boolean; act: Act }) {
  const [visibility, setVisibility] = useState(doc.visibility)
  const [shares, setShares] = useState(doc.shares.map(s => ({ email: s.email, permission: s.permission, name: s.name })))
  const [email, setEmail] = useState('')
  useEffect(() => {
    setVisibility(doc.visibility)
    setShares(doc.shares.map(s => ({ email: s.email, permission: s.permission, name: s.name })))
  }, [doc.visibility, doc.shares])
  const manage = doc.caps.manage
  const dirty = visibility !== doc.visibility || JSON.stringify(shares.map(s => [s.email, s.permission])) !== JSON.stringify(doc.shares.map(s => [s.email, s.permission]))
  const add = () => {
    const e = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || shares.some(s => s.email === e)) return
    setShares(l => [...l, { email: e, permission: 'view', name: people.find(p => p.email.toLowerCase() === e)?.name ?? '' }])
    setEmail('')
  }

  return (
    <>
      <Block title="Who can open this document" icon={<Lock className="h-4 w-4 text-brand-600" />}>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['Company', 'Everyone in the company', 'Anyone in your company can view it.'],
            ['Private', 'Restricted', 'Only the owner, administrators and people you add below.'],
          ] as const).map(([id, title, text]) => (
            <label key={id} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors', visibility === id ? 'border-brand-400 bg-brand-50/60' : 'border-line bg-white', !manage && 'cursor-default opacity-70')}>
              <input type="radio" name="visibility" className="mt-1 accent-brand-600" checked={visibility === id} disabled={!manage} onChange={() => setVisibility(id)} />
              <span><span className="block text-[13px] font-medium">{title}</span><span className="block text-[12px] text-ink-muted">{text}</span></span>
            </label>
          ))}
        </div>
      </Block>

      <Block title={`Shared with (${shares.length})`} icon={<UserPlus className="h-4 w-4 text-brand-600" />}>
        {shares.length === 0 && <p className="text-[13px] text-ink-muted">Not shared with anyone individually.</p>}
        <ul className="space-y-2">
          {shares.map(s => (
            <li key={s.email} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{s.name || s.email}</p>
                {s.name && <p className="truncate text-[12px] text-ink-muted">{s.email}</p>}
              </div>
              <select className="field-select" value={s.permission} disabled={!manage} onChange={e => setShares(l => l.map(x => (x.email === s.email ? { ...x, permission: e.target.value as 'view' | 'edit' } : x)))} aria-label={`Permission for ${s.email}`}>
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
              {manage && <button type="button" aria-label={`Remove ${s.email}`} className="icon-btn h-8 w-8" onClick={() => setShares(l => l.filter(x => x.email !== s.email))}><X className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
        {manage && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input className="field-input h-9 min-w-[200px] flex-1" type="email" placeholder="Add by email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} list="vault-people" />
            <datalist id="vault-people">{people.map(p => <option key={p.id} value={p.email}>{p.name}</option>)}</datalist>
            <button type="button" className="btn-secondary h-9" onClick={add}><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
        )}
        {manage ? (
          <button type="button" className="btn-primary mt-4 h-8" disabled={busy || !dirty} onClick={() => act(() => vault.access(doc.id, { visibility, shares: shares.map(s => ({ email: s.email, permission: s.permission })) }), 'Access updated')}>Save access</button>
        ) : (
          <p className="mt-3 text-[12px] text-ink-muted">Only the owner or an administrator can change access.</p>
        )}
        <p className="mt-3 text-[12px] text-ink-muted">Approvers and requested signers can always open the document they are asked to review.</p>
      </Block>
    </>
  )
}
