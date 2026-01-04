import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCalendarFreeBusy, refreshAccessToken } from '@/lib/google-calendar'
import { getAllSlotsWithStatus, type MeetingTypeConfig } from '@/lib/availability'

// Service role client for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MeetingTypeRow {
  id: string
  user_id: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  availability_start: string
  availability_end: string
  available_days: number[]
  timezone: string
  min_notice_hours: number
  max_days_ahead: number
  location_type: string
  custom_fields: unknown
  brand_color: string
  logo_url: string | null
  is_active: boolean
}

interface CalendarIntegrationRow {
  id: string
  user_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  calendar_id: string
  is_active: boolean
}

interface ScheduledMeetingRow {
  start_time: string
  end_time: string
}

interface UserRow {
  name: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')
  const dateStr = searchParams.get('date')
  const guestTimezone = searchParams.get('timezone')

  if (!slug) {
    return NextResponse.json(
      { error: 'Missing required parameter: slug' },
      { status: 400 }
    )
  }

  if (!dateStr) {
    return NextResponse.json(
      { error: 'Missing required parameter: date' },
      { status: 400 }
    )
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    )
  }

  try {
    // Look up meeting type by slug
    const { data: meetingType, error: mtError } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single<MeetingTypeRow>()

    if (mtError || !meetingType) {
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 404 }
      )
    }

    // Look up host user
    const { data: hostUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', meetingType.user_id)
      .single<UserRow>()

    // Determine timezone for response formatting
    const responseTimezone = guestTimezone || meetingType.timezone

    // Look up calendar integration
    const { data: calendarIntegration } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', meetingType.user_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single<CalendarIntegrationRow>()

    // If no calendar connected, return empty slots with flag
    if (!calendarIntegration) {
      return NextResponse.json({
        meetingType: {
          title: meetingType.title,
          description: meetingType.description,
          duration_minutes: meetingType.duration_minutes,
          location_type: meetingType.location_type,
          custom_fields: meetingType.custom_fields,
          brand_color: meetingType.brand_color,
          logo_url: meetingType.logo_url,
          timezone: meetingType.timezone,
        },
        host: { name: hostUser?.name || 'Host' },
        date: dateStr,
        timezone: responseTimezone,
        slots: [],
        calendarConnected: false,
      })
    }

    // Check if access token is expired and refresh if needed
    let accessToken = calendarIntegration.access_token
    if (calendarIntegration.token_expires_at) {
      const expiresAt = new Date(calendarIntegration.token_expires_at)
      const now = new Date()
      // Refresh if expires within 5 minutes
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        if (calendarIntegration.refresh_token) {
          try {
            const refreshed = await refreshAccessToken(calendarIntegration.refresh_token)
            accessToken = refreshed.access_token
            const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

            // Update token in database
            await supabase
              .from('calendar_integrations')
              .update({
                access_token: accessToken,
                token_expires_at: newExpiresAt,
              })
              .eq('id', calendarIntegration.id)
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError)
            // Continue with existing token, it might still work
          }
        }
      }
    }

    // Parse the date and calculate time range for the day in the meeting type's timezone
    const timezone = meetingType.timezone

    // Create date at noon UTC to avoid timezone boundary issues for day-of-week calculations
    const date = new Date(dateStr + 'T12:00:00Z')

    // Helper to convert a time in a timezone to UTC
    const getTimeInTimezoneAsUTC = (dateString: string, timeString: string, tz: string): Date => {
      // Create a formatter to get the offset for this timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      })

      // Use a reference date to get the timezone offset
      const refDate = new Date(`${dateString}T12:00:00Z`)
      const parts = formatter.formatToParts(refDate)
      const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT'

      // Parse offset like "GMT-6" or "GMT+5:30"
      let offsetMinutes = 0
      const offsetMatch = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
      if (offsetMatch) {
        const sign = offsetMatch[1] === '+' ? 1 : -1
        const hourOffset = parseInt(offsetMatch[2], 10)
        const minOffset = parseInt(offsetMatch[3] || '0', 10)
        offsetMinutes = sign * (hourOffset * 60 + minOffset)
      }

      // Create the date as if it were UTC, then adjust for the timezone offset
      const utcDate = new Date(`${dateString}T${timeString}Z`)
      // Subtract the offset to convert from local to UTC
      // If timezone is GMT-6, local noon is 18:00 UTC, so we ADD 6 hours (subtract negative offset)
      return new Date(utcDate.getTime() - offsetMinutes * 60 * 1000)
    }

    // Calculate day boundaries in the meeting type's timezone, converted to UTC
    const dayStart = getTimeInTimezoneAsUTC(dateStr, '00:00:00', timezone)
    const dayEnd = getTimeInTimezoneAsUTC(dateStr, '23:59:59', timezone)

    console.log('[availability-api] Date range calculation:', {
      dateStr,
      timezone,
      dayStartUTC: dayStart.toISOString(),
      dayEndUTC: dayEnd.toISOString(),
    })

    // Get busy times from Google Calendar
    let busyTimes: { start: Date; end: Date }[] = []
    try {
      busyTimes = await getCalendarFreeBusy({
        accessToken,
        calendarId: calendarIntegration.calendar_id || 'primary',
        timeMin: dayStart,
        timeMax: dayEnd,
      })

      console.log('[availability-api] Busy times received:', busyTimes.length, 'periods')
      busyTimes.forEach((bt, i) => {
        console.log(`[availability-api]   [${i}] ${bt.start.toISOString()} - ${bt.end.toISOString()}`)
      })
    } catch (calendarError) {
      console.error('Failed to fetch calendar busy times:', calendarError)
      // Continue without busy times - better to show all slots than none
    }

    // Get existing scheduled meetings for this date and host
    const { data: existingMeetings } = await supabase
      .from('scheduled_meetings')
      .select('start_time, end_time')
      .eq('host_user_id', meetingType.user_id)
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString())
      .in('status', ['scheduled', 'rescheduled'])
      .returns<ScheduledMeetingRow[]>()

    // Prepare meeting type config
    const meetingTypeConfig: MeetingTypeConfig = {
      duration_minutes: meetingType.duration_minutes,
      buffer_before: meetingType.buffer_before,
      buffer_after: meetingType.buffer_after,
      availability_start: meetingType.availability_start,
      availability_end: meetingType.availability_end,
      available_days: meetingType.available_days,
      timezone: meetingType.timezone,
      min_notice_hours: meetingType.min_notice_hours,
    }

    // Get all slots with availability status
    const allSlots = getAllSlotsWithStatus({
      meetingType: meetingTypeConfig,
      date,
      busyTimes,
      existingMeetings: (existingMeetings || []).map((m) => ({
        start_time: new Date(m.start_time),
        end_time: new Date(m.end_time),
      })),
    })

    // Format slots for response
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: responseTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    const formattedSlots = allSlots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      startFormatted: timeFormatter.format(slot.start),
      endFormatted: timeFormatter.format(slot.end),
      available: slot.available,
      blockedReason: slot.blockedReason,
    }))

    // Also provide just available slots for backwards compatibility
    const availableSlots = formattedSlots.filter(s => s.available)

    return NextResponse.json({
      meetingType: {
        title: meetingType.title,
        description: meetingType.description,
        duration_minutes: meetingType.duration_minutes,
        location_type: meetingType.location_type,
        custom_fields: meetingType.custom_fields,
        brand_color: meetingType.brand_color,
        logo_url: meetingType.logo_url,
        timezone: meetingType.timezone,
      },
      host: { name: hostUser?.name || 'Host' },
      date: dateStr,
      timezone: responseTimezone,
      slots: availableSlots, // Just available slots for backwards compatibility
      allSlots: formattedSlots, // All slots with availability status
      calendarConnected: true,
    })
  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
