import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendFacebookEvent } from '@/lib/facebook-conversions'
import type { PipelineStage, LifecycleStage, SalesType } from '@/lib/types'
import { B2C_WON_STAGES, isB2CWonStage } from '@/lib/types'

// Service role client for database operations
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STAGES: PipelineStage[] = [
  'qualified', 'concept', 'design', 'engineering',
  'proposal', 'active', 'complete', 'lost'
]

// B2B "won" stage that triggers customer event
const B2B_WON_STAGE: PipelineStage = 'complete'

// Check if moving to this stage should trigger "won" event
function isWonStageTransition(newStage: PipelineStage, previousStage: PipelineStage, salesType: SalesType): boolean {
  if (salesType === 'b2c') {
    // B2C: won when entering concept/design/engineering (from qualified)
    // Only trigger if coming from a non-won stage
    const wasWon = isB2CWonStage(previousStage)
    const isNowWon = isB2CWonStage(newStage)
    return !wasWon && isNowWon
  }
  // B2B: won when entering 'complete'
  return newStage === B2B_WON_STAGE && previousStage !== B2B_WON_STAGE
}

interface DealRow {
  id: string
  title: string
  value: number | null
  stage: PipelineStage
  sales_type: SalesType
  contact_id: string | null
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  fbclid: string | null
  lifecycle_stage: LifecycleStage | null
  fb_events_sent: Record<string, string> | null
}

interface UpdateStageRequest {
  stage: PipelineStage
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date().toISOString()
  const dealId = params.id

  try {
    // 1. Parse and validate request body
    const body: UpdateStageRequest = await request.json()
    const { stage } = body

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    // 2. Get current deal from database
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('deals')
      .select('id, title, value, stage, sales_type, contact_id')
      .eq('id', dealId)
      .single<DealRow>()

    if (dealError || !deal) {
      console.error(`[${timestamp}] Deal not found:`, dealError)
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    const previousStage = deal.stage
    console.log(`[${timestamp}] Updating deal ${dealId} stage: ${previousStage} → ${stage}`)

    // 3. Update deal stage
    const { error: updateError } = await supabaseAdmin
      .from('deals')
      .update({ stage })
      .eq('id', dealId)

    if (updateError) {
      console.error(`[${timestamp}] Failed to update deal stage:`, updateError)
      return NextResponse.json(
        { error: 'Failed to update deal stage' },
        { status: 500 }
      )
    }

    // 4. Log stage change activity
    if (deal.contact_id) {
      await supabaseAdmin.from('activities').insert({
        deal_id: dealId,
        contact_id: deal.contact_id,
        activity_type: 'stage_change',
        title: `Stage: ${previousStage} → ${stage}`,
        metadata: {
          previous_stage: previousStage,
          new_stage: stage,
          deal_title: deal.title,
        },
      })
    }

    // 5. Handle "won" stage - send Facebook customer event
    // B2C: triggers when entering concept/design/engineering
    // B2B: triggers when entering complete
    let fbEventSent = false
    const shouldSendWonEvent = isWonStageTransition(stage, previousStage, deal.sales_type)
    if (shouldSendWonEvent && deal.contact_id) {
      try {
        // Get contact details
        const { data: contact, error: contactError } = await supabaseAdmin
          .from('contacts')
          .select('id, first_name, last_name, email, phone, fbclid, lifecycle_stage, fb_events_sent')
          .eq('id', deal.contact_id)
          .single<ContactRow>()

        if (contactError || !contact) {
          console.error(`[${timestamp}] Failed to get contact for Facebook event:`, contactError)
        } else {
          // Check if customer event was already sent
          const fbEventsSent = contact.fb_events_sent || {}
          const customerEventAlreadySent = !!fbEventsSent['customer']

          if (!customerEventAlreadySent) {
            console.log(`[${timestamp}] Deal won, sending customer event to Facebook:`, {
              dealId,
              contactId: contact.id,
              value: deal.value,
            })

            const fbResult = await sendFacebookEvent({
              eventName: 'customer',
              eventId: `${contact.id}-customer`,
              userData: {
                email: contact.email,
                phone: contact.phone,
                firstName: contact.first_name,
                lastName: contact.last_name,
                fbclid: contact.fbclid,
                externalId: contact.id,
              },
              customData: {
                value: deal.value ?? undefined,
                currency: 'USD',
              },
            })

            console.log(`[${timestamp}] Facebook customer event result:`, fbResult)

            if (fbResult.success) {
              fbEventSent = true

              // Update contact: lifecycle_stage to 'customer' and record fb_event
              const { error: contactUpdateError } = await supabaseAdmin
                .from('contacts')
                .update({
                  lifecycle_stage: 'customer' as LifecycleStage,
                  fb_events_sent: {
                    ...fbEventsSent,
                    customer: new Date().toISOString(),
                  },
                })
                .eq('id', contact.id)

              if (contactUpdateError) {
                console.error(`[${timestamp}] Failed to update contact after FB event:`, contactUpdateError)
              } else {
                console.log(`[${timestamp}] Updated contact ${contact.id} to customer status`)
              }
            }
          } else {
            console.log(`[${timestamp}] Customer event already sent for contact:`, contact.id)

            // Still update lifecycle_stage to customer if not already
            if (contact.lifecycle_stage !== 'customer') {
              await supabaseAdmin
                .from('contacts')
                .update({ lifecycle_stage: 'customer' as LifecycleStage })
                .eq('id', contact.id)
            }
          }
        }
      } catch (fbError) {
        // Don't fail the deal update if Facebook event fails
        console.error(`[${timestamp}] Facebook event error (non-fatal):`, fbError)
      }
    }

    // 6. Return success response
    return NextResponse.json({
      success: true,
      stage,
      previous_stage: previousStage,
      fb_event_sent: fbEventSent,
    })
  } catch (error) {
    console.error(`[${timestamp}] Deal stage update error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
