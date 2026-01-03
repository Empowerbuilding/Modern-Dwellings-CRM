import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { LeadSource, LifecycleStage } from '@/lib/types'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface LeadWebhookPayload {
  first_name: string
  last_name: string
  email: string
  phone?: string
  source: LeadSource
  fbclid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  metadata?: Record<string, unknown>
  anonymous_id?: string  // For linking anonymous page views to the new contact
}

// Determine lifecycle stage based on lead source
function getLifecycleStageForSource(source: LeadSource): LifecycleStage {
  // Calendar bookings are more engaged - they're leads
  if (source === 'calendar_booking') {
    return 'lead'
  }
  // All other sources start as subscribers
  // They become 'lead' when they book a meeting or take a more engaged action
  return 'subscriber'
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()

  // Verify API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    console.log(`[${timestamp}] Webhook rejected: Invalid API key`)
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const payload: LeadWebhookPayload = await request.json()

    // Log incoming request
    console.log(`[${timestamp}] Lead webhook received:`, {
      name: `${payload.first_name} ${payload.last_name}`,
      email: payload.email,
      source: payload.source,
      fbclid: payload.fbclid ? 'present' : 'none',
      metadata: payload.metadata ? Object.keys(payload.metadata) : 'none'
    })

    // Validate required fields
    if (!payload.first_name || !payload.last_name || !payload.email || !payload.source) {
      console.log(`[${timestamp}] Webhook rejected: Missing required fields`)
      return NextResponse.json(
        { success: false, error: 'Missing required fields: first_name, last_name, email, source' },
        { status: 400 }
      )
    }

    // Format metadata into contact notes
    const contactNotes = formatContactNotes(payload.source, payload.metadata)

    // Check if contact already exists by email
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', payload.email)
      .single()

    let contactId: string

    if (existingContact) {
      // Update existing contact with fbclid and anonymous_id if provided
      contactId = existingContact.id
      const updateData: Record<string, string> = {}
      if (payload.fbclid) updateData.fbclid = payload.fbclid
      if (payload.anonymous_id) updateData.anonymous_id = payload.anonymous_id

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contactId)
      }
      console.log(`[${timestamp}] Using existing contact: ${contactId}`)
    } else {
      // Determine client_type for cost_calc source
      const clientType = payload.source === 'cost_calc' ? 'consumer' : null

      // Determine lifecycle stage based on source
      const lifecycleStage = getLifecycleStageForSource(payload.source)

      console.log(`[${timestamp}] Creating ${lifecycleStage} contact:`, {
        email: payload.email,
        source: payload.source,
        fbclid: !!payload.fbclid,
      })

      // Create new contact with lifecycle_stage and empty fb_events_sent
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone || null,
          lead_source: payload.source,
          client_type: clientType,
          lifecycle_stage: lifecycleStage,
          fb_events_sent: {},  // Initialize as empty - no FB events sent for subscribers
          fbclid: payload.fbclid || null,
          anonymous_id: payload.anonymous_id || null,
          notes: contactNotes || null,
          is_primary: true,
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error(`[${timestamp}] Failed to create contact:`, contactError)
        return NextResponse.json(
          { success: false, error: 'Failed to create contact' },
          { status: 500 }
        )
      }

      contactId = newContact.id
      console.log(`[${timestamp}] Created new ${lifecycleStage} contact: ${contactId}`)

      // Also create in the notes table for the Notes Section
      if (contactNotes) {
        const { error: noteError } = await supabase.from('notes').insert({
          contact_id: contactId,
          content: contactNotes,
        })
        if (noteError) {
          console.error(`[${timestamp}] Failed to create note:`, noteError)
          // Don't fail the webhook, contact was created successfully
        }
      }

      // Log contact_created activity
      await supabase.from('activities').insert({
        contact_id: contactId,
        activity_type: 'contact_created',
        title: `Contact created: ${payload.first_name} ${payload.last_name}`,
        metadata: {
          source: payload.source,
          email: payload.email,
          phone: payload.phone || null,
        },
        anonymous_id: payload.anonymous_id || null,
      })
    }

    // Link any anonymous activities to this contact
    if (payload.anonymous_id) {
      const { data: linkedActivities } = await supabase
        .from('activities')
        .update({ contact_id: contactId })
        .eq('anonymous_id', payload.anonymous_id)
        .is('contact_id', null)
        .select('id')

      const linkedCount = linkedActivities?.length || 0
      if (linkedCount > 0) {
        console.log(`[${timestamp}] Linked ${linkedCount} anonymous activities to contact: ${contactId}`)
      }
    }

    // Log form_submit activity with UTM parameters
    await supabase.from('activities').insert({
      contact_id: contactId,
      activity_type: 'form_submit',
      title: `Submitted ${formatSource(payload.source)} form`,
      metadata: {
        source: payload.source,
        form_data: payload.metadata || null,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        fbclid: payload.fbclid || null,
      },
      anonymous_id: payload.anonymous_id || null,
    })

    return NextResponse.json({
      success: true,
      contact_id: contactId,
    })

  } catch (error) {
    console.error(`[${timestamp}] Webhook error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Format metadata into nicely structured notes for contact
function formatContactNotes(source: LeadSource, metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return `Source: ${formatSource(source)}`
  }

  const lines: string[] = []

  // Add source
  lines.push(`Source: ${formatSource(source)}`)

  // Handle cost calculator specific fields
  if (source === 'cost_calc') {
    if (metadata.estimated_price || metadata.estimated_cost || metadata.build_cost) {
      const cost = metadata.estimated_price || metadata.estimated_cost || metadata.build_cost
      lines.push(`Estimated Build Cost: ${formatCurrency(Number(cost))}`)
    }

    // Build project summary line
    const projectParts: string[] = []
    if (metadata.bedrooms) projectParts.push(`${metadata.bedrooms}BR`)
    if (metadata.bathrooms) projectParts.push(`${metadata.bathrooms}BA`)
    if (metadata.sqft || metadata.square_feet) {
      const sqft = metadata.sqft || metadata.square_feet
      projectParts.push(`${Number(sqft).toLocaleString()} sq ft`)
    }
    if (projectParts.length > 0) {
      lines.push(`Project: ${projectParts.join(' • ')}`)
    }

    if (metadata.location || metadata.city) {
      lines.push(`Location: ${metadata.location || metadata.city}`)
    }

    if (metadata.foundation) {
      lines.push(`Foundation: ${metadata.foundation}`)
    }

    if (metadata.stories) {
      lines.push(`Stories: ${metadata.stories}`)
    }

    if (metadata.garage) {
      lines.push(`Garage: ${metadata.garage}`)
    }
  } else {
    // For other sources, include any provided metadata
    const skipKeys = ['message', 'notes', 'comments']

    for (const [key, value] of Object.entries(metadata)) {
      if (skipKeys.includes(key.toLowerCase())) continue
      if (value === null || value === undefined || value === '') continue

      const formattedKey = formatKey(key)
      const formattedValue = typeof value === 'number' && key.toLowerCase().includes('price')
        ? formatCurrency(value)
        : String(value)

      lines.push(`${formattedKey}: ${formattedValue}`)
    }
  }

  // Add message/notes at the end if present
  const message = metadata.message || metadata.notes || metadata.comments
  if (message) {
    lines.push(``)
    lines.push(`Message: ${message}`)
  }

  return lines.join('\n')
}

// Helper to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Helper to format metadata keys for display
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Helper to format source for deal title and notes
function formatSource(source: string): string {
  const sourceMap: Record<string, string> = {
    facebook: 'Facebook',
    facebook_ad: 'Facebook Ad',
    google: 'Google',
    referral: 'Referral',
    website: 'Website',
    contact_form: 'Contact Form',
    cost_calc: 'Cost Calculator',
    cold: 'Cold',
    repeat: 'Repeat',
    guide_download: 'Guide Download',
    empower_website: 'Empower Website',
    barnhaus_contact: 'Barnhaus Contact',
    barnhaus_store_contact: 'Barnhaus Store',
    shopify_order: 'Shopify Order',
    calendar_booking: 'Calendar Booking',
    other: 'Other',
  }
  return sourceMap[source] || source
}
