'use client'

interface Meeting {
  id: string
  startTime: string
  endTime: string
  title: string
  hostName: string
  googleMeetLink?: string
  timezone: string
}

interface MeetingType {
  title: string
  slug?: string
  location_type: string
  custom_location?: string
  confirmation_message?: string
}

interface BookingConfirmationProps {
  meeting: Meeting
  meetingType: MeetingType
  guestEmail: string
}

function formatDateForDisplay(dateString: string, timezone: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  })
}

function formatTimeForDisplay(dateString: string, timezone: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
}

function getTimezoneAbbreviation(timezone: string): string {
  try {
    const date = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    return tzPart?.value || timezone
  } catch {
    return timezone
  }
}

function formatDateForICS(date: Date): string {
  // Format: YYYYMMDDTHHMMSSZ (UTC)
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function generateICSContent(meeting: Meeting, meetingType: MeetingType): string {
  const startDate = new Date(meeting.startTime)
  const endDate = new Date(meeting.endTime)
  const now = new Date()

  let description = `Meeting with ${meeting.hostName}`
  if (meeting.googleMeetLink) {
    description += `\\n\\nJoin with Google Meet: ${meeting.googleMeetLink}`
  }

  let location = ''
  if (meetingType.location_type === 'google_meet' && meeting.googleMeetLink) {
    location = meeting.googleMeetLink
  } else if (meetingType.custom_location) {
    location = meetingType.custom_location
  } else if (meetingType.location_type === 'phone') {
    location = 'Phone Call'
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CRM//Meeting Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@crm`,
    `DTSTAMP:${formatDateForICS(now)}`,
    `DTSTART:${formatDateForICS(startDate)}`,
    `DTEND:${formatDateForICS(endDate)}`,
    `SUMMARY:${escapeICSText(meetingType.title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    location ? `LOCATION:${escapeICSText(location)}` : '',
    `ORGANIZER;CN=${escapeICSText(meeting.hostName)}:mailto:noreply@example.com`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  return icsContent
}

function downloadICSFile(meeting: Meeting, meetingType: MeetingType) {
  const icsContent = generateICSContent(meeting, meetingType)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${meetingType.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getLocationDisplay(locationType: string, customLocation?: string): { icon: string; text: string } {
  switch (locationType) {
    case 'google_meet':
      return { icon: '📹', text: 'Google Meet' }
    case 'zoom':
      return { icon: '📹', text: 'Zoom Meeting' }
    case 'phone':
      return { icon: '📞', text: 'Phone Call' }
    case 'in_person':
      return { icon: '📍', text: customLocation || 'In Person' }
    case 'custom':
      return { icon: '📍', text: customLocation || 'Location to be provided' }
    default:
      return { icon: '📍', text: locationType }
  }
}

export default function BookingConfirmation({
  meeting,
  meetingType,
  guestEmail,
}: BookingConfirmationProps) {
  const formattedDate = formatDateForDisplay(meeting.startTime, meeting.timezone)
  const startTime = formatTimeForDisplay(meeting.startTime, meeting.timezone)
  const endTime = formatTimeForDisplay(meeting.endTime, meeting.timezone)
  const tzAbbrev = getTimezoneAbbreviation(meeting.timezone)
  const location = getLocationDisplay(meetingType.location_type, meetingType.custom_location)

  const handleAddToCalendar = () => {
    downloadICSFile(meeting, meetingType)
  }

  return (
    <div className="max-w-lg mx-auto text-center">
      {/* Success Header */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
        <p className="text-gray-600">
          A calendar invitation has been sent to{' '}
          <span className="font-medium text-gray-900">{guestEmail}</span>
        </p>
      </div>

      {/* Meeting Details Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 text-left">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{meetingType.title}</h2>

        <div className="space-y-3">
          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">{formattedDate}</p>
              <p className="text-gray-600">
                {startTime} - {endTime} {tzAbbrev}
              </p>
            </div>
          </div>

          {/* Host */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <p className="text-gray-900">{meeting.hostName}</p>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 text-center">{location.icon}</span>
            <div>
              <p className="text-gray-900">{location.text}</p>
              {meetingType.location_type === 'google_meet' && meeting.googleMeetLink && (
                <a
                  href={meeting.googleMeetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.052l-1.676 1.095a.75.75 0 01-1.168-.625v-1.69H9.5a1.5 1.5 0 01-1.5-1.5v-2.664a1.5 1.5 0 011.5-1.5h5.55v-1.69a.75.75 0 011.168-.625l1.676 1.095a2.25 2.25 0 010 3.75l-1.676 1.095a.75.75 0 01-1.168-.625v-1.69H9.5v2.664h5.55v-1.69a.75.75 0 011.168-.625l1.676 1.095a2.25 2.25 0 010 3.75z" />
                  </svg>
                  Join with Google Meet
                </a>
              )}
              {meetingType.location_type === 'phone' && (
                <p className="text-sm text-gray-500 mt-1">You will receive a call at your provided number</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Message */}
      {meetingType.confirmation_message && (
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-brand-800">{meetingType.confirmation_message}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-4 mb-6">
        <button
          onClick={handleAddToCalendar}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Add to Calendar
        </button>

        <div className="flex items-center justify-center gap-6 text-sm">
          <a
            href={`/book/reschedule/${meeting.id}`}
            className="text-brand-600 hover:text-brand-700 hover:underline font-medium"
          >
            Reschedule
          </a>
          <span className="text-gray-300">|</span>
          <a
            href={`/book/cancel/${meeting.id}`}
            className="text-brand-600 hover:text-brand-700 hover:underline font-medium"
          >
            Cancel
          </a>
        </div>
      </div>

      {/* Footer Text */}
      <p className="text-sm text-gray-500">
        Need to make changes? Check your email for reschedule and cancellation links.
      </p>
    </div>
  )
}
