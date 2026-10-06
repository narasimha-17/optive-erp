import { Check, Loader2, Plus, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { iconFor } from '../lib/icons'
import type { Addon } from '../types'
import { cn, useToast } from './ui/primitives'

export function AddonCard({ addon }: { addon: Addon }) {
  const [state, setState] = useState<'idle' | 'working' | 'enabled'>(addon.enabled ? 'enabled' : 'idle')
  const notify = useToast()
  const Icon = iconFor(addon.icon)
  useEffect(() => setState(addon.enabled ? 'enabled' : 'idle'), [addon.enabled])

  const enable = async () => {
    if (state !== 'idle') return
    setState('working')
    try {
      await api<Addon>(`/modules/${addon.id}/enable`, { method: 'POST' })
      setState('enabled')
      notify(`${addon.name} enabled for your company`)
    } catch {
      setState('idle')
      notify('Could not enable the module. Please try again.')
    }
  }

  return (
    <article className="card flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-pop">
      <header className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <span className="chip bg-canvas text-ink-soft">{addon.category}</span>
      </header>
      <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight">{addon.name}</h3>
      <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-ink-muted">{addon.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[12.5px]">
          <Star className="h-3.5 w-3.5 fill-warn-500 text-warn-500" />
          <span className="font-semibold">{addon.rating.toFixed(1)}</span>
          <span className="text-ink-faint">· {addon.customers} companies</span>
        </div>
        <button
          type="button"
          onClick={enable}
          disabled={state === 'working'}
          className={cn(
            'btn h-8 px-3',
            state === 'enabled' ? 'border border-ok-500/30 bg-ok-50 text-ok-600' : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          {state === 'idle' && <Plus className="h-3.5 w-3.5" />}
          {state === 'working' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {state === 'enabled' && <Check className="h-3.5 w-3.5" />}
          {state === 'idle' ? 'Enable' : state === 'working' ? 'Enabling' : 'Enabled'}
        </button>
      </div>
    </article>
  )
}
