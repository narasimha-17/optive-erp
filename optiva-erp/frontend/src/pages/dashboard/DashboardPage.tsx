import { ArrowRight, BarChart3, Plus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { ActivityChart } from '../../components/ActivityChart'
import { ActivityFeed } from '../../components/ActivityFeed'
import { AddonCard } from '../../components/AddonCard'
import { InsightCard } from '../../components/InsightCard'
import { ModulePerformance } from '../../components/ModulePerformance'
import { RecentOrders } from '../../components/RecentOrders'
import { StatCard } from '../../components/StatCard'
import { WorkflowCard } from '../../components/WorkflowCard'
import { cn, useToast } from '../../components/ui/primitives'
import type { ShellContext } from '../../layouts/AppShell'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const formatDate = (d: Date) =>
  `${d.toLocaleDateString('en-US', { weekday: 'long' })}, ${ordinal(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'long' })}`

const greeting = (d: Date) => {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Skeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[132px] rounded-card border border-line bg-white" />
        ))}
      </div>
      <div className="h-[420px] rounded-card border border-line bg-white" />
    </div>
  )
}

export default function DashboardPage() {
  const notify = useToast()
  const { user, data, error, reload, go } = useOutletContext<ShellContext>()
  const now = new Date()

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-ink-muted">{formatDate(now)}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[28px]">
            {greeting(now)}, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">Here’s what’s happening across {user.company} today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary h-10" onClick={() => go('reports')}>
            <BarChart3 className="h-4 w-4" /> View reports
          </button>
          <button type="button" className="btn-primary h-10" onClick={() => notify('New sales order form opens here')}>
            <Plus className="h-4 w-4" /> New order
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-coral-100 bg-coral-50 px-4 py-3 text-[13px] text-coral-600">
          {error}
          <button type="button" className="btn-secondary h-8" onClick={reload}>Try again</button>
        </div>
      )}

      {!data && !error && <Skeleton />}

      {data && (
        <>
          <section aria-label="Key metrics" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {data.kpis.map((k, i) => (
              <div key={k.id} className={cn(i === data.kpis.length - 1 && 'col-span-2 md:col-span-1')}>
                <StatCard kpi={k} />
              </div>
            ))}
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <ActivityChart />
            </div>
            <ModulePerformance modules={data.performance} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <RecentOrders orders={data.orders} />
            </div>
            <ActivityFeed events={data.feed} />
          </div>

          <div className="mt-8 flex items-end justify-between">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Automations</h2>
              <p className="text-[13px] text-ink-muted">Workflows that run on a trigger across your modules</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => go('automations')}>
              All automations <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 space-y-4 xl:col-span-2">
              {data.workflows.map(w => (
                <WorkflowCard key={w.id} workflow={w} />
              ))}
            </div>
            <InsightCard insights={data.insights} />
          </div>

          <div className="mt-8 flex items-end justify-between">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Discover modules</h2>
              <p className="text-[13px] text-ink-muted">Extend Optiva ERP with add-on modules</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => go('integrations')}>
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.addons.map(a => (
              <AddonCard key={a.id} addon={a} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
