import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Service role client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
