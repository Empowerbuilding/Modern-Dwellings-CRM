import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

// Service role client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CrmUser {
  id: string
  email: string
}

async function getCurrentCrmUser(authUserEmail: string): Promise<CrmUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', authUserEmail)
    .single<CrmUser>()

  if (error || !data) {
    return null
  }
  return data
}

interface ScheduledMeetingRow {
  id: string
  status: string
  start_time: string
  end_time: string
  timezone: string
  google_meet_link: string | null
  guest_first_name: string
  guest_last_name: string
  meeting_type_id: string | null
}

interface MeetingTypeRow {
  title: string
  duration_minutes: number
  location_type: string
  description: string | null
}

interface UserRow {
  name: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Look up scheduled meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('scheduled_meetings')
      .select(`
        id,
        status,
        start_time,
        end_time,
        timezone,
        google_meet_link,
        guest_first_name,
        guest_last_name,
        meeting_type_id,
        host_user_id
      `)
      .eq('id', id)
      .single<ScheduledMeetingRow & { host_user_id: string }>()

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Look up meeting type if available
    let meetingType: MeetingTypeRow | null = null
    if (meeting.meeting_type_id) {
      const { data: mt } = await supabase
        .from('meeting_types')
        .select('title, duration_minutes, location_type, description')
        .eq('id', meeting.meeting_type_id)
        .single<MeetingTypeRow>()
      meetingType = mt
    }

    // Look up host user
    const { data: hostUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', meeting.host_user_id)
      .single<UserRow>()

    return NextResponse.json({
      id: meeting.id,
      status: meeting.status,
      startTime: meeting.start_time,
      endTime: meeting.end_time,
      timezone: meeting.timezone,
      googleMeetLink: meeting.google_meet_link,
      guestName: `${meeting.guest_first_name} ${meeting.guest_last_name}`,
      meetingType: meetingType
        ? {
            title: meetingType.title,
            duration_minutes: meetingType.duration_minutes,
            location_type: meetingType.location_type,
            description: meetingType.description,
          }
        : null,
      host: {
        name: hostUser?.name || 'Host',
      },
    })
  } catch (error) {
    console.error('Get meeting error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meeting' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update meeting status (cancel, complete, mark as no-show)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Check authentication
    const authClient = await createServerClient()
    const { data: { user: authUser } } = await authClient.auth.getUser()

    if (!authUser?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get CRM user
    const crmUser = await getCurrentCrmUser(authUser.email)
    if (!crmUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { status, reason } = body

    // Validate status
    const validStatuses = ['cancelled', 'completed', 'no_show']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: cancelled, completed, no_show' },
        { status: 400 }
      )
    }

    // Get the meeting and verify ownership
    const { data: meeting, error: fetchError } = await supabase
      .from('scheduled_meetings')
      .select('id, host_user_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Verify the user is the host
    if (meeting.host_user_id !== crmUser.id) {
      return NextResponse.json(
        { error: 'Not authorized to modify this meeting' },
        { status: 403 }
      )
    }

    // Check if meeting can be updated
    if (meeting.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Meeting is already cancelled' },
        { status: 400 }
      )
    }

    // Update the meeting
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'cancelled' && reason) {
      updateData.cancellation_reason = reason
      updateData.cancelled_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('scheduled_meetings')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('Failed to update meeting:', updateError)
      return NextResponse.json(
        { error: 'Failed to update meeting' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Meeting ${status}`,
    })
  } catch (error) {
    console.error('Update meeting error:', error)
    return NextResponse.json(
      { error: 'Failed to update meeting' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a cancelled meeting
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Check authentication
    const authClient = await createServerClient()
    const { data: { user: authUser } } = await authClient.auth.getUser()

    if (!authUser?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get CRM user
    const crmUser = await getCurrentCrmUser(authUser.email)
    if (!crmUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the meeting and verify ownership
    const { data: meeting, error: fetchError } = await supabase
      .from('scheduled_meetings')
      .select('id, host_user_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Verify the user is the host
    if (meeting.host_user_id !== crmUser.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this meeting' },
        { status: 403 }
      )
    }

    // Only allow deleting cancelled meetings
    if (meeting.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only cancelled meetings can be deleted' },
        { status: 400 }
      )
    }

    // Delete the meeting
    const { error: deleteError } = await supabase
      .from('scheduled_meetings')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete meeting:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete meeting' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Meeting deleted',
    })
  } catch (error) {
    console.error('Delete meeting error:', error)
    return NextResponse.json(
      { error: 'Failed to delete meeting' },
      { status: 500 }
    )
  }
}
