import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCalendarFreeBusy,
  refreshAccessToken,
  deleteCalendarEvent,
  createCalendarEvent,
} from '@/lib/google-calendar'
import { isOverlapping } from '@/lib/availability'

// Service role client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RescheduleRequest {
  newStartTime: string
  timezone: string
}

interface ScheduledMeetingRow {
  id: string
  status: string
  host_user_id: string
  contact_id: string | null
  meeting_type_id: string | null
  google_event_id: string | null
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string | null
  guest_notes: string | null
  custom_field_responses: Record<string, unknown>
  anonymous_id: string | null
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  start_time: string
}

interface MeetingTypeRow {
  id: string
  title: string
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  location_type: string
  timezone: string
}

interface CalendarIntegrationRow {
  id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  calendar_id: string
}

interface UserRow {
  name: string
}

interface ExistingMeetingRow {
  start_time: string
  end_time: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const timestamp = new Date().toISOString()

  try {
    const body: RescheduleRequest = await request.json()
    const { newStartTime, timezone } = body

    if (!newStartTime || !timezone) {
      return NextResponse.json(
        { error: 'Missing required fields: newStartTime, timezone' },
        { status: 400 }
      )
    }

    // Parse new start time
    const newStart = new Date(newStartTime)
    if (isNaN(newStart.getTime())) {
      return NextResponse.json(
        { error: 'Invalid newStartTime format' },
        { status: 400 }
      )
    }

    // Look up original meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('scheduled_meetings')
      .select(`
        id, status, host_user_id, contact_id, meeting_type_id,
        google_event_id, guest_first_name, guest_last_name,
        guest_email, guest_phone, guest_notes, custom_field_responses,
        anonymous_id, source, utm_source, utm_medium, utm_campaign, start_time
      `)
      .eq('id', id)
      .single<ScheduledMeetingRow>()

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    if (meeting.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot reschedule a cancelled meeting' },
        { status: 400 }
      )
    }

    if (meeting.status === 'rescheduled') {
      return NextResponse.json(
        { error: 'This meeting has already been rescheduled' },
        { status: 400 }
      )
    }

    console.log(`[${timestamp}] Rescheduling meeting ${id} to ${newStartTime}`)

    // Look up meeting type
    if (!meeting.meeting_type_id) {
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 400 }
      )
    }

    const { data: meetingType, error: mtError } = await supabase
      .from('meeting_types')
      .select('id, title, duration_minutes, buffer_before, buffer_after, location_type, timezone')
      .eq('id', meeting.meeting_type_id)
      .single<MeetingTypeRow>()

    if (mtError || !meetingType) {
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 400 }
      )
    }

    // Calculate new end time
    const newEnd = new Date(newStart.getTime() + meetingType.duration_minutes * 60 * 1000)

    // Look up host user
    const { data: hostUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', meeting.host_user_id)
      .single<UserRow>()

    // Look up calendar integration
    const { data: calendarIntegration } = await supabase
      .from('calendar_integrations')
      .select('id, access_token, refresh_token, token_expires_at, calendar_id')
      .eq('user_id', meeting.host_user_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single<CalendarIntegrationRow>()

    let accessToken: string | null = null

    if (calendarIntegration) {
      accessToken = calendarIntegration.access_token

      // Refresh token if needed
      if (calendarIntegration.token_expires_at) {
        const expiresAt = new Date(calendarIntegration.token_expires_at)
        const now = new Date()
        if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
          if (calendarIntegration.refresh_token) {
            try {
              const refreshed = await refreshAccessToken(calendarIntegration.refresh_token)
              accessToken = refreshed.access_token
              const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

              await supabase
                .from('calendar_integrations')
                .update({
                  access_token: accessToken,
                  token_expires_at: newExpiresAt,
                })
                .eq('id', calendarIntegration.id)
            } catch (refreshError) {
              console.error(`[${timestamp}] Failed to refresh token:`, refreshError)
            }
          }
        }
      }

      // Verify new slot is available
      const bufferStart = new Date(newStart.getTime() - meetingType.buffer_before * 60 * 1000)
      const bufferEnd = new Date(newEnd.getTime() + meetingType.buffer_after * 60 * 1000)

      // Check Google Calendar
      try {
        const busyTimes = await getCalendarFreeBusy({
          accessToken,
          calendarId: calendarIntegration.calendar_id || 'primary',
          timeMin: bufferStart,
          timeMax: bufferEnd,
        })

        const hasConflict = busyTimes.some((busy) =>
          isOverlapping({ start: bufferStart, end: bufferEnd }, busy)
        )

        if (hasConflict) {
          return NextResponse.json(
            { error: 'This time slot is not available. Please select another time.' },
            { status: 409 }
          )
        }
      } catch (calendarError) {
        console.error(`[${timestamp}] Failed to check calendar:`, calendarError)
      }
    }

    // Check existing scheduled meetings (excluding the current one)
    const bufferStart = new Date(newStart.getTime() - meetingType.buffer_before * 60 * 1000)
    const bufferEnd = new Date(newEnd.getTime() + meetingType.buffer_after * 60 * 1000)

    const { data: existingMeetings } = await supabase
      .from('scheduled_meetings')
      .select('start_time, end_time')
      .eq('host_user_id', meeting.host_user_id)
      .neq('id', id)
      .gte('end_time', bufferStart.toISOString())
      .lte('start_time', bufferEnd.toISOString())
      .in('status', ['scheduled', 'rescheduled'])
      .returns<ExistingMeetingRow[]>()

    if (existingMeetings && existingMeetings.length > 0) {
      const hasConflict = existingMeetings.some((m) =>
        isOverlapping(
          { start: bufferStart, end: bufferEnd },
          { start: new Date(m.start_time), end: new Date(m.end_time) }
        )
      )

      if (hasConflict) {
        return NextResponse.json(
          { error: 'This time slot is not available. Please select another time.' },
          { status: 409 }
        )
      }
    }

    // Handle Google Calendar events
    let newGoogleEventId: string | null = null
    let newGoogleMeetLink: string | null = null

    if (calendarIntegration && accessToken) {
      // Delete old Google Calendar event
      if (meeting.google_event_id) {
        try {
          await deleteCalendarEvent({
            accessToken,
            calendarId: calendarIntegration.calendar_id || 'primary',
            eventId: meeting.google_event_id,
          })
          console.log(`[${timestamp}] Deleted old Google Calendar event: ${meeting.google_event_id}`)
        } catch (deleteError) {
          console.error(`[${timestamp}] Failed to delete old calendar event:`, deleteError)
        }
      }

      // Create new Google Calendar event
      try {
        const descriptionParts: string[] = []
        descriptionParts.push(`Meeting with ${meeting.guest_first_name} ${meeting.guest_last_name}`)
        descriptionParts.push(`Email: ${meeting.guest_email}`)
        if (meeting.guest_phone) descriptionParts.push(`Phone: ${meeting.guest_phone}`)
        if (meeting.guest_notes) {
          descriptionParts.push('')
          descriptionParts.push(`Notes from guest:`)
          descriptionParts.push(meeting.guest_notes)
        }
        descriptionParts.push('')
        descriptionParts.push('(Rescheduled)')

        const result = await createCalendarEvent({
          accessToken,
          calendarId: calendarIntegration.calendar_id || 'primary',
          summary: `${meetingType.title} - ${meeting.guest_first_name} ${meeting.guest_last_name}`,
          description: descriptionParts.join('\n'),
          startTime: newStart,
          endTime: newEnd,
          attendeeEmail: meeting.guest_email,
          addGoogleMeet: meetingType.location_type === 'google_meet',
          timezone: meetingType.timezone,
        })

        newGoogleEventId = result.eventId
        newGoogleMeetLink = result.meetLink || null
        console.log(`[${timestamp}] Created new Google Calendar event: ${newGoogleEventId}`)
      } catch (createError) {
        console.error(`[${timestamp}] Failed to create new calendar event:`, createError)
      }
    }

    // Update old meeting status
    await supabase
      .from('scheduled_meetings')
      .update({ status: 'rescheduled' })
      .eq('id', id)

    // Create new scheduled meeting
    const { data: newMeeting, error: insertError } = await supabase
      .from('scheduled_meetings')
      .insert({
        meeting_type_id: meeting.meeting_type_id,
        host_user_id: meeting.host_user_id,
        contact_id: meeting.contact_id,
        guest_first_name: meeting.guest_first_name,
        guest_last_name: meeting.guest_last_name,
        guest_email: meeting.guest_email,
        guest_phone: meeting.guest_phone,
        guest_notes: meeting.guest_notes,
        custom_field_responses: meeting.custom_field_responses,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        timezone,
        google_event_id: newGoogleEventId,
        google_meet_link: newGoogleMeetLink,
        status: 'scheduled',
        rescheduled_from: id,
        anonymous_id: meeting.anonymous_id,
        source: meeting.source,
        utm_source: meeting.utm_source,
        utm_medium: meeting.utm_medium,
        utm_campaign: meeting.utm_campaign,
      })
      .select('id')
      .single()

    if (insertError || !newMeeting) {
      console.error(`[${timestamp}] Failed to create new meeting:`, insertError)
      return NextResponse.json(
        { error: 'Failed to reschedule meeting' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Created rescheduled meeting: ${newMeeting.id}`)

    // Log activity
    if (meeting.contact_id) {
      await supabase.from('activities').insert({
        contact_id: meeting.contact_id,
        activity_type: 'meeting_scheduled',
        title: `Rescheduled: ${meetingType.title}`,
        metadata: {
          meeting_id: newMeeting.id,
          original_meeting_id: id,
          original_time: meeting.start_time,
          new_time: newStart.toISOString(),
          google_meet_link: newGoogleMeetLink,
        },
        anonymous_id: meeting.anonymous_id,
      })
    }

    // Format times for response
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    return NextResponse.json({
      success: true,
      meeting: {
        id: newMeeting.id,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        startFormatted: `${dateFormatter.format(newStart)} at ${timeFormatter.format(newStart)}`,
        title: meetingType.title,
        hostName: hostUser?.name || 'Host',
        googleMeetLink: newGoogleMeetLink,
        timezone,
      },
      originalMeetingId: id,
    })
  } catch (error) {
    console.error(`[${timestamp}] Reschedule meeting error:`, error)
    return NextResponse.json(
      { error: 'Failed to reschedule meeting' },
      { status: 500 }
    )
  }
}
