import { iconFor } from '../lib/icons'
import type { FeedEvent } from '../types'
import { SectionCard, cn, toneStyle } from './ui/primitives'

export function ActivityFeed({ events }: { events: FeedEvent[] }) {
  return (
    <SectionCard
      title="Recent activity"
      subtitle="Updates from across your modules"
      className="h-full"
      action={<button type="button" className="btn-ghost h-8 px-2.5">View all</button>}
    >
      <ol className="relative">
        {events.map((e, i) => {
          const Icon = iconFor(e.icon)
          return (
            <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
              {i < events.length - 1 && <span aria-hidden="true" className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-line" />}
              <span className={cn('z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', toneStyle[e.tone])}>
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-snug">{e.title}</p>
                  <time className="shrink-0 pt-0.5 text-[11.5px] text-ink-faint">{e.time}</time>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{e.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}
