import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { ActivityPoint, Range } from '../types'
import { SectionCard, cn } from './ui/primitives'

const ranges: { id: Range; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
]

type Series = 'invoiced' | 'collected' | 'overdue'
const seriesMeta: Record<Series, { label: string; color: string }> = {
  invoiced: { label: 'Invoiced', color: '#bdb0f5' },
  collected: { label: 'Collected', color: '#5b43c9' },
  overdue: { label: 'Overdue', color: '#f0685b' },
}

const H = 280
const PAD = { l: 46, r: 12, t: 14, b: 30 }
const money = (n: number) =>
  n >= 10_000_000 ? `₹${+(n / 10_000_000).toFixed(2)}Cr` : n >= 100_000 ? `₹${+(n / 100_000).toFixed(1)}L` : n >= 1000 ? `₹${+(n / 1000).toFixed(0)}K` : `₹${n}`
const axis = (n: number) => (n === 0 ? '0' : n >= 100_000 ? `${+(n / 100_000).toFixed(1)}L` : `${+(n / 1000).toFixed(0)}K`)

function niceMax(v: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * pow
}

function useWidth<T extends HTMLElement>(ready: boolean) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ready])
  return [ref, w] as const
}

export function ActivityChart() {
  const [range, setRange] = useState<Range>('30d')
  const [hidden, setHidden] = useState<Set<Series>>(new Set())
  const [hover, setHover] = useState<number | null>(null)
  const [data, setData] = useState<ActivityPoint[]>([])
  const [wrapRef, width] = useWidth<HTMLDivElement>(data.length > 0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setFailed(false)
    api<ActivityPoint[]>(`/dashboard/activity?range=${range}`)
      .then(rows => live && setData(rows))
      .catch(() => live && setFailed(true))
    return () => { live = false }
  }, [range])

  const totals = useMemo(() => {
    const inv = data.reduce((a, d) => a + d.invoiced, 0)
    const ok = data.reduce((a, d) => a + d.collected, 0)
    const bad = data.reduce((a, d) => a + d.overdue, 0)
    return { inv, ok, bad, rate: inv ? (ok / inv) * 100 : 0 }
  }, [data])

  if (!data.length) {
    return (
      <SectionCard title="Revenue & collections" subtitle="Invoiced, collected and overdue amounts" className="h-full">
        <div className="flex h-[360px] items-center justify-center text-[13px] text-ink-muted">{failed ? 'Could not load activity data.' : 'Loading activity…'}</div>
      </SectionCard>
    )
  }
  const innerW = width - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const maxY = niceMax(Math.max(...data.map(d => d.invoiced)) * 1.04)
  const y = (v: number) => PAD.t + innerH - (v / maxY) * innerH
  const colW = innerW / data.length
  const barW = Math.max(4, Math.min(colW * 0.56, 30))
  const cx = (i: number) => PAD.l + colW * i + colW / 2
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * maxY)
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64)))

  const linePath = data.map((d, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(d.invoiced).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${cx(data.length - 1).toFixed(1)},${y(0)} L${cx(0).toFixed(1)},${y(0)} Z`

  const toggle = (s: Series) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else if (next.size < 2) next.add(s)
      return next
    })

  const active = hover !== null ? data[hover] : null
  const tipLeft = hover !== null ? Math.min(Math.max(cx(hover), 96), width - 96) : 0

  return (
    <SectionCard
      title="Revenue & collections"
      subtitle="Invoiced, collected and overdue amounts"
      className="h-full"
      action={
        <div role="tablist" aria-label="Time range" className="flex rounded-lg border border-line bg-canvas p-0.5">
          {ranges.map(r => (
            <button
              key={r.id}
              role="tab"
              type="button"
              aria-selected={range === r.id}
              onClick={() => { setRange(r.id); setHover(null) }}
              className={cn(
                'rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors',
                range === r.id ? 'bg-white text-brand-700 shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3 border-b border-line pb-4 sm:flex sm:gap-10">
        <div>
          <p className="text-[12px] text-ink-muted">Total invoiced</p>
          <p className="text-[20px] font-semibold tracking-tight">{money(totals.inv)}</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-muted">Collection rate</p>
          <p className="text-[20px] font-semibold tracking-tight">{totals.rate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-muted">Overdue</p>
          <p className="text-[20px] font-semibold tracking-tight text-coral-600">{money(totals.bad)}</p>
        </div>
        <div className="col-span-3 flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto sm:justify-end">
          {(Object.keys(seriesMeta) as Series[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={!hidden.has(s)}
              className={cn('flex items-center gap-1.5 text-[12px] transition-opacity', hidden.has(s) ? 'opacity-40' : 'text-ink-soft')}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesMeta[s].color }} />
              {seriesMeta[s].label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative mt-4">
        <svg width={width} height={H} role="img" aria-label="Revenue and collections chart" onMouseLeave={() => setHover(null)} className="block select-none">
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="#ececf3" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9a9cae">
                {axis(t)}
              </text>
            </g>
          ))}

          {!hidden.has('invoiced') && (
            <>
              <path d={areaPath} fill="#bdb0f5" opacity=".18" />
              <path d={linePath} fill="none" stroke="#9d89ee" strokeWidth="1.8" strokeLinejoin="round" />
            </>
          )}

          {data.map((d, i) => {
            const showOk = !hidden.has('collected')
            const showBad = !hidden.has('overdue')
            const okH = showOk ? y(0) - y(d.collected) : 0
            const badH = showBad ? Math.max(3, y(0) - y(d.overdue)) : 0
            const x = cx(i) - barW / 2
            const dim = hover !== null && hover !== i
            return (
              <g key={i} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity .12s' }}>
                {showOk && <rect x={x} y={y(0) - okH} width={barW} height={okH} rx={3} fill="#5b43c9" />}
                {showBad && <rect x={x} y={y(0) - okH - badH - (showOk ? 1.5 : 0)} width={barW} height={badH} rx={2} fill="#f0685b" />}
              </g>
            )
          })}

          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.label} x={cx(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={hover === i ? '#14141f' : '#9a9cae'}>
                {d.label}
              </text>
            ) : null,
          )}

          {hover !== null && <line x1={cx(hover)} x2={cx(hover)} y1={PAD.t} y2={y(0)} stroke="#9d89ee" strokeDasharray="3 3" />}

          {data.map((_, i) => (
            <rect
              key={i}
              x={PAD.l + colW * i}
              y={PAD.t}
              width={colW}
              height={innerH + PAD.b}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseMove={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-[190px] -translate-x-1/2 rounded-lg border border-line bg-white p-3 shadow-pop"
            style={{ left: tipLeft }}
          >
            <p className="text-[12px] font-semibold">{active.title}</p>
            <dl className="mt-2 space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-sm bg-brand-300" />Invoiced</dt>
                <dd className="font-medium">{money(active.invoiced)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-sm bg-brand-600" />Collected</dt>
                <dd className="font-medium">{money(active.collected)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-sm bg-coral-500" />Overdue</dt>
                <dd className="font-medium">{money(active.overdue)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-1.5">
                <dt className="text-ink-muted">Collection rate</dt>
                <dd className="font-semibold text-brand-700">{((active.collected / active.invoiced) * 100).toFixed(1)}%</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
