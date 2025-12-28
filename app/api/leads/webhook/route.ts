import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { LeadSource, SalesType } from '@/lib/types'

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
  sales_type?: SalesType
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

    // Determine sales_type based on source
    const salesType = determineSalesType(payload.source, payload.sales_type)

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
      // Determine client_type for cost_calc source
      const clientType = payload.source === 'cost_calc' ? 'consumer' : null

      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone || null,
          lead_source: payload.source,
          client_type: clientType,
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

    // Format metadata as nicely structured notes
    const dealNotes = formatDealNotes(payload.source, payload.metadata)

    // Create deal - value is always null, to be set manually later
    const dealTitle = `${payload.first_name} ${payload.last_name} - ${formatSource(payload.source)}`

    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        contact_id: contactId,
        title: dealTitle,
        value: null,
        stage: 'lead',
        sales_type: salesType,
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

// Determine sales_type based on source
function determineSalesType(source: LeadSource, explicitType?: SalesType): SalesType {
  // If explicitly provided, use that
  if (explicitType) {
    return explicitType
  }

  // Default to b2c for consumer-facing sources
  const b2cSources: LeadSource[] = ['cost_calc', 'website', 'contact_form', 'facebook', 'facebook_ad']
  if (b2cSources.includes(source)) {
    return 'b2c'
  }

  // Default to b2c for other sources as well
  return 'b2c'
}

// Format metadata into nicely structured notes
function formatDealNotes(source: LeadSource, metadata?: Record<string, unknown>): string {
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
    other: 'Other',
  }
  return sourceMap[source] || source
}
