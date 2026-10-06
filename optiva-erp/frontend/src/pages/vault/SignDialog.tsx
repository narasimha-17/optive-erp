import { Eraser, Loader2, PenLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/ui/overlays'
import { ApiError } from '../../api/client'

interface Props {
  open: boolean
  title: string
  defaultName: string
  onClose: () => void
  onSign: (input: { typed_name: string; consent: boolean; drawing: string }) => Promise<void>
}

export function SignDialog({ open, title, defaultName, onClose, onSign }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [drawn, setDrawn] = useState(false)
  const [name, setName] = useState(defaultName)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setConsent(false)
      setDrawn(false)
      setError('')
    }
  }, [open, defaultName])

  useEffect(() => {
    const c = canvas.current
    if (!open || !c) return
    const ctx = c.getContext('2d')!
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#14141f'
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height] as const
    }
    const down = (e: PointerEvent) => {
      drawing.current = true
      c.setPointerCapture(e.pointerId)
      const [x, y] = pos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const move = (e: PointerEvent) => {
      if (!drawing.current) return
      const [x, y] = pos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
      setDrawn(true)
    }
    const up = () => { drawing.current = false }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
    }
  }, [open])

  const clear = () => {
    const c = canvas.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setDrawn(false)
  }

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      await onSign({ typed_name: name.trim(), consent, drawing: drawn ? canvas.current!.toDataURL('image/png') : '' })
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign the document')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign document"
      description={title}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy || name.trim().length < 2 || !consent} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Sign document
          </button>
        </>
      }
    >
      <label className="field-label" htmlFor="sign-name">Type your full legal name</label>
      <input id="sign-name" className="field-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
      <p className="mt-3 text-center font-serif text-[26px] italic text-ink-soft" aria-hidden="true">{name || ' '}</p>

      <div className="mt-3 flex items-center justify-between">
        <span className="field-label !mb-0">Draw your signature (optional)</span>
        <button type="button" className="btn-ghost h-7 px-2 text-[12px]" onClick={clear}><Eraser className="h-3.5 w-3.5" /> Clear</button>
      </div>
      <canvas ref={canvas} width={960} height={260} className="mt-1.5 h-[130px] w-full touch-none rounded-lg border border-dashed border-line-strong bg-canvas" />

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-soft">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={consent} onChange={e => setConsent(e.target.checked)} />
        I agree that my typed name and drawing are my electronic signature, and I have read this document.
      </label>
      <p className="mt-2 text-[12px] text-ink-muted">A SHA-256 fingerprint of the document is stored with your signature so any later change can be detected.</p>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-coral-600">{error}</p>}
    </Modal>
  )
}
