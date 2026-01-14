import { supabase } from '@/lib/supabase'
import type { Deal, Activity, PipelineStage, SalesType } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS, isB2CWonStage } from '@/lib/types'
import LeadAnalytics, { type LeadData } from '@/components/lead-analytics'

export const dynamic = 'force-dynamic'

interface PipelineStats {
  b2c: {
    pipeline: { count: number; value: number }
    closed: { count: number; value: number }
  }
  b2b: {
    pipeline: { count: number; value: number }
    closed: { count: number; value: number }
  }
  totals: {
    pipeline: { count: number; value: number }
    closed: { count: number; value: number }
  }
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
      b2c: {
        pipeline: { count: 0, value: 0 },
        closed: { count: 0, value: 0 },
      },
      b2b: {
        pipeline: { count: 0, value: 0 },
        closed: { count: 0, value: 0 },
      },
      totals: {
        pipeline: { count: 0, value: 0 },
        closed: { count: 0, value: 0 },
      },
    }
  }

  // B2C Pipeline: qualified stage (potential deals)
  const b2cPipeline = deals.filter(
    (d: any) => d.sales_type === 'b2c' && d.stage === 'qualified'
  )
  // B2C Closed: concept, design, engineering (won but still in work)
  const b2cClosed = deals.filter(
    (d: any) => d.sales_type === 'b2c' && ['concept', 'design', 'engineering'].includes(d.stage)
  )

  // B2B Pipeline: qualified and proposal stages (potential deals)
  const b2bPipeline = deals.filter(
    (d: any) => d.sales_type === 'b2b' && ['qualified', 'proposal'].includes(d.stage)
  )
  // B2B Closed: active stage (won but still in work)
  const b2bClosed = deals.filter(
    (d: any) => d.sales_type === 'b2b' && d.stage === 'active'
  )

  const sumValue = (arr: any[]) => arr.reduce((sum: number, d: any) => sum + (d.value || 0), 0)

  return {
    b2c: {
      pipeline: { count: b2cPipeline.length, value: sumValue(b2cPipeline) },
      closed: { count: b2cClosed.length, value: sumValue(b2cClosed) },
    },
    b2b: {
      pipeline: { count: b2bPipeline.length, value: sumValue(b2bPipeline) },
      closed: { count: b2bClosed.length, value: sumValue(b2bClosed) },
    },
    totals: {
      pipeline: {
        count: b2cPipeline.length + b2bPipeline.length,
        value: sumValue(b2cPipeline) + sumValue(b2bPipeline),
      },
      closed: {
        count: b2cClosed.length + b2bClosed.length,
        value: sumValue(b2cClosed) + sumValue(b2bClosed),
      },
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

async function getRecentActivities(): Promise<(Activity & { contact_name?: string; user_name?: string })[]> {
  const { data } = await (supabase.from('activities') as any)
    .select('*, contacts(first_name, last_name), user:user_id(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data) return []

  return data.map((activity: any) => ({
    ...activity,
    contact_name: activity.contacts
      ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
      : undefined,
    user_name: activity.user?.name,
  }))
}

async function getLeadData(): Promise<LeadData[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const { data } = await (supabase.from('contacts') as any)
    .select('id, lead_source, created_at, lifecycle_stage')
    .gte('created_at', twelveMonthsAgo.toISOString())
    .order('created_at', { ascending: false })

  return data || []
}

export default async function Dashboard() {
  const [pipelineStats, recentDeals, recentActivities, leadData] = await Promise.all([
    getPipelineStats(),
    getRecentDeals(),
    getRecentActivities(),
    getLeadData(),
  ])

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto pt-12 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">Dashboard</h1>

        {/* Pipeline Summary */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Pipeline Overview</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* B2C Consumer Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h3 className="font-medium text-gray-900">B2C Consumer</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Pipeline */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pipeline</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(pipelineStats.b2c.pipeline.value)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {pipelineStats.b2c.pipeline.count} {pipelineStats.b2c.pipeline.count === 1 ? 'deal' : 'deals'}
                  </p>
                </div>
                {/* Closed */}
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Closed</p>
                  <p className="text-xl font-semibold text-green-900">
                    {formatCurrency(pipelineStats.b2c.closed.value)}
                  </p>
                  <p className="text-sm text-green-700">
                    {pipelineStats.b2c.closed.count} {pipelineStats.b2c.closed.count === 1 ? 'deal' : 'deals'}
                  </p>
                </div>
              </div>
            </div>

            {/* B2B Builder Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-medium text-gray-900">B2B Builder</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Pipeline */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pipeline</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(pipelineStats.b2b.pipeline.value)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {pipelineStats.b2b.pipeline.count} {pipelineStats.b2b.pipeline.count === 1 ? 'deal' : 'deals'}
                  </p>
                </div>
                {/* Closed */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Closed</p>
                  <p className="text-xl font-semibold text-blue-900">
                    {formatCurrency(pipelineStats.b2b.closed.value)}
                  </p>
                  <p className="text-sm text-blue-700">
                    {pipelineStats.b2b.closed.count} {pipelineStats.b2b.closed.count === 1 ? 'deal' : 'deals'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Totals Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 text-white">
              <p className="text-xs font-medium text-slate-300 uppercase tracking-wide mb-1">Total Pipeline</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(pipelineStats.totals.pipeline.value)}
              </p>
              <p className="text-sm text-slate-300">
                {pipelineStats.totals.pipeline.count} {pipelineStats.totals.pipeline.count === 1 ? 'deal' : 'deals'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg p-4 text-white">
              <p className="text-xs font-medium text-emerald-200 uppercase tracking-wide mb-1">Total Closed</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(pipelineStats.totals.closed.value)}
              </p>
              <p className="text-sm text-emerald-200">
                {pipelineStats.totals.closed.count} {pipelineStats.totals.closed.count === 1 ? 'deal' : 'deals'}
              </p>
            </div>
          </div>
        </section>

        {/* Lead Analytics */}
        <LeadAnalytics leads={leadData} />

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

          {/* Recent Activities */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {recentActivities.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No recent activity</p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{activity.title}</p>
                        {activity.contact_name && (
                          <p className="text-sm text-gray-500">{activity.contact_name}</p>
                        )}
                        {activity.user_name && (
                          <p className="text-xs text-gray-400">by {activity.user_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {formatDate(activity.created_at)}
                        </p>
                        <span className="text-xs font-medium text-gray-600 capitalize">
                          {activity.activity_type.replace('_', ' ')}
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
