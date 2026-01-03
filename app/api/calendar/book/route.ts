import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCalendarFreeBusy,
  refreshAccessToken,
  createCalendarEvent,
} from '@/lib/google-calendar'
import { isOverlapping } from '@/lib/availability'

// Service role client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BookingRequest {
  slug: string
  startTime: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  notes?: string
  customFields?: Record<string, unknown>
  anonymousId?: string
  source?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  timezone: string
}

interface MeetingTypeRow {
  id: string
  user_id: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  timezone: string
  location_type: string
  custom_fields: unknown
  confirmation_message: string | null
  is_active: boolean
}

interface CalendarIntegrationRow {
  id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  calendar_id: string
}

interface UserRow {
  id: string
  name: string
  email: string
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  anonymous_id: string | null
}

interface ScheduledMeetingRow {
  start_time: string
  end_time: string
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()

  try {
    const body: BookingRequest = await request.json()

    // 1. Validate required fields
    const { slug, startTime, firstName, lastName, email, timezone } = body
    if (!slug || !startTime || !firstName || !lastName || !email || !timezone) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, startTime, firstName, lastName, email, timezone' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Parse start time
    const startDate = new Date(startTime)
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid startTime format' },
        { status: 400 }
      )
    }

    console.log(`[${timestamp}] Booking request for ${slug}: ${firstName} ${lastName} <${email}>`)

    // 2. Look up meeting type
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

    // Calculate end time
    const endDate = new Date(startDate.getTime() + meetingType.duration_minutes * 60 * 1000)

    // 3. Look up host user
    const { data: hostUser, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', meetingType.user_id)
      .single<UserRow>()

    if (userError || !hostUser) {
      console.error(`[${timestamp}] Host user not found:`, userError)
      return NextResponse.json(
        { error: 'Host user not found' },
        { status: 500 }
      )
    }

    // 4. Look up calendar integration
    const { data: calendarIntegration, error: calError } = await supabase
      .from('calendar_integrations')
      .select('id, access_token, refresh_token, token_expires_at, calendar_id')
      .eq('user_id', meetingType.user_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single<CalendarIntegrationRow>()

    if (calError || !calendarIntegration) {
      return NextResponse.json(
        { error: 'Calendar not connected. Please contact the host.' },
        { status: 400 }
      )
    }

    // 5. Refresh access token if expired
    let accessToken = calendarIntegration.access_token
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

    // 6. Re-verify slot is still available (race condition protection)
    const bufferStart = new Date(startDate.getTime() - meetingType.buffer_before * 60 * 1000)
    const bufferEnd = new Date(endDate.getTime() + meetingType.buffer_after * 60 * 1000)

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
          { error: 'This time slot is no longer available. Please select another time.' },
          { status: 409 }
        )
      }
    } catch (calendarError) {
      console.error(`[${timestamp}] Failed to check calendar:`, calendarError)
      // Continue anyway - better to potentially double-book than fail entirely
    }

    // Check existing scheduled meetings
    const { data: existingMeetings } = await supabase
      .from('scheduled_meetings')
      .select('start_time, end_time')
      .eq('host_user_id', meetingType.user_id)
      .gte('end_time', bufferStart.toISOString())
      .lte('start_time', bufferEnd.toISOString())
      .in('status', ['scheduled', 'rescheduled'])
      .returns<ScheduledMeetingRow[]>()

    if (existingMeetings && existingMeetings.length > 0) {
      const hasConflict = existingMeetings.some((meeting) =>
        isOverlapping(
          { start: bufferStart, end: bufferEnd },
          { start: new Date(meeting.start_time), end: new Date(meeting.end_time) }
        )
      )

      if (hasConflict) {
        return NextResponse.json(
          { error: 'This time slot is no longer available. Please select another time.' },
          { status: 409 }
        )
      }
    }

    // 7. End time already calculated above

    // 8. Create Google Calendar event
    let googleEventId: string | undefined
    let googleMeetLink: string | undefined

    try {
      // Format description with notes and custom fields
      const descriptionParts: string[] = []
      descriptionParts.push(`Meeting with ${firstName} ${lastName}`)
      descriptionParts.push(`Email: ${email}`)
      if (body.phone) descriptionParts.push(`Phone: ${body.phone}`)
      if (body.notes) {
        descriptionParts.push('')
        descriptionParts.push(`Notes from guest:`)
        descriptionParts.push(body.notes)
      }
      if (body.customFields && Object.keys(body.customFields).length > 0) {
        descriptionParts.push('')
        descriptionParts.push('Form responses:')
        for (const [key, value] of Object.entries(body.customFields)) {
          descriptionParts.push(`- ${key}: ${value}`)
        }
      }

      const result = await createCalendarEvent({
        accessToken,
        calendarId: calendarIntegration.calendar_id || 'primary',
        summary: `${meetingType.title} - ${firstName} ${lastName}`,
        description: descriptionParts.join('\n'),
        startTime: startDate,
        endTime: endDate,
        attendeeEmail: email,
        addGoogleMeet: meetingType.location_type === 'google_meet',
        timezone: meetingType.timezone,
      })

      googleEventId = result.eventId
      googleMeetLink = result.meetLink
      console.log(`[${timestamp}] Created Google Calendar event: ${googleEventId}`)
    } catch (calendarError) {
      console.error(`[${timestamp}] Failed to create calendar event:`, calendarError)
      // Continue - we'll create the meeting record anyway
    }

    // 9. Find or create contact
    let contact: ContactRow | null = null

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, anonymous_id')
      .eq('email', email.toLowerCase())
      .single<ContactRow>()

    if (existingContact) {
      contact = existingContact

      // Update if needed
      const updates: Record<string, unknown> = {}
      if (!existingContact.phone && body.phone) {
        updates.phone = body.phone
      }
      if (!existingContact.anonymous_id && body.anonymousId) {
        updates.anonymous_id = body.anonymousId
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', existingContact.id)
      }

      console.log(`[${timestamp}] Using existing contact: ${contact.id}`)
    } else {
      // Create new contact
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase(),
          phone: body.phone || null,
          lead_source: 'calendar_booking',
          client_type: 'consumer',
          anonymous_id: body.anonymousId || null,
          is_primary: true,
        })
        .select('id, first_name, last_name, email, phone, anonymous_id')
        .single<ContactRow>()

      if (contactError || !newContact) {
        console.error(`[${timestamp}] Failed to create contact:`, contactError)
        // Continue without contact - meeting can still be created
      } else {
        contact = newContact
        console.log(`[${timestamp}] Created new contact: ${contact.id}`)

        // Log contact_created activity
        await supabase.from('activities').insert({
          contact_id: contact.id,
          activity_type: 'contact_created',
          title: `Contact created: ${firstName} ${lastName}`,
          metadata: {
            source: 'calendar_booking',
            email,
            phone: body.phone || null,
          },
          anonymous_id: body.anonymousId || null,
        })
      }
    }

    // 10. Link anonymous activities
    if (body.anonymousId && contact) {
      const { data: linkedActivities } = await supabase
        .from('activities')
        .update({ contact_id: contact.id })
        .eq('anonymous_id', body.anonymousId)
        .is('contact_id', null)
        .select('id')

      const linkedCount = linkedActivities?.length || 0
      if (linkedCount > 0) {
        console.log(`[${timestamp}] Linked ${linkedCount} anonymous activities to contact`)
      }
    }

    // 11. Create scheduled_meetings record
    const { data: meeting, error: meetingError } = await supabase
      .from('scheduled_meetings')
      .insert({
        meeting_type_id: meetingType.id,
        host_user_id: meetingType.user_id,
        contact_id: contact?.id || null,
        guest_first_name: firstName,
        guest_last_name: lastName,
        guest_email: email,
        guest_phone: body.phone || null,
        guest_notes: body.notes || null,
        custom_field_responses: body.customFields || {},
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        timezone,
        google_event_id: googleEventId || null,
        google_meet_link: googleMeetLink || null,
        status: 'scheduled',
        anonymous_id: body.anonymousId || null,
        source: body.source || null,
        utm_source: body.utmSource || null,
        utm_medium: body.utmMedium || null,
        utm_campaign: body.utmCampaign || null,
      })
      .select('id')
      .single()

    if (meetingError) {
      console.error(`[${timestamp}] Failed to create meeting record:`, meetingError)
      return NextResponse.json(
        { error: 'Failed to book meeting. Please try again.' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Created meeting: ${meeting.id}`)

    // 12. Log activity
    if (contact) {
      await supabase.from('activities').insert({
        contact_id: contact.id,
        activity_type: 'meeting_scheduled',
        title: `Scheduled: ${meetingType.title}`,
        metadata: {
          meeting_id: meeting.id,
          start_time: startDate.toISOString(),
          google_meet_link: googleMeetLink || null,
          source: body.source || 'calendar_booking',
        },
        anonymous_id: body.anonymousId || null,
      })
    }

    // 13. Trigger n8n webhook if configured
    const n8nWebhook = process.env.N8N_MEETING_BOOKED_WEBHOOK
    if (n8nWebhook) {
      try {
        await fetch(n8nWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meeting_id: meeting.id,
            meeting_type: meetingType.title,
            host_name: hostUser.name,
            host_email: hostUser.email,
            guest_name: `${firstName} ${lastName}`,
            guest_email: email,
            guest_phone: body.phone || null,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            timezone,
            google_meet_link: googleMeetLink || null,
            location_type: meetingType.location_type,
            confirmation_message: meetingType.confirmation_message,
            custom_fields: body.customFields || {},
          }),
        })
        console.log(`[${timestamp}] Triggered n8n webhook`)
      } catch (webhookError) {
        console.error(`[${timestamp}] Failed to trigger n8n webhook:`, webhookError)
        // Don't fail the booking if webhook fails
      }
    }

    // 14. Return success response
    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        title: meetingType.title,
        hostName: hostUser.name,
        googleMeetLink: googleMeetLink || null,
        timezone,
        confirmationMessage: meetingType.confirmation_message,
      },
      contact: contact
        ? {
            id: contact.id,
            firstName: contact.first_name,
            lastName: contact.last_name,
            email: contact.email,
          }
        : null,
    })
  } catch (error) {
    console.error(`[${timestamp}] Booking error:`, error)
    return NextResponse.json(
      { error: 'Failed to book meeting. Please try again.' },
      { status: 500 }
    )
  }
}
