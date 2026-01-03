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
  name: string
}

/**
 * Get the CRM user record for the authenticated user
 */
async function getCurrentCrmUser(authUserEmail: string): Promise<CrmUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', authUserEmail)
    .single<CrmUser>()

  if (error || !data) {
    return null
  }
  return data
}

/**
 * GET - List meetings for the current user
 * Query params:
 *   - status: filter by status (scheduled, completed, cancelled, etc.)
 *   - upcoming: if "true", only future meetings
 *   - past: if "true", only past meetings
 *   - contactId: filter by contact ID
 *   - limit: number of results (default 10, max 100)
 *   - offset: pagination offset
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === 'true'
    const past = searchParams.get('past') === 'true'
    const contactId = searchParams.get('contactId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('scheduled_meetings')
      .select(`
        id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        guest_notes,
        start_time,
        end_time,
        timezone,
        status,
        google_meet_link,
        contact_id,
        created_at,
        meeting_types (
          id,
          title,
          duration_minutes,
          location_type,
          slug
        ),
        contacts (
          id,
          first_name,
          last_name
        )
      `)
      .eq('host_user_id', crmUser.id)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    const now = new Date().toISOString()
    if (upcoming) {
      query = query.gte('start_time', now)
      query = query.order('start_time', { ascending: true })
    } else if (past) {
      query = query.lt('start_time', now)
      query = query.order('start_time', { ascending: false })
    } else {
      query = query.order('start_time', { ascending: false })
    }

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: meetings, error } = await query

    if (error) {
      console.error('Failed to fetch meetings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch meetings' },
        { status: 500 }
      )
    }

    // Transform the data to flatten nested objects
    const transformedMeetings = (meetings || []).map((m: any) => ({
      id: m.id,
      guest_first_name: m.guest_first_name,
      guest_last_name: m.guest_last_name,
      guest_email: m.guest_email,
      guest_phone: m.guest_phone,
      guest_notes: m.guest_notes,
      start_time: m.start_time,
      end_time: m.end_time,
      timezone: m.timezone,
      status: m.status,
      google_meet_link: m.google_meet_link,
      contact_id: m.contact_id,
      created_at: m.created_at,
      meeting_type: m.meeting_types,
      contact: m.contacts,
    }))

    return NextResponse.json({ meetings: transformedMeetings })
  } catch (error) {
    console.error('Meetings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
