import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCalendarFreeBusy, refreshAccessToken } from '@/lib/google-calendar'
import { getAvailableDates, type MeetingTypeConfig } from '@/lib/availability'

// Service role client for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MeetingTypeRow {
  id: string
  user_id: string
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  availability_start: string
  availability_end: string
  available_days: number[]
  timezone: string
  min_notice_hours: number
  max_days_ahead: number
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')
  const monthStr = searchParams.get('month')
  const guestTimezone = searchParams.get('timezone')

  console.log('[available-dates] Request params:', { slug, monthStr, guestTimezone })

  if (!slug) {
    return NextResponse.json(
      { error: 'Missing required parameter: slug' },
      { status: 400 }
    )
  }

  if (!monthStr) {
    return NextResponse.json(
      { error: 'Missing required parameter: month' },
      { status: 400 }
    )
  }

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(monthStr)) {
    return NextResponse.json(
      { error: 'Invalid month format. Use YYYY-MM' },
      { status: 400 }
    )
  }

  try {
    // Verify Supabase client is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[available-dates] Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Missing database configuration' },
        { status: 500 }
      )
    }

    // Look up meeting type by slug
    console.log('[available-dates] Looking up meeting type with slug:', slug)
    const { data: meetingType, error: mtError } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single<MeetingTypeRow>()

    if (mtError) {
      console.error('[available-dates] Meeting type query error:', mtError)
      return NextResponse.json(
        { error: 'Meeting type not found', details: mtError.message },
        { status: 404 }
      )
    }

    if (!meetingType) {
      console.log('[available-dates] No meeting type found for slug:', slug)
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 404 }
      )
    }

    console.log('[available-dates] Found meeting type:', {
      id: meetingType.id,
      user_id: meetingType.user_id,
      duration: meetingType.duration_minutes,
      timezone: meetingType.timezone,
    })

    // Calculate date range
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Parse month
    const [year, month] = monthStr.split('-').map(Number)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0) // Last day of month

    // Calculate max date based on max_days_ahead
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + meetingType.max_days_ahead)

    // Determine actual range
    // Start: later of month start or today
    const rangeStart = monthStart > today ? monthStart : today
    // End: earlier of month end or max date
    const rangeEnd = monthEnd < maxDate ? monthEnd : maxDate

    // If range is invalid (e.g., month is in the past), return empty
    if (rangeStart > rangeEnd) {
      return NextResponse.json({ dates: [] })
    }

    // Look up calendar integration
    console.log('[available-dates] Looking up calendar integration for user:', meetingType.user_id)
    const { data: calendarIntegration, error: calError } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', meetingType.user_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single<CalendarIntegrationRow>()

    if (calError && calError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is okay
      console.error('[available-dates] Calendar integration query error:', calError)
    }

    // If no calendar connected, calculate dates without busy times
    let busyTimes: { start: Date; end: Date }[] = []

    if (calendarIntegration) {
      console.log('[available-dates] Found calendar integration:', {
        id: calendarIntegration.id,
        calendar_id: calendarIntegration.calendar_id,
        has_refresh_token: !!calendarIntegration.refresh_token,
        token_expires_at: calendarIntegration.token_expires_at,
      })

      // Check if access token is expired and refresh if needed
      let accessToken = calendarIntegration.access_token
      if (calendarIntegration.token_expires_at) {
        const expiresAt = new Date(calendarIntegration.token_expires_at)
        const needsRefresh = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000
        console.log('[available-dates] Token status:', {
          expiresAt: expiresAt.toISOString(),
          needsRefresh,
        })

        // Refresh if expires within 5 minutes
        if (needsRefresh) {
          if (calendarIntegration.refresh_token) {
            try {
              console.log('[available-dates] Refreshing access token...')
              const refreshed = await refreshAccessToken(calendarIntegration.refresh_token)
              accessToken = refreshed.access_token
              const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
              console.log('[available-dates] Token refreshed, new expiry:', newExpiresAt)

              // Update token in database
              await supabase
                .from('calendar_integrations')
                .update({
                  access_token: accessToken,
                  token_expires_at: newExpiresAt,
                })
                .eq('id', calendarIntegration.id)
            } catch (refreshError) {
              console.error('[available-dates] Failed to refresh token:', refreshError)
            }
          } else {
            console.warn('[available-dates] Token expired but no refresh token available')
          }
        }
      }

      // Get busy times from Google Calendar for the entire range
      try {
        console.log('[available-dates] Fetching Google Calendar busy times...')
        busyTimes = await getCalendarFreeBusy({
          accessToken,
          calendarId: calendarIntegration.calendar_id || 'primary',
          timeMin: rangeStart,
          timeMax: new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000), // Include full last day
        })
        console.log('[available-dates] Got', busyTimes.length, 'busy periods from Google Calendar')
      } catch (calendarError) {
        console.error('[available-dates] Failed to fetch calendar busy times:', calendarError)
        // Continue without Google Calendar data
      }
    } else {
      console.log('[available-dates] No calendar integration found, proceeding without busy times')
    }

    // Get existing scheduled meetings for the range
    const { data: existingMeetings } = await supabase
      .from('scheduled_meetings')
      .select('start_time, end_time')
      .eq('host_user_id', meetingType.user_id)
      .gte('start_time', rangeStart.toISOString())
      .lte('start_time', new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000).toISOString())
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
      timezone: guestTimezone || meetingType.timezone,
      min_notice_hours: meetingType.min_notice_hours,
    }

    // Get available dates
    const availableDates = getAvailableDates({
      meetingType: meetingTypeConfig,
      startDate: rangeStart,
      endDate: rangeEnd,
      busyTimes,
      existingMeetings: (existingMeetings || []).map((m) => ({
        start_time: new Date(m.start_time),
        end_time: new Date(m.end_time),
      })),
    })

    // Format dates as YYYY-MM-DD strings
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: meetingType.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    const formattedDates = availableDates.map((date) => dateFormatter.format(date))

    // Remove duplicates (in case timezone conversion causes issues)
    const uniqueDates = Array.from(new Set(formattedDates)).sort()

    console.log('[available-dates] Returning', uniqueDates.length, 'available dates')
    return NextResponse.json({
      dates: uniqueDates,
      timezone: meetingType.timezone,
      maxDaysAhead: meetingType.max_days_ahead,
    })
  } catch (error) {
    console.error('[available-dates] Unhandled error:', error)

    // Return detailed error in development
    const isDev = process.env.NODE_ENV === 'development'
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: 'Failed to fetch available dates',
        ...(isDev && {
          details: errorMessage,
          stack: errorStack,
        }),
      },
      { status: 500 }
    )
  }
}
