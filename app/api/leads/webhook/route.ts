import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { LeadSource } from '@/lib/types'

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
  metadata?: Record<string, unknown>
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

    // Check if contact already exists by email
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', payload.email)
      .single()

    let contactId: string

    if (existingContact) {
      // Update existing contact with fbclid if provided
      contactId = existingContact.id
      if (payload.fbclid) {
        await supabase
          .from('contacts')
          .update({ fbclid: payload.fbclid })
          .eq('id', contactId)
      }
      console.log(`[${timestamp}] Using existing contact: ${contactId}`)
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone || null,
          lead_source: payload.source,
          fbclid: payload.fbclid || null,
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
      console.log(`[${timestamp}] Created new contact: ${contactId}`)
    }

    // Format metadata as notes
    let dealNotes = ''
    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      dealNotes = 'Lead Details:\n' + Object.entries(payload.metadata)
        .map(([key, value]) => `- ${formatKey(key)}: ${value}`)
        .join('\n')
    }

    // Get deal value from metadata if present
    const dealValue = payload.metadata?.estimated_price
      ? Number(payload.metadata.estimated_price)
      : null

    // Create deal
    const dealTitle = `${payload.first_name} ${payload.last_name} - ${formatSource(payload.source)}`

    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        contact_id: contactId,
        title: dealTitle,
        value: dealValue,
        stage: 'lead',
        sales_type: 'b2c',
        notes: dealNotes || null,
      })
      .select('id')
      .single()

    if (dealError || !newDeal) {
      console.error(`[${timestamp}] Failed to create deal:`, dealError)
      return NextResponse.json(
        { success: false, error: 'Failed to create deal' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Created deal: ${newDeal.id} for contact: ${contactId}`)

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      deal_id: newDeal.id,
    })

  } catch (error) {
    console.error(`[${timestamp}] Webhook error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper to format metadata keys for display
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Helper to format source for deal title
function formatSource(source: string): string {
  const sourceMap: Record<string, string> = {
    facebook: 'Facebook',
    google: 'Google',
    referral: 'Referral',
    website: 'Website',
    cold: 'Cold',
    repeat: 'Repeat',
    other: 'Other',
  }
  return sourceMap[source] || source
}
