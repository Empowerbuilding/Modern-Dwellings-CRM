import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { deleteCalendarEvent, refreshAccessToken } from '@/lib/google-calendar'

// Service role client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CancelRequest {
  reason?: string
}

interface ScheduledMeetingRow {
  id: string
  status: string
  host_user_id: string
  contact_id: string | null
  google_event_id: string | null
  meeting_type_id: string | null
  start_time: string
}

interface MeetingTypeRow {
  title: string
}

interface CalendarIntegrationRow {
  id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  calendar_id: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const timestamp = new Date().toISOString()

  try {
    const body: CancelRequest = await request.json().catch(() => ({}))
    const { reason } = body

    // Check if user is authenticated (CRM user cancelling)
    let cancelledBy = 'guest'
    try {
      const authClient = await createServerClient()
      const { data: { user } } = await authClient.auth.getUser()
      if (user?.email) {
        cancelledBy = user.email
      }
    } catch {
      // Not authenticated, that's fine - guest cancellation
    }

    // Look up scheduled meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('scheduled_meetings')
      .select('id, status, host_user_id, contact_id, google_event_id, meeting_type_id, start_time')
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
        { error: 'Meeting is already cancelled' },
        { status: 400 }
      )
    }

    console.log(`[${timestamp}] Cancelling meeting ${id} by ${cancelledBy}`)

    // Get meeting type title for activity logging
    let meetingTypeTitle = 'Meeting'
    if (meeting.meeting_type_id) {
      const { data: mt } = await supabase
        .from('meeting_types')
        .select('title')
        .eq('id', meeting.meeting_type_id)
        .single<MeetingTypeRow>()
      if (mt) meetingTypeTitle = mt.title
    }

    // Look up calendar integration for the host
    const { data: calendarIntegration } = await supabase
      .from('calendar_integrations')
      .select('id, access_token, refresh_token, token_expires_at, calendar_id')
      .eq('user_id', meeting.host_user_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single<CalendarIntegrationRow>()

    // Delete Google Calendar event if exists
    if (calendarIntegration && meeting.google_event_id) {
      let accessToken = calendarIntegration.access_token

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

      // Delete the calendar event
      try {
        await deleteCalendarEvent({
          accessToken,
          calendarId: calendarIntegration.calendar_id || 'primary',
          eventId: meeting.google_event_id,
        })
        console.log(`[${timestamp}] Deleted Google Calendar event: ${meeting.google_event_id}`)
      } catch (calendarError) {
        console.error(`[${timestamp}] Failed to delete calendar event:`, calendarError)
        // Don't fail the whole request
      }
    }

    // Update scheduled meeting
    const { error: updateError } = await supabase
      .from('scheduled_meetings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq('id', id)

    if (updateError) {
      console.error(`[${timestamp}] Failed to update meeting:`, updateError)
      return NextResponse.json(
        { error: 'Failed to cancel meeting' },
        { status: 500 }
      )
    }

    // Log activity
    if (meeting.contact_id) {
      await supabase.from('activities').insert({
        contact_id: meeting.contact_id,
        activity_type: 'meeting_cancelled',
        title: `Cancelled: ${meetingTypeTitle}`,
        metadata: {
          meeting_id: id,
          reason: reason || null,
          cancelled_by: cancelledBy,
          original_time: meeting.start_time,
        },
      })
    }

    // Trigger n8n webhook if configured
    const n8nWebhook = process.env.N8N_MEETING_CANCELLED_WEBHOOK
    if (n8nWebhook) {
      try {
        await fetch(n8nWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meeting_id: id,
            meeting_type: meetingTypeTitle,
            cancelled_by: cancelledBy,
            reason: reason || null,
            original_time: meeting.start_time,
          }),
        })
        console.log(`[${timestamp}] Triggered n8n cancellation webhook`)
      } catch (webhookError) {
        console.error(`[${timestamp}] Failed to trigger n8n webhook:`, webhookError)
      }
    }

    console.log(`[${timestamp}] Meeting ${id} cancelled successfully`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`[${timestamp}] Cancel meeting error:`, error)
    return NextResponse.json(
      { error: 'Failed to cancel meeting' },
      { status: 500 }
    )
  }
}
