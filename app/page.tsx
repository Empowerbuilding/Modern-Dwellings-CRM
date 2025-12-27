import { supabase } from '@/lib/supabase'
import type { Deal, Activity, PipelineStage, PipelineSummary } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STAGE_ORDER: PipelineStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

const STAGE_COLORS: Record<PipelineStage, string> = {
  lead: 'bg-gray-100 text-gray-800',
  qualified: 'bg-blue-100 text-blue-800',
  proposal: 'bg-yellow-100 text-yellow-800',
  negotiation: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
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

async function getPipelineSummary(): Promise<PipelineSummary[]> {
  const { data: deals } = await supabase
    .from('deals')
    .select('stage, value')
    .returns<{ stage: PipelineStage; value: number | null }[]>()

  if (!deals) return []

  const summary = STAGE_ORDER.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    return {
      stage,
      count: stageDeals.length,
      total_value: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0),
    }
  })

  return summary
}

async function getRecentDeals(): Promise<(Deal & { company_name?: string })[]> {
  const { data } = await supabase
    .from('deals')
    .select('*, companies(name)')
    .order('created_at', { ascending: false })
    .limit(5)
    .returns<(Deal & { companies: { name: string } | null })[]>()

  if (!data) return []

  return data.map((deal) => ({
    ...deal,
    company_name: deal.companies?.name,
  }))
}

async function getUpcomingTasks(): Promise<(Activity & { contact_name?: string })[]> {
  const { data } = await supabase
    .from('activities')
    .select('*, contacts(first_name, last_name)')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(5)
    .returns<(Activity & { contacts: { first_name: string; last_name: string } | null })[]>()

  if (!data) return []

  return data.map((activity) => ({
    ...activity,
    contact_name: activity.contacts
      ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
      : undefined,
  }))
}

export default async function Dashboard() {
  const [pipeline, recentDeals, upcomingTasks] = await Promise.all([
    getPipelineSummary(),
    getRecentDeals(),
    getUpcomingTasks(),
  ])

  const activePipelineValue = pipeline
    .filter((p) => p.stage !== 'won' && p.stage !== 'lost')
    .reduce((sum, p) => sum + p.total_value, 0)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Dashboard</h1>

        {/* Pipeline Summary */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Pipeline</h2>
            <span className="text-sm text-gray-500">
              Active: {formatCurrency(activePipelineValue)}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {pipeline.map((stage) => (
              <div
                key={stage.stage}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded capitalize ${STAGE_COLORS[stage.stage]}`}
                  >
                    {stage.stage}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {stage.count}
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(stage.total_value)}
                </p>
              </div>
            ))}
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
                        {deal.company_name && (
                          <p className="text-sm text-gray-500">{deal.company_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {deal.value ? formatCurrency(deal.value) : '-'}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${STAGE_COLORS[deal.stage]}`}
                        >
                          {deal.stage}
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
