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

interface UpdateMeetingTypeRequest {
  title?: string
  slug?: string
  description?: string | null
  duration_minutes?: number
  buffer_before?: number
  buffer_after?: number
  availability_start?: string
  availability_end?: string
  available_days?: number[]
  timezone?: string
  max_days_ahead?: number
  min_notice_hours?: number
  location_type?: string
  custom_location?: string | null
  custom_fields?: unknown[]
  confirmation_message?: string | null
  brand_color?: string
  is_active?: boolean
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
 * Validate slug format
 */
function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/
  return slugRegex.test(slug) && !slug.includes('--')
}

/**
 * GET - Get single meeting type
 */
export async function GET(
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

    // Get meeting type
    const { data: meetingType, error } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !meetingType) {
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (meetingType.user_id !== crmUser.id) {
      return NextResponse.json(
        { error: 'Not authorized to access this meeting type' },
        { status: 403 }
      )
    }

    return NextResponse.json({ meetingType })
  } catch (error) {
    console.error('Meeting type GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update meeting type
 */
export async function PUT(
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

    // Get existing meeting type
    const { data: existing, error: fetchError } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (existing.user_id !== crmUser.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this meeting type' },
        { status: 403 }
      )
    }

    const body: UpdateMeetingTypeRequest = await request.json()

    // If slug is being changed, validate and check uniqueness
    if (body.slug !== undefined && body.slug !== existing.slug) {
      const slug = body.slug.toLowerCase().trim()

      if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: 'Slug must be 3-50 characters, lowercase, alphanumeric and hyphens only' },
          { status: 400 }
        )
      }

      // Check if new slug is unique
      const { data: existingSlug } = await supabase
        .from('meeting_types')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .single()

      if (existingSlug) {
        return NextResponse.json(
          { error: 'This URL slug is already taken. Please choose a different one.' },
          { status: 409 }
        )
      }

      body.slug = slug
    }

    // Validate duration if provided
    if (body.duration_minutes !== undefined) {
      if (body.duration_minutes < 5 || body.duration_minutes > 480) {
        return NextResponse.json(
          { error: 'Duration must be between 5 and 480 minutes' },
          { status: 400 }
        )
      }
    }

    // Build update object (only include defined fields)
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) updateData.title = body.title.trim()
    if (body.slug !== undefined) updateData.slug = body.slug
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes
    if (body.buffer_before !== undefined) updateData.buffer_before = body.buffer_before
    if (body.buffer_after !== undefined) updateData.buffer_after = body.buffer_after
    if (body.availability_start !== undefined) updateData.availability_start = body.availability_start
    if (body.availability_end !== undefined) updateData.availability_end = body.availability_end
    if (body.available_days !== undefined) updateData.available_days = body.available_days
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.max_days_ahead !== undefined) updateData.max_days_ahead = body.max_days_ahead
    if (body.min_notice_hours !== undefined) updateData.min_notice_hours = body.min_notice_hours
    if (body.location_type !== undefined) updateData.location_type = body.location_type
    if (body.custom_location !== undefined) updateData.custom_location = body.custom_location
    if (body.custom_fields !== undefined) updateData.custom_fields = body.custom_fields
    if (body.confirmation_message !== undefined) updateData.confirmation_message = body.confirmation_message
    if (body.brand_color !== undefined) updateData.brand_color = body.brand_color
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // Update meeting type
    const { data: meetingType, error: updateError } = await supabase
      .from('meeting_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update meeting type:', updateError)
      return NextResponse.json(
        { error: 'Failed to update meeting type' },
        { status: 500 }
      )
    }

    return NextResponse.json({ meetingType })
  } catch (error) {
    console.error('Meeting type PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete meeting type
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

    // Get existing meeting type
    const { data: existing, error: fetchError } = await supabase
      .from('meeting_types')
      .select('id, user_id, title')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Meeting type not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (existing.user_id !== crmUser.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this meeting type' },
        { status: 403 }
      )
    }

    // Check for future scheduled meetings
    const now = new Date().toISOString()
    const { data: upcomingMeetings, error: meetingsError } = await supabase
      .from('scheduled_meetings')
      .select('id')
      .eq('meeting_type_id', id)
      .gte('start_time', now)
      .in('status', ['scheduled', 'rescheduled'])
      .limit(1)

    if (meetingsError) {
      console.error('Failed to check upcoming meetings:', meetingsError)
      return NextResponse.json(
        { error: 'Failed to check upcoming meetings' },
        { status: 500 }
      )
    }

    if (upcomingMeetings && upcomingMeetings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete meeting type with upcoming meetings. Cancel or reassign them first.' },
        { status: 400 }
      )
    }

    // Delete the meeting type
    const { error: deleteError } = await supabase
      .from('meeting_types')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete meeting type:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete meeting type' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Meeting type DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
