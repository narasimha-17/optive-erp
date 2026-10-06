import { ArrowRight, Sparkles } from 'lucide-react'
import { iconFor } from '../lib/icons'
import type { Insight } from '../types'
import { useToast } from './ui/primitives'

export function InsightCard({ insights }: { insights: Insight[] }) {
  const notify = useToast()
  return (
    <section className="flex h-full flex-col rounded-card border border-brand-100 bg-brand-50/70 p-5">
      <header className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-brand-600 shadow-card">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">AI business insights</h2>
          <p className="text-[12px] text-ink-muted">Generated from the last 30 days</p>
        </div>
      </header>

      <ul className="mt-4 flex-1 space-y-3">
        {insights.map(item => {
          const Icon = iconFor(item.icon)
          return (
            <li key={item.id} className="rounded-lg border border-brand-100 bg-white p-3.5 transition-shadow hover:shadow-card">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[13px] font-medium leading-snug">{item.title}</p>
                  <p className="mt-1 text-[12px] leading-snug text-ink-muted">{item.body}</p>
                  <button
                    type="button"
                    onClick={() => notify(`${item.action} opens in a new view`)}
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline"
                  >
                    {item.action} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
