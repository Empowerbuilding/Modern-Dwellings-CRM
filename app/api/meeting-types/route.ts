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

interface CreateMeetingTypeRequest {
  title: string
  slug: string
  description?: string
  duration_minutes: number
  buffer_before?: number
  buffer_after?: number
  availability_start?: string
  availability_end?: string
  available_days?: number[]
  timezone?: string
  max_days_ahead?: number
  min_notice_hours?: number
  location_type: string
  custom_location?: string
  custom_fields?: unknown[]
  confirmation_message?: string
  brand_color?: string
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
  // Lowercase, alphanumeric and hyphens only, 3-50 chars
  const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/
  return slugRegex.test(slug) && !slug.includes('--')
}

/**
 * GET - List all meeting types for current user
 */
export async function GET() {
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

    // Query meeting types
    const { data: meetingTypes, error } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('user_id', crmUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch meeting types:', error)
      return NextResponse.json(
        { error: 'Failed to fetch meeting types' },
        { status: 500 }
      )
    }

    return NextResponse.json({ meetingTypes: meetingTypes || [] })
  } catch (error) {
    console.error('Meeting types GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create new meeting type
 */
export async function POST(request: NextRequest) {
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

    const body: CreateMeetingTypeRequest = await request.json()

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!body.slug?.trim()) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }

    if (!body.duration_minutes || body.duration_minutes < 5 || body.duration_minutes > 480) {
      return NextResponse.json(
        { error: 'Duration must be between 5 and 480 minutes' },
        { status: 400 }
      )
    }

    if (!body.location_type) {
      return NextResponse.json(
        { error: 'Location type is required' },
        { status: 400 }
      )
    }

    // Validate slug format
    const slug = body.slug.toLowerCase().trim()
    if (!isValidSlug(slug)) {
      return NextResponse.json(
        { error: 'Slug must be 3-50 characters, lowercase, alphanumeric and hyphens only' },
        { status: 400 }
      )
    }

    // Check if slug is unique globally
    const { data: existingSlug } = await supabase
      .from('meeting_types')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingSlug) {
      return NextResponse.json(
        { error: 'This URL slug is already taken. Please choose a different one.' },
        { status: 409 }
      )
    }

    // Insert meeting type
    const { data: meetingType, error: insertError } = await supabase
      .from('meeting_types')
      .insert({
        user_id: crmUser.id,
        title: body.title.trim(),
        slug,
        description: body.description?.trim() || null,
        duration_minutes: body.duration_minutes,
        buffer_before: body.buffer_before ?? 0,
        buffer_after: body.buffer_after ?? 15,
        availability_start: body.availability_start || '08:00',
        availability_end: body.availability_end || '17:00',
        available_days: body.available_days || [1, 2, 3, 4, 5],
        timezone: body.timezone || 'America/Chicago',
        max_days_ahead: body.max_days_ahead ?? 60,
        min_notice_hours: body.min_notice_hours ?? 4,
        location_type: body.location_type,
        custom_location: body.custom_location || null,
        custom_fields: body.custom_fields || [],
        confirmation_message: body.confirmation_message || null,
        brand_color: body.brand_color || '#2d3748',
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create meeting type:', insertError)
      return NextResponse.json(
        { error: 'Failed to create meeting type' },
        { status: 500 }
      )
    }

    return NextResponse.json({ meetingType }, { status: 201 })
  } catch (error) {
    console.error('Meeting types POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
