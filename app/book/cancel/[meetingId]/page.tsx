'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface MeetingDetails {
  id: string
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  start_time: string
  end_time: string
  timezone: string
  status: string
  meeting_type: {
    title: string
    slug: string
  } | null
  host: {
    name: string
  } | null
}

type PageState = 'loading' | 'ready' | 'cancelling' | 'cancelled' | 'error' | 'already_cancelled' | 'not_found'

function formatDateTime(isoString: string, timezone: string): { date: string; time: string } {
  const date = new Date(isoString)
  return {
    date: date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }),
  }
}

function getTimezoneAbbreviation(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(new Date())
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    return tzPart?.value || timezone
  } catch {
    return timezone
  }
}

export default function CancelMeetingPage() {
  const params = useParams()
  const meetingId = params.meetingId as string

  const [meeting, setMeeting] = useState<MeetingDetails | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadMeeting() {
      try {
        const res = await fetch(`/api/calendar/meetings/${meetingId}`)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 404) {
            setPageState('not_found')
          } else {
            setErrorMessage(data.error || 'Failed to load meeting')
            setPageState('error')
          }
          return
        }

        const meetingData = data.meeting as MeetingDetails

        if (meetingData.status === 'cancelled') {
          setMeeting(meetingData)
          setPageState('already_cancelled')
          return
        }

        setMeeting(meetingData)
        setPageState('ready')
      } catch (err) {
        console.error('Failed to load meeting:', err)
        setErrorMessage('Failed to load meeting details')
        setPageState('error')
      }
    }

    loadMeeting()
  }, [meetingId])

  async function handleCancel() {
    setPageState('cancelling')

    try {
      const res = await fetch(`/api/calendar/meetings/${meetingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel meeting')
      }

      setPageState('cancelled')
    } catch (err) {
      console.error('Failed to cancel meeting:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to cancel meeting')
      setPageState('error')
    }
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading meeting details...</p>
        </div>
      </main>
    )
  }

  // Not found state
  if (pageState === 'not_found') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Meeting Not Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t find this meeting. It may have been deleted or the link is invalid.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Home
          </Link>
        </div>
      </main>
    )
  }

  // Already cancelled state
  if (pageState === 'already_cancelled' && meeting) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Already Cancelled</h1>
          <p className="text-gray-600 mb-6">
            This meeting has already been cancelled.
          </p>
          {meeting.meeting_type?.slug && (
            <Link
              href={`/book/${meeting.meeting_type.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Book a New Meeting
            </Link>
          )}
        </div>
      </main>
    )
  }

  // Error state
  if (pageState === 'error') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something Went Wrong</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  // Cancelled success state
  if (pageState === 'cancelled') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Meeting Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your meeting has been cancelled. The host has been notified.
          </p>
          {meeting?.meeting_type?.slug && (
            <Link
              href={`/book/${meeting.meeting_type.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Book a New Meeting
            </Link>
          )}
        </div>
      </main>
    )
  }

  // Ready state - show cancel form
  if (!meeting) return null

  const { date, time } = formatDateTime(meeting.start_time, meeting.timezone)
  const tzAbbrev = getTimezoneAbbreviation(meeting.timezone)

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Cancel Your Meeting</h1>
          <p className="text-gray-600">
            Are you sure you want to cancel this meeting?
          </p>
        </div>

        {/* Meeting Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {meeting.meeting_type?.title || 'Meeting'}
          </h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">{date}</p>
                <p className="text-gray-600">{time} {tzAbbrev}</p>
              </div>
            </div>

            {meeting.host?.name && (
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-gray-900">{meeting.host.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Reason Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Let us know why (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
            placeholder="e.g., Schedule conflict, no longer needed..."
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleCancel}
            disabled={pageState === 'cancelling'}
            className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {pageState === 'cancelling' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cancelling...
              </>
            ) : (
              'Cancel Meeting'
            )}
          </button>

          <Link
            href={meeting.meeting_type?.slug ? `/book/${meeting.meeting_type.slug}` : '/'}
            className="block w-full text-center px-4 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
          >
            Never mind, keep it
          </Link>
        </div>
      </div>
    </main>
  )
}
