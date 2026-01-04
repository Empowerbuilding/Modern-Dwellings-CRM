import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendFacebookEvent, type FacebookEventName } from '@/lib/facebook-conversions'
import type { LifecycleStage } from '@/lib/types'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STAGES: LifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'customer']

// Map lifecycle stages to Facebook event names
const STAGE_TO_FB_EVENT: Partial<Record<LifecycleStage, FacebookEventName>> = {
  lead: 'lead',
  mql: 'marketingqualifiedlead',
  sql: 'salesqualifiedlead',
  customer: 'customer',
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  fbclid: string | null
  fb_lead_id: string | null
  lifecycle_stage: LifecycleStage | null
  fb_events_sent: Record<string, string> | null
}

interface UpdateLifecycleRequest {
  lifecycle_stage: LifecycleStage
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date().toISOString()

  try {
    // 1. Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body: UpdateLifecycleRequest = await request.json()
    const { lifecycle_stage } = body

    if (!lifecycle_stage || !VALID_STAGES.includes(lifecycle_stage)) {
      return NextResponse.json(
        { error: `Invalid lifecycle_stage. Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    const contactId = params.id

    // 3. Get current contact from database
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, phone, fbclid, fb_lead_id, lifecycle_stage, fb_events_sent')
      .eq('id', contactId)
      .single<ContactRow>()

    if (contactError || !contact) {
      console.error(`[${timestamp}] Contact not found:`, contactError)
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    console.log(`[${timestamp}] Updating lifecycle for contact ${contactId}: ${contact.lifecycle_stage} → ${lifecycle_stage}`)

    // 4. Prepare updates
    const updates: Record<string, unknown> = {
      lifecycle_stage,
    }

    let fbEventSent = false
    let fbEventName: FacebookEventName | null = null

    // 5. Check if we should send a Facebook event
    const fbEventForStage = STAGE_TO_FB_EVENT[lifecycle_stage]
    if (fbEventForStage) {
      const fbEventsSent = contact.fb_events_sent || {}
      const eventAlreadySent = !!fbEventsSent[lifecycle_stage]

      if (!eventAlreadySent) {
        console.log(`[${timestamp}] Sending ${fbEventForStage} event to Facebook for contact:`, contactId)

        try {
          const fbResult = await sendFacebookEvent({
            eventName: fbEventForStage,
            eventId: `${contact.id}-${lifecycle_stage}`,
            userData: {
              email: contact.email,
              phone: contact.phone,
              firstName: contact.first_name,
              lastName: contact.last_name,
              fbclid: contact.fbclid,
              leadId: contact.fb_lead_id,
              externalId: contact.id,
            },
            customData: {
              leadEventSource: 'crm_lifecycle_update',
            },
          })

          console.log(`[${timestamp}] Facebook ${fbEventForStage} event result:`, fbResult)

          if (fbResult.success) {
            fbEventSent = true
            fbEventName = fbEventForStage
            // Record that this event was sent
            updates.fb_events_sent = {
              ...fbEventsSent,
              [lifecycle_stage]: new Date().toISOString(),
            }
          }
        } catch (fbError) {
          console.error(`[${timestamp}] Facebook event error (non-fatal):`, fbError)
          // Continue with lifecycle update even if FB fails
        }
      } else {
        console.log(`[${timestamp}] ${fbEventForStage} event already sent for contact:`, contactId)
      }
    }

    // 6. Update the contact in database
    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updates)
      .eq('id', contactId)

    if (updateError) {
      console.error(`[${timestamp}] Failed to update contact:`, updateError)
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Contact ${contactId} updated successfully`)

    // 7. Return success response
    return NextResponse.json({
      success: true,
      lifecycle_stage,
      fb_event_sent: fbEventSent,
      fb_event_name: fbEventName,
      message: fbEventSent
        ? `Status updated & sent to Facebook (${fbEventName})`
        : 'Status updated',
    })
  } catch (error) {
    console.error(`[${timestamp}] Lifecycle update error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
