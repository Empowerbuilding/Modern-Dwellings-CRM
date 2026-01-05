'use client'

import Link from 'next/link'

export interface ScheduledMeetingDisplay {
  id: string
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_notes?: string | null
  custom_field_responses?: Record<string, unknown> | null
  start_time: string
  end_time: string
  timezone: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled'
  google_meet_link: string | null
  contact_id: string | null
  meeting_type?: {
    title: string
    duration_minutes: number
    location_type: string
  } | null
  contact?: {
    first_name: string
    last_name: string
  } | null
}

interface UpcomingMeetingsProps {
  meetings: ScheduledMeetingDisplay[]
  showContact?: boolean
  compact?: boolean
  emptyMessage?: string
  onCancel?: (meetingId: string) => void
  onStatusChange?: (meetingId: string, status: string) => void
  onDelete?: (meetingId: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-orange-100 text-orange-700',
  rescheduled: 'bg-yellow-100 text-yellow-700',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  rescheduled: 'Rescheduled',
}

const LOCATION_ICONS: Record<string, JSX.Element> = {
  google_meet: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.052l-1.676 1.095a.75.75 0 01-1.168-.625v-1.69H9.5a1.5 1.5 0 01-1.5-1.5v-2.664a1.5 1.5 0 011.5-1.5h5.55v-1.69a.75.75 0 011.168-.625l1.676 1.095a2.25 2.25 0 010 3.75l-1.676 1.095a.75.75 0 01-1.168-.625v-1.69H9.5v2.664h5.55v-1.69a.75.75 0 011.168-.625l1.676 1.095a2.25 2.25 0 010 3.75z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  in_person: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  custom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
}

// Format field label from snake_case or camelCase to Title Case
function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

// Format field value for display
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    // Format as currency if it looks like a price (>= 1000)
    if (value >= 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
    return value.toLocaleString()
  }
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function formatDateTime(isoString: string, timezone: string): { date: string; time: string; relative: string } {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let relative = ''
  if (diffDays === 0) {
    relative = 'Today'
  } else if (diffDays === 1) {
    relative = 'Tomorrow'
  } else if (diffDays === -1) {
    relative = 'Yesterday'
  } else if (diffDays > 1 && diffDays <= 7) {
    relative = `In ${diffDays} days`
  } else if (diffDays < -1 && diffDays >= -7) {
    relative = `${Math.abs(diffDays)} days ago`
  }

  return {
    date: date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }),
    relative,
  }
}

export function UpcomingMeetings({
  meetings,
  showContact = false,
  compact = false,
  emptyMessage = 'No meetings scheduled',
  onCancel,
  onStatusChange,
  onDelete,
}: UpcomingMeetingsProps) {
  if (meetings.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-gray-300 mb-3"
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
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {meetings.map((meeting) => {
          const { date, time, relative } = formatDateTime(meeting.start_time, meeting.timezone)
          return (
            <div
              key={meeting.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {meeting.guest_first_name} {meeting.guest_last_name}
                </p>
                <p className="text-xs text-gray-500">
                  {relative || date} at {time}
                </p>
              </div>
              <span
                className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                  STATUS_STYLES[meeting.status] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {STATUS_LABELS[meeting.status] || meeting.status}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {meetings.map((meeting) => {
        const { date, time, relative } = formatDateTime(meeting.start_time, meeting.timezone)
        const locationType = meeting.meeting_type?.location_type || 'custom'

        return (
          <div
            key={meeting.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Title and status */}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    {meeting.meeting_type?.title || 'Meeting'}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      STATUS_STYLES[meeting.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUS_LABELS[meeting.status] || meeting.status}
                  </span>
                </div>

                {/* Date and time */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>
                    {date} at {time}
                    {relative && <span className="text-gray-400 ml-1">({relative})</span>}
                  </span>
                </div>

                {/* Guest info */}
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {showContact && meeting.contact_id ? (
                    <Link
                      href={`/contacts/${meeting.contact_id}`}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {meeting.contact?.first_name} {meeting.contact?.last_name}
                    </Link>
                  ) : (
                    <span className="text-gray-600">
                      {meeting.guest_first_name} {meeting.guest_last_name}
                    </span>
                  )}
                  <span className="text-gray-400">({meeting.guest_email})</span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <span className="text-gray-400">
                    {LOCATION_ICONS[locationType] || LOCATION_ICONS.custom}
                  </span>
                  <span className="capitalize">{locationType.replace('_', ' ')}</span>
                  {meeting.meeting_type?.duration_minutes && (
                    <span className="text-gray-400">
                      ({meeting.meeting_type.duration_minutes} mins)
                    </span>
                  )}
                </div>

                {/* Custom field responses */}
                {meeting.custom_field_responses && Object.keys(meeting.custom_field_responses).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Form Responses</p>
                    <div className="space-y-1.5">
                      {Object.entries(meeting.custom_field_responses).map(([key, value]) => (
                        <div key={key} className="flex text-sm">
                          <span className="text-gray-500 min-w-[140px]">{formatFieldLabel(key)}:</span>
                          <span className="text-gray-900 font-medium">{formatFieldValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guest notes */}
                {meeting.guest_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{meeting.guest_notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {meeting.google_meet_link && meeting.status === 'scheduled' && (
                  <a
                    href={meeting.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.052l-1.676 1.095a.75.75 0 01-1.168-.625v-1.69H9.5a1.5 1.5 0 01-1.5-1.5v-2.664a1.5 1.5 0 011.5-1.5h5.55v-1.69a.75.75 0 011.168-.625l1.676 1.095a2.25 2.25 0 010 3.75l-1.676 1.095a.75.75 0 01-1.168-.625v-1.69H9.5v2.664h5.55v-1.69a.75.75 0 011.168-.625l1.676 1.095a2.25 2.25 0 010 3.75z" />
                    </svg>
                    Join
                  </a>
                )}
                {meeting.status === 'scheduled' && onCancel && (
                  <button
                    onClick={() => onCancel(meeting.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                )}
                {meeting.status === 'scheduled' && onStatusChange && (
                  <button
                    onClick={() => onStatusChange(meeting.id, 'completed')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete
                  </button>
                )}
                {meeting.status === 'cancelled' && onDelete && (
                  <button
                    onClick={() => onDelete(meeting.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
