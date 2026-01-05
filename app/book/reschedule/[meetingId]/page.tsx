'use client'

import { useState, useEffect, useCallback } from 'react'
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
    id: string
    title: string
    slug: string
    duration_minutes: number
    description: string | null
    location_type: string
    brand_color: string
  } | null
  host: {
    name: string
  } | null
}

interface TimeSlot {
  start: string
  end: string
  startFormatted: string
  endFormatted: string
}

type PageState = 'loading' | 'calendar' | 'confirming' | 'rescheduling' | 'success' | 'error' | 'invalid'

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

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/Chicago'
  }
}

export default function RescheduleMeetingPage() {
  const params = useParams()
  const meetingId = params.meetingId as string

  const [meeting, setMeeting] = useState<MeetingDetails | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [invalidReason, setInvalidReason] = useState('')

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loadingDates, setLoadingDates] = useState(false)

  // Time slots state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  // User timezone
  const [timezone] = useState(getUserTimezone)

  // Load meeting details
  useEffect(() => {
    async function loadMeeting() {
      try {
        const res = await fetch(`/api/calendar/meetings/${meetingId}`)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 404) {
            setInvalidReason('Meeting not found')
            setPageState('invalid')
          } else {
            setErrorMessage(data.error || 'Failed to load meeting')
            setPageState('error')
          }
          return
        }

        const meetingData = data.meeting as MeetingDetails

        if (meetingData.status === 'cancelled') {
          setInvalidReason('This meeting has been cancelled')
          setPageState('invalid')
          return
        }

        if (meetingData.status === 'rescheduled') {
          setInvalidReason('This meeting has already been rescheduled')
          setPageState('invalid')
          return
        }

        if (!meetingData.meeting_type) {
          setInvalidReason('Meeting type no longer available')
          setPageState('invalid')
          return
        }

        setMeeting(meetingData)
        setPageState('calendar')
      } catch (err) {
        console.error('Failed to load meeting:', err)
        setErrorMessage('Failed to load meeting details')
        setPageState('error')
      }
    }

    loadMeeting()
  }, [meetingId])

  // Load available dates when month changes
  const loadAvailableDates = useCallback(async () => {
    if (!meeting?.meeting_type?.slug) return

    setLoadingDates(true)
    try {
      const year = currentMonth.getFullYear()
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0')
      const monthStr = `${year}-${month}` // API expects YYYY-MM format
      const res = await fetch(
        `/api/calendar/available-dates?slug=${meeting.meeting_type.slug}&month=${monthStr}&timezone=${encodeURIComponent(timezone)}`
      )
      const data = await res.json()

      if (res.ok) {
        setAvailableDates(data.dates || [])
      }
    } catch (err) {
      console.error('Failed to load available dates:', err)
    } finally {
      setLoadingDates(false)
    }
  }, [meeting?.meeting_type?.slug, currentMonth, timezone])

  useEffect(() => {
    if (pageState === 'calendar' && meeting?.meeting_type?.slug) {
      loadAvailableDates()
    }
  }, [pageState, meeting?.meeting_type?.slug, loadAvailableDates])

  // Load time slots when date is selected
  useEffect(() => {
    async function loadSlots() {
      if (!selectedDate || !meeting?.meeting_type?.slug) return

      setLoadingSlots(true)
      setTimeSlots([])
      setSelectedSlot(null)

      try {
        const dateStr = selectedDate.toISOString().split('T')[0]
        const res = await fetch(
          `/api/calendar/availability?slug=${meeting.meeting_type.slug}&date=${dateStr}&timezone=${encodeURIComponent(timezone)}`
        )
        const data = await res.json()

        if (res.ok) {
          setTimeSlots(data.slots || [])
        }
      } catch (err) {
        console.error('Failed to load time slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }

    loadSlots()
  }, [selectedDate, meeting?.meeting_type?.slug, timezone])

  async function handleReschedule() {
    if (!selectedSlot) return

    setPageState('rescheduling')

    try {
      const res = await fetch(`/api/calendar/meetings/${meetingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStartTime: selectedSlot.start,
          timezone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule meeting')
      }

      setPageState('success')
    } catch (err) {
      console.error('Failed to reschedule meeting:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reschedule meeting')
      setPageState('error')
    }
  }

  // Calendar helpers
  function getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []

    // Add padding for days before the first day
    const startPadding = firstDay.getDay()
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push(d)
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    // Add padding for days after the last day
    const endPadding = 6 - lastDay.getDay()
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }

  function isDateAvailable(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0]
    return availableDates.includes(dateStr)
  }

  function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear()
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === currentMonth.getMonth()
  }

  function formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading meeting details...</p>
        </div>
      </main>
    )
  }

  // Invalid state (not found, cancelled, already rescheduled)
  if (pageState === 'invalid') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Cannot Reschedule</h1>
          <p className="text-gray-600 mb-6">{invalidReason}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
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
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  // Success state
  if (pageState === 'success' && selectedSlot) {
    const newDateTime = formatDateTime(selectedSlot.start, timezone)
    const tzAbbrev = getTimezoneAbbreviation(timezone)

    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Meeting Rescheduled</h1>
          <p className="text-gray-600 mb-6">
            Your meeting has been rescheduled. A confirmation email has been sent.
          </p>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {meeting?.meeting_type?.title}
            </h2>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">{newDateTime.date}</p>
                <p className="text-gray-600">{newDateTime.time} {tzAbbrev}</p>
              </div>
            </div>
          </div>

          {meeting?.meeting_type?.slug && (
            <Link
              href={`/book/${meeting.meeting_type.slug}`}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Book another meeting
            </Link>
          )}
        </div>
      </main>
    )
  }

  if (!meeting) return null

  const currentDateTime = formatDateTime(meeting.start_time, meeting.timezone)
  const tzAbbrev = getTimezoneAbbreviation(meeting.timezone)
  const days = getDaysInMonth(currentMonth)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pt-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Reschedule Your Meeting</h1>
          <p className="text-gray-600">Select a new date and time for your meeting</p>
        </div>

        {/* Current Meeting Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Currently scheduled:</p>
              <p className="text-sm text-yellow-700">
                {currentDateTime.date} at {currentDateTime.time} {tzAbbrev}
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {formatMonthYear(currentMonth)}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {loadingDates ? (
                <div className="col-span-7 py-8 text-center text-gray-500">
                  Loading...
                </div>
              ) : (
                days.map((day, idx) => {
                  const isAvailable = isDateAvailable(day)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const isToday = isSameDay(day, today)
                  const inMonth = isCurrentMonth(day)
                  const isPast = day < today

                  return (
                    <button
                      key={idx}
                      onClick={() => isAvailable && !isPast && setSelectedDate(day)}
                      disabled={!isAvailable || isPast || !inMonth}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded-lg transition-colors
                        ${!inMonth ? 'text-gray-300' : ''}
                        ${inMonth && isPast ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${inMonth && !isPast && !isAvailable ? 'text-gray-400 cursor-not-allowed' : ''}
                        ${inMonth && !isPast && isAvailable && !isSelected ? 'text-gray-900 hover:bg-blue-50 font-medium' : ''}
                        ${isSelected ? 'bg-blue-600 text-white font-medium' : ''}
                        ${isToday && !isSelected ? 'ring-1 ring-blue-600' : ''}
                      `}
                    >
                      {day.getDate()}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Time Slots */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Select a date'}
            </h2>

            {!selectedDate ? (
              <p className="text-gray-500 text-sm">Choose a date to see available times</p>
            ) : loadingSlots ? (
              <div className="py-8 text-center text-gray-500">Loading times...</div>
            ) : timeSlots.length === 0 ? (
              <p className="text-gray-500 text-sm">No available times for this date</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {timeSlots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start
                  return (
                    <button
                      key={slot.start}
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <span className="font-medium">{slot.startFormatted}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Confirm Button */}
            {selectedSlot && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleReschedule}
                  disabled={pageState === 'rescheduling'}
                  className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {pageState === 'rescheduling' ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Rescheduling...
                    </>
                  ) : (
                    'Confirm New Time'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cancel link */}
        <div className="text-center mt-6">
          <Link
            href={`/book/cancel/${meetingId}`}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Or cancel this meeting instead
          </Link>
        </div>
      </div>
    </main>
  )
}
