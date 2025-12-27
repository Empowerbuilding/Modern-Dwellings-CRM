import { supabase } from '@/lib/supabase'
import type { Deal, Activity, PipelineStage, SalesType } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface PipelineStats {
  b2c: { count: number; value: number }
  b2b: { count: number; value: number }
  total: { count: number; value: number }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

async function getPipelineStats(): Promise<PipelineStats> {
  const { data: deals } = await (supabase.from('deals') as any)
    .select('stage, value, sales_type')

  if (!deals) {
    return {
      b2c: { count: 0, value: 0 },
      b2b: { count: 0, value: 0 },
      total: { count: 0, value: 0 },
    }
  }

  // Only count open deals (not complete or lost)
  const openDeals = deals.filter(
    (d: any) => d.stage !== 'complete' && d.stage !== 'lost'
  )

  const b2cDeals = openDeals.filter((d: any) => d.sales_type === 'b2c')
  const b2bDeals = openDeals.filter((d: any) => d.sales_type === 'b2b')

  return {
    b2c: {
      count: b2cDeals.length,
      value: b2cDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
    },
    b2b: {
      count: b2bDeals.length,
      value: b2bDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
    },
    total: {
      count: openDeals.length,
      value: openDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
    },
  }
}

async function getRecentDeals(): Promise<(Deal & { company_name?: string })[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('*, companies(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data) return []

  return data.map((deal: any) => ({
    ...deal,
    company_name: deal.companies?.name,
  }))
}

async function getUpcomingTasks(): Promise<(Activity & { contact_name?: string })[]> {
  const { data } = await (supabase.from('activities') as any)
    .select('*, contacts(first_name, last_name)')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(5)

  if (!data) return []

  return data.map((activity: any) => ({
    ...activity,
    contact_name: activity.contacts
      ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
      : undefined,
  }))
}

export default async function Dashboard() {
  const [pipelineStats, recentDeals, upcomingTasks] = await Promise.all([
    getPipelineStats(),
    getRecentDeals(),
    getUpcomingTasks(),
  ])

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto pt-12 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">Dashboard</h1>

        {/* Pipeline Summary */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Pipeline Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* B2C Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h3 className="font-medium text-gray-900">B2C Consumer</h3>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(pipelineStats.b2c.value)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {pipelineStats.b2c.count} active deals
              </p>
            </div>

            {/* B2B Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-medium text-gray-900">B2B Builder</h3>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(pipelineStats.b2b.value)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {pipelineStats.b2b.count} active deals
              </p>
            </div>

            {/* Total Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-medium">Total Pipeline</h3>
              </div>
              <p className="text-2xl font-semibold">
                {formatCurrency(pipelineStats.total.value)}
              </p>
              <p className="text-sm text-slate-300 mt-1">
                {pipelineStats.total.count} active deals
              </p>
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Recent Deals */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Deals</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {recentDeals.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No deals yet</p>
              ) : (
                recentDeals.map((deal) => (
                  <div key={deal.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {deal.company_name && (
                            <span className="text-sm text-gray-500">{deal.company_name}</span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            deal.sales_type === 'b2c'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {deal.sales_type === 'b2c' ? 'B2C' : 'B2B'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {deal.value ? formatCurrency(deal.value) : '-'}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${STAGE_COLORS[deal.stage]}`}
                        >
                          {STAGE_LABELS[deal.stage]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Upcoming Tasks */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming Tasks</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {upcomingTasks.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No upcoming tasks</p>
              ) : (
                upcomingTasks.map((task) => (
                  <div key={task.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.contact_name && (
                          <p className="text-sm text-gray-500">{task.contact_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {task.due_date && formatDate(task.due_date)}
                        </p>
                        <span className="text-xs font-medium text-gray-600 capitalize">
                          {task.type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
