'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UpcomingMeetings, ScheduledMeetingDisplay } from '@/components/calendar/UpcomingMeetings'

type FilterStatus = 'all' | 'scheduled' | 'completed' | 'cancelled'
type TimeFilter = 'all' | 'upcoming' | 'past'

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<ScheduledMeetingDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming')

  useEffect(() => {
    async function loadMeetings() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', '50')

        if (statusFilter !== 'all') {
          params.set('status', statusFilter)
        }

        if (timeFilter === 'upcoming') {
          params.set('upcoming', 'true')
        } else if (timeFilter === 'past') {
          params.set('past', 'true')
        }

        const res = await fetch(`/api/meetings?${params.toString()}`)
        const data = await res.json()

        if (res.ok) {
          setMeetings(data.meetings || [])
        }
      } catch (err) {
        console.error('Failed to load meetings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMeetings()
  }, [statusFilter, timeFilter])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pt-14 md:pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Meetings</h1>
            <p className="text-sm text-gray-500 mt-1">
              View and manage your scheduled meetings
            </p>
          </div>
          <Link
            href="/settings/calendar"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Calendar Settings
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Time filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Time</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {(['upcoming', 'past', 'all'] as TimeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    } ${filter !== 'upcoming' ? 'border-l border-gray-300' : ''}`}
                  >
                    {filter === 'upcoming' ? 'Upcoming' : filter === 'past' ? 'Past' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Results count */}
            <div className="flex items-end ml-auto">
              <span className="text-sm text-gray-500">
                {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Meetings list */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <UpcomingMeetings
              meetings={meetings}
              showContact={true}
              emptyMessage={
                timeFilter === 'upcoming'
                  ? 'No upcoming meetings'
                  : timeFilter === 'past'
                  ? 'No past meetings'
                  : 'No meetings found'
              }
            />
          )}
        </div>
      </div>
    </main>
  )
}
