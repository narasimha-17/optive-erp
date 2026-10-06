import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { iconFor } from '../lib/icons'
import type { Kpi } from '../types'
import { cn } from './ui/primitives'

function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const w = 96
  const h = 28
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-24" aria-hidden="true">
      <path d={area} fill={tone} opacity=".1" />
      <path d={line} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCard({ kpi }: { kpi: Kpi }) {
  const Icon = iconFor(kpi.icon)
  return (
    <article className="card group flex flex-col p-4 transition-shadow hover:shadow-pop">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
          </span>
          <h3 className="text-[13px] font-medium text-ink-soft">{kpi.label}</h3>
        </div>
        <button
          type="button"
          aria-label={`Open ${kpi.label}`}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-ink-faint transition-colors group-hover:border-brand-200 group-hover:bg-brand-50 group-hover:text-brand-700"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-[28px] font-semibold leading-none tracking-tight">{kpi.value}</p>
        <Sparkline data={kpi.spark} tone={kpi.good ? '#5b43c9' : '#f0685b'} />
      </div>

      <footer className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted">
        <span className={cn('chip px-1.5', kpi.good ? 'bg-ok-50 text-ok-600' : 'bg-coral-50 text-coral-600')}>
          {kpi.direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {kpi.delta.replace(/^[+-]/, '')}
        </span>
        <span className="truncate">{kpi.note}</span>
      </footer>
    </article>
  )
}
