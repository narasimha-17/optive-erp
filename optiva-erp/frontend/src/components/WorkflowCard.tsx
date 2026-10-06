import { ArrowRight, Pause, Play, Zap } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Workflow } from '../types'
import { StatusChip, cn, useToast } from './ui/primitives'

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const [status, setStatus] = useState(workflow.status)
  const [busy, setBusy] = useState(false)
  const notify = useToast()
  const running = status === 'Running'
  useEffect(() => setStatus(workflow.status), [workflow.status])

  const toggle = async () => {
    const next = running ? 'Paused' : 'Running'
    setBusy(true)
    setStatus(next) // optimistic update, rolled back if the API call fails
    try {
      await api<Workflow>(`/workflows/${workflow.id}`, { method: 'PATCH', body: { status: next } })
      notify(`${workflow.name} ${next === 'Running' ? 'resumed' : 'paused'}`)
    } catch {
      setStatus(workflow.status)
      notify('Could not update the workflow. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card p-4 transition-shadow hover:shadow-pop sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[14.5px] font-semibold tracking-tight">{workflow.name}</h3>
            <StatusChip status={status} />
          </div>
          <p className="mt-1 max-w-[560px] text-[12.5px] leading-snug text-ink-muted">{workflow.description}</p>
        </div>
        <button type="button" onClick={toggle} disabled={busy} className="btn-secondary h-8 disabled:opacity-60">
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {running ? 'Pause' : 'Resume'}
        </button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg bg-canvas p-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-700">
          <Zap className="h-3 w-3" /> {workflow.trigger}
        </span>
        {workflow.steps.map((s, i) => (
          <Fragment key={s}>
            <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
            <span className="rounded-md border border-line bg-white px-2 py-1 text-[12px] text-ink-soft">
              <span className="mr-1.5 text-ink-faint">{i + 1}</span>
              {s}
            </span>
          </Fragment>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
        <div>
          <dt className="text-ink-muted">Runs this week</dt>
          <dd className={cn('mt-0.5 text-[15px] font-semibold tabular-nums', !running && workflow.runsThisWeek === 0 && 'text-ink-faint')}>
            {workflow.runsThisWeek.toLocaleString('en-IN')}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Success rate</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{workflow.success}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Last run</dt>
          <dd className="mt-0.5 text-[13px] font-medium">{workflow.lastRun}</dd>
        </div>
      </dl>
    </article>
  )
}
