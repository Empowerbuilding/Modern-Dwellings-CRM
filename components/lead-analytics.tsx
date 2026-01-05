'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

export interface LeadData {
  id: string
  lead_source: string | null
  created_at: string
  lifecycle_stage: string | null
}

interface LeadAnalyticsProps {
  leads: LeadData[]
}

type TimePeriod = '7d' | '30d' | '90d' | '12m'

const SOURCE_COLORS: Record<string, string> = {
  facebook_lead_ad: '#1877F2',
  cost_calc: '#10B981',
  guide_download: '#8B5CF6',
  referral: '#F59E0B',
  barnhaus_contact: '#EF4444',
  barnhaus_store_contact: '#EC4899',
  shopify_order: '#96BF48',
  calendar_booking: '#06B6D4',
  empower_website: '#6366F1',
  other: '#6B7280',
}

const SOURCE_LABELS: Record<string, string> = {
  facebook_lead_ad: 'Facebook Lead Ad',
  cost_calc: 'Cost Calculator',
  guide_download: 'Guide Download',
  referral: 'Referral',
  barnhaus_contact: 'Barnhaus Contact',
  barnhaus_store_contact: 'Barnhaus Store',
  shopify_order: 'Shopify Order',
  calendar_booking: 'Calendar Booking',
  empower_website: 'Empower Website',
  other: 'Other',
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '12m', label: 'Last 12 Months' },
]

function getDateRange(period: TimePeriod): Date {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7))
    case '30d':
      return new Date(now.setDate(now.getDate() - 30))
    case '90d':
      return new Date(now.setDate(now.getDate() - 90))
    case '12m':
      return new Date(now.setFullYear(now.getFullYear() - 1))
  }
}

function formatDateKey(date: Date, period: TimePeriod): string {
  if (period === '12m') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  } else if (period === '90d') {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

export default function LeadAnalytics({ leads }: LeadAnalyticsProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')

  const filteredLeads = useMemo(() => {
    const cutoffDate = getDateRange(timePeriod)
    return leads.filter((lead) => new Date(lead.created_at) >= cutoffDate)
  }, [leads, timePeriod])

  const barChartData = useMemo(() => {
    const cutoffDate = getDateRange(timePeriod)
    const now = new Date()
    const dataMap = new Map<string, number>()

    // Initialize all date buckets
    if (timePeriod === '12m') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        dataMap.set(key, 0)
      }
    } else if (timePeriod === '90d') {
      for (let i = 12; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i * 7)
        d.setDate(d.getDate() - d.getDay())
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        dataMap.set(key, 0)
      }
    } else {
      const days = timePeriod === '7d' ? 7 : 30
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        dataMap.set(key, 0)
      }
    }

    // Count leads per bucket
    filteredLeads.forEach((lead) => {
      const date = new Date(lead.created_at)
      const key = formatDateKey(date, timePeriod)
      if (dataMap.has(key)) {
        dataMap.set(key, (dataMap.get(key) || 0) + 1)
      }
    })

    return Array.from(dataMap.entries()).map(([date, count]) => ({
      date,
      leads: count,
    }))
  }, [filteredLeads, timePeriod])

  const pieChartData = useMemo(() => {
    const sourceCount = new Map<string, number>()
    filteredLeads.forEach((lead) => {
      const source = lead.lead_source || 'other'
      sourceCount.set(source, (sourceCount.get(source) || 0) + 1)
    })

    return Array.from(sourceCount.entries())
      .map(([source, count]) => ({
        name: source,
        label: SOURCE_LABELS[source] || source,
        value: count,
        color: SOURCE_COLORS[source] || SOURCE_COLORS.other,
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  const stats = useMemo(() => {
    const totalLeads = filteredLeads.length
    const converted = filteredLeads.filter(
      (l) => l.lifecycle_stage && l.lifecycle_stage !== 'subscriber'
    ).length
    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0

    const sourceCounts = new Map<string, number>()
    filteredLeads.forEach((lead) => {
      const source = lead.lead_source || 'other'
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)
    })

    const topSource =
      Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    const activeChannels = sourceCounts.size

    return {
      totalLeads,
      topSource: SOURCE_LABELS[topSource] || topSource,
      activeChannels,
      conversionRate: conversionRate.toFixed(1),
    }
  }, [filteredLeads])

  const sourceBreakdown = useMemo(() => {
    const total = filteredLeads.length
    return pieChartData.map((item) => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0',
    }))
  }, [pieChartData, filteredLeads.length])

  return (
    <section className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-medium text-gray-900">Lead Analytics</h2>
        <div className="flex flex-wrap gap-2">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setTimePeriod(period.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timePeriod === period.value
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Leads</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.totalLeads}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Top Source</p>
          <p className="text-lg font-semibold text-gray-900 mt-1 truncate">{stats.topSource}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active Channels</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.activeChannels}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Conversion Rate</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.conversionRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Leads Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={timePeriod === '12m' ? 1 : timePeriod === '90d' ? 1 : 'preserveStartEnd'}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="leads" fill="#334155" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Lead Sources</h3>
          <div className="h-64 flex items-center justify-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      value,
                      (props as any).payload.label,
                    ]}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Source Breakdown Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Source Breakdown</h3>
        <div className="space-y-3">
          {sourceBreakdown.length > 0 ? (
            sourceBreakdown.map((source) => (
              <div key={source.name} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: source.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate">{source.label}</span>
                    <span className="text-gray-500 ml-2">
                      {source.value} ({source.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${source.percentage}%`,
                        backgroundColor: source.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No leads in selected period</p>
          )}
        </div>
      </div>
    </section>
  )
}
