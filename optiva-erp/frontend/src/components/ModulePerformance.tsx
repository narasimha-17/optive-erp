import { iconFor } from '../lib/icons'
import type { ModuleScore } from '../types'
import { SectionCard, cn } from './ui/primitives'

export function ModulePerformance({ modules }: { modules: ModuleScore[] }) {
  const ranked = [...modules].sort((a, b) => b.score - a.score)
  return (
    <SectionCard
      title="Module performance"
      subtitle="Process completion rate, last 30 days"
      className="h-full"
      action={<button type="button" className="btn-ghost h-8 px-2.5">View all</button>}
    >
      <ol className="space-y-4">
        {ranked.map((m, i) => {
          const Icon = iconFor(m.id)
          const weak = m.score < 93
          return (
            <li key={m.id}>
              <div className="flex items-center gap-3">
                <span className="w-4 text-[12px] font-medium text-ink-faint">{i + 1}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">{m.name}</p>
                    <p className={cn('text-[13px] font-semibold tabular-nums', weak ? 'text-coral-600' : 'text-ink')}>{m.score.toFixed(1)}%</p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-700', weak ? 'bg-coral-500' : 'bg-brand-600')}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    {m.transactions.toLocaleString('en-IN')} transactions · {m.description}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}
