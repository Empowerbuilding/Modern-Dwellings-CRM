import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { ActivityType } from '@/lib/types'
import { sendFacebookEvent } from '@/lib/facebook-conversions'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60 // 60 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  record.count++
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return true
  }

  return false
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((record, ip) => {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip)
    }
  })
}, 60 * 1000)

const VALID_ACTIVITY_TYPES: ActivityType[] = [
  'page_view',
  'form_submit',
  'email_sent',
  'sms_sent',
  'call',
  'note',
  'stage_change',
  'deal_created',
  'contact_created',
]

interface TrackPayload {
  anonymous_id: string
  activity_type: ActivityType
  title: string
  page_url?: string
  metadata?: Record<string, unknown>
}

// Valid site identifiers
const VALID_SITES = ['barnhaus', 'empower', 'showcase', 'modern_dwellings', 'unknown']

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()

  // Get client IP for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown'

  // Check rate limit
  if (isRateLimited(ip)) {
    console.log(`[${timestamp}] Rate limited: ${ip}`)
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: corsHeaders }
    )
  }

  try {
    const payload: TrackPayload = await request.json()

    // Validate required fields
    if (!payload.anonymous_id || !payload.activity_type || !payload.title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: anonymous_id, activity_type, title' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate anonymous_id format (should be a reasonable length string)
    if (typeof payload.anonymous_id !== 'string' || payload.anonymous_id.length < 8 || payload.anonymous_id.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Invalid anonymous_id format' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate activity_type
    if (!VALID_ACTIVITY_TYPES.includes(payload.activity_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid activity_type. Must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}` },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate title length
    if (payload.title.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Title too long (max 500 characters)' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Extract and validate site identifier
    const site = (payload.metadata?.site as string) || 'unknown'
    const validSite = VALID_SITES.includes(site) ? site : 'unknown'

    // Build metadata object with site at top level for easy filtering
    const metadata: Record<string, unknown> = {
      ...payload.metadata,
      site: validSite,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || null,
      origin: request.headers.get('origin') || request.headers.get('referer') || null,
    }

    if (payload.page_url) {
      metadata.page_url = payload.page_url
    }

    // Create activity record
    const { data, error } = await supabase
      .from('activities')
      .insert({
        anonymous_id: payload.anonymous_id,
        activity_type: payload.activity_type,
        title: payload.title,
        metadata,
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[${timestamp}] Failed to create activity:`, error)
      return NextResponse.json(
        { success: false, error: 'Failed to create activity' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Log successful tracking with site info
    console.log(`[${timestamp}] Tracked ${payload.activity_type} from ${validSite}: ${payload.title.substring(0, 50)}`)

    // Send page view to Facebook CAPI for dual-stream tracking
    if (payload.activity_type === 'page_view') {
      try {
        // Extract Facebook cookies from metadata if provided
        const fbp = payload.metadata?.fbp as string | undefined
        const fbc = payload.metadata?.fbc as string | undefined
        const fbclid = payload.metadata?.fbclid as string | undefined

        await sendFacebookEvent({
          eventName: 'PageView',
          eventId: data.id, // Use activity ID for deduplication
          userData: {
            fbp: fbp || null,
            fbclid: fbc || fbclid || null,
            clientIpAddress: ip || null,
            clientUserAgent: request.headers.get('user-agent') || null,
            externalId: payload.anonymous_id || null,
          },
          eventSourceUrl: payload.page_url || undefined,
        })

        console.log(`[${timestamp}] Sent PageView to Facebook CAPI`)
      } catch (fbError) {
        // Don't fail the tracking if FB event fails
        console.error(`[${timestamp}] Facebook PageView error (non-fatal):`, fbError)
      }
    }

    return NextResponse.json(
      { success: true, activity_id: data.id },
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error(`[${timestamp}] Track activity error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// Allow CORS for tracking from external websites
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
