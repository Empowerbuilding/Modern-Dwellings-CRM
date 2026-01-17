'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UpcomingMeetings, ScheduledMeetingDisplay } from '@/components/calendar/UpcomingMeetings'

interface ContactMeetingsSectionProps {
  contactId: string
}

export function ContactMeetingsSection({ contactId }: ContactMeetingsSectionProps) {
  const [upcomingMeetings, setUpcomingMeetings] = useState<ScheduledMeetingDisplay[]>([])
  const [pastMeetings, setPastMeetings] = useState<ScheduledMeetingDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    async function loadMeetings() {
      setLoading(true)
      try {
        const [upcomingRes, pastRes] = await Promise.all([
          fetch(`/api/meetings?contactId=${contactId}&upcoming=true&limit=10`),
          fetch(`/api/meetings?contactId=${contactId}&past=true&limit=10`),
        ])

        const [upcomingData, pastData] = await Promise.all([
          upcomingRes.json(),
          pastRes.json(),
        ])

        if (upcomingRes.ok) {
          setUpcomingMeetings(upcomingData.meetings || [])
        }
        if (pastRes.ok) {
          setPastMeetings(pastData.meetings || [])
        }
      } catch (err) {
        console.error('Failed to load meetings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMeetings()
  }, [contactId])

  const totalMeetings = upcomingMeetings.length + pastMeetings.length

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-gray-900">
          Meetings
          {!loading && totalMeetings > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({totalMeetings})
            </span>
          )}
        </h2>
        <Link
          href="/settings/calendar"
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          Schedule
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : totalMeetings === 0 ? (
        <div className="text-center py-6">
          <svg
            className="w-10 h-10 mx-auto text-gray-300 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-500">No meetings with this contact</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200 mb-4">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'upcoming'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Upcoming ({upcomingMeetings.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'past'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Past ({pastMeetings.length})
            </button>
          </div>

          {/* Meetings list */}
          <UpcomingMeetings
            meetings={activeTab === 'upcoming' ? upcomingMeetings : pastMeetings}
            compact={true}
            emptyMessage={
              activeTab === 'upcoming'
                ? 'No upcoming meetings'
                : 'No past meetings'
            }
          />
        </>
      )}
    </div>
  )
}
