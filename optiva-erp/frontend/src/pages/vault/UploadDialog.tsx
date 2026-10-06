import { CheckCircle2, FileUp, Loader2, Sparkles, X, AlertTriangle } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Modal } from '../../components/ui/overlays'
import { cn, useToast } from '../../components/ui/primitives'
import { FOLDERS, fileToBase64, formatBytes, vault, type DocDetail } from './vaultApi'

interface Item {
  key: string
  file: File
  state: 'ready' | 'uploading' | 'done' | 'error'
  result?: DocDetail
  error?: string
}

const MAX = 15 * 1024 * 1024

export function UploadDialog({
  open,
  onClose,
  onUploaded,
  onOpenDoc,
}: {
  open: boolean
  onClose: () => void
  onUploaded: () => void
  onOpenDoc: (id: string) => void
}) {
  const notify = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [folder, setFolder] = useState('')
  const [visibility, setVisibility] = useState<'Company' | 'Private'>('Company')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const add = (files: FileList | File[]) => {
    const next: Item[] = [...files].map(file => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      state: file.size > MAX ? 'error' : 'ready',
      error: file.size > MAX ? 'Files can be up to 15 MB' : undefined,
    }))
    setItems(list => [...list, ...next])
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (e.dataTransfer.files.length) add(e.dataTransfer.files)
  }

  const patch = (key: string, p: Partial<Item>) => setItems(list => list.map(i => (i.key === key ? { ...i, ...p } : i)))

  const upload = async () => {
    setBusy(true)
    let ok = 0
    for (const it of items.filter(i => i.state === 'ready')) {
      patch(it.key, { state: 'uploading' })
      try {
        const result = await vault.upload({
          filename: it.file.name,
          content_b64: await fileToBase64(it.file),
          mime: it.file.type,
          folder: folder || undefined,
          visibility,
        })
        patch(it.key, { state: 'done', result })
        ok++
      } catch (e) {
        patch(it.key, { state: 'error', error: e instanceof Error ? e.message : 'Upload failed' })
      }
    }
    setBusy(false)
    if (ok) {
      notify(`${ok} document${ok > 1 ? 's' : ''} added to the Vault`)
      onUploaded()
    }
  }

  const close = () => {
    if (busy) return
    setItems([])
    onClose()
  }

  const ready = items.filter(i => i.state === 'ready').length
  const finished = items.length > 0 && items.every(i => i.state === 'done' || i.state === 'error')

  return (
    <Modal
      open={open}
      onClose={close}
      title="Upload documents"
      description="Optiva reads each file, then classifies it, files it in a folder and applies a retention policy."
      width="max-w-[620px]"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close} disabled={busy}>{finished ? 'Done' : 'Cancel'}</button>
          {!finished && (
            <button type="button" className="btn-primary" onClick={upload} disabled={busy || ready === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Upload {ready > 0 ? `${ready} file${ready > 1 ? 's' : ''}` : ''}
            </button>
          )}
        </>
      }
    >
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors',
          over ? 'border-brand-400 bg-brand-50' : 'border-line-strong bg-canvas hover:border-brand-300 hover:bg-brand-50/50',
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-card"><FileUp className="h-5 w-5" /></span>
        <p className="mt-3 text-[14px] font-medium">Drop files here or click to browse</p>
        <p className="mt-1 text-[12px] text-ink-muted">PDF, Word, text and spreadsheets up to 15 MB. Text is read from PDF, DOCX and plain-text files.</p>
        <input ref={input} type="file" multiple hidden onChange={e => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="up-folder">Folder</label>
          <select id="up-folder" className="field-select w-full" value={folder} onChange={e => setFolder(e.target.value)}>
            <option value="">Detect automatically</option>
            {FOLDERS.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="up-vis">Who can see it</label>
          <select id="up-vis" className="field-select w-full" value={visibility} onChange={e => setVisibility(e.target.value as 'Company' | 'Private')}>
            <option value="Company">Everyone in the company</option>
            <option value="Private">Only me (and administrators)</option>
          </select>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map(it => (
            <li key={it.key} className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{it.file.name}</p>
                  <p className="text-[12px] text-ink-muted">{formatBytes(it.file.size)}</p>
                </div>
                {it.state === 'ready' && (
                  <button type="button" aria-label={`Remove ${it.file.name}`} className="icon-btn h-7 w-7" onClick={() => setItems(l => l.filter(x => x.key !== it.key))}>
                    <X className="h-4 w-4" />
                  </button>
                )}
                {it.state === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
                {it.state === 'done' && <CheckCircle2 className="h-4 w-4 text-ok-500" />}
                {it.state === 'error' && <AlertTriangle className="h-4 w-4 text-coral-500" />}
              </div>
              {it.state === 'error' && <p className="mt-1.5 text-[12px] text-coral-600">{it.error}</p>}
              {it.result && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-brand-50/70 px-3 py-2 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-brand-700"><Sparkles className="h-3.5 w-3.5" /> {it.result.docType}</span>
                  <span className="text-ink-muted">{Math.round(it.result.confidence * 100)}% confidence</span>
                  <span className="text-ink-muted">Filed in {it.result.folder}</span>
                  {it.result.retention.policy && <span className="text-ink-muted">{it.result.retention.policy.name}</span>}
                  <button type="button" className="ml-auto font-medium text-brand-700 hover:underline" onClick={() => onOpenDoc(it.result!.id)}>Open</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
