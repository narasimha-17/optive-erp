export interface User {
  id: number
  name: string
  email: string
  company: string
  role: string
}

export type Tone = 'ok' | 'brand' | 'warn' | 'coral' | 'neutral'

export interface Kpi {
  id: string
  icon: string
  label: string
  value: string
  delta: string
  direction: 'up' | 'down'
  good: boolean
  note: string
  spark: number[]
}

export type Range = '7d' | '30d' | '90d'

export interface ActivityPoint {
  label: string
  title: string
  invoiced: number
  collected: number
  overdue: number
}

export interface ModuleScore {
  id: string
  name: string
  description: string
  score: number
  transactions: number
}

export type OrderStatus = 'Delivered' | 'Processing' | 'Awaiting payment' | 'On hold' | 'Paid'

export interface Order {
  id: string
  customer: string
  items: string
  amount: string
  status: OrderStatus
  date: string
}

export interface FeedEvent {
  id: string
  icon: string
  tone: Tone
  title: string
  detail: string
  time: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  trigger: string
  steps: string[]
  status: 'Running' | 'Paused'
  runsThisWeek: number
  success: string
  lastRun: string
}

export interface Insight {
  id: string
  icon: string
  title: string
  body: string
  action: string
}

export interface Addon {
  id: string
  name: string
  category: string
  icon: string
  description: string
  rating: number
  customers: string
  enabled: boolean
}

export interface Notice {
  id: string
  title: string
  time: string
  unread: boolean
}

export interface DashboardData {
  kpis: Kpi[]
  performance: ModuleScore[]
  orders: Order[]
  feed: FeedEvent[]
  workflows: Workflow[]
  insights: Insight[]
  addons: Addon[]
  notifications: Notice[]
}
