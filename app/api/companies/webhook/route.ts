import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { ClientType } from '@/lib/types'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Payload type from website form submissions
type WebhookCompanyType = 'subcontractor' | 'realtor'

interface CompanyWebhookPayload {
  company_name: string
  contact_name: string
  email: string
  phone?: string
  type: WebhookCompanyType
  website?: string
  metadata?: {
    trade_type?: string
    service_area?: string
    years_in_business?: string
    number_of_crews?: string
    crew_type?: string
    current_builders?: string
    message?: string
  }
}

// Map webhook type to database ClientType
function mapToClientType(type: WebhookCompanyType): ClientType {
  // Both subcontractor and realtor map directly to ClientType
  return type
}

// Parse contact name into first and last name
function parseContactName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

// Format metadata into nicely structured notes for company
function formatCompanyNotes(type: WebhookCompanyType, metadata?: CompanyWebhookPayload['metadata']): string {
  const lines: string[] = []

  lines.push(`Type: ${type === 'subcontractor' ? 'Subcontractor/Partner' : 'Realtor'}`)

  if (!metadata) {
    return lines.join('\n')
  }

  if (metadata.trade_type) {
    lines.push(`Trade: ${metadata.trade_type}`)
  }

  if (metadata.service_area) {
    lines.push(`Service Area: ${metadata.service_area}`)
  }

  if (metadata.years_in_business) {
    lines.push(`Years in Business: ${metadata.years_in_business}`)
  }

  if (metadata.number_of_crews) {
    lines.push(`Number of Crews: ${metadata.number_of_crews}`)
  }

  if (metadata.crew_type) {
    lines.push(`Crew Type: ${metadata.crew_type}`)
  }

  if (metadata.current_builders) {
    lines.push(`Current Builders: ${metadata.current_builders}`)
  }

  if (metadata.message) {
    lines.push('')
    lines.push(`Message: ${metadata.message}`)
  }

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()

  // Verify API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    console.log(`[${timestamp}] Company webhook rejected: Invalid API key`)
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const payload: CompanyWebhookPayload = await request.json()

    // Log incoming request
    console.log(`[${timestamp}] Company webhook received:`, {
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      email: payload.email,
      type: payload.type,
      metadata: payload.metadata ? Object.keys(payload.metadata) : 'none',
    })

    // Validate required fields
    if (!payload.company_name || !payload.contact_name || !payload.email || !payload.type) {
      console.log(`[${timestamp}] Company webhook rejected: Missing required fields`)
      return NextResponse.json(
        { success: false, error: 'Missing required fields: company_name, contact_name, email, type' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['subcontractor', 'realtor'].includes(payload.type)) {
      console.log(`[${timestamp}] Company webhook rejected: Invalid type`)
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be one of: subcontractor, realtor' },
        { status: 400 }
      )
    }

    const clientType = mapToClientType(payload.type)
    const { firstName, lastName } = parseContactName(payload.contact_name)
    const companyNotes = formatCompanyNotes(payload.type, payload.metadata)

    let companyId: string
    let contactId: string
    let isNewCompany = false
    let isNewContact = false

    // Check if contact already exists by email (and has a company)
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .eq('email', payload.email)
      .single()

    if (existingContact?.company_id) {
      // Contact exists with a company - update both
      contactId = existingContact.id
      companyId = existingContact.company_id

      console.log(`[${timestamp}] Found existing contact ${contactId} with company ${companyId}`)

      // Update company
      const { error: companyUpdateError } = await supabase
        .from('companies')
        .update({
          name: payload.company_name,
          type: clientType,
          website: payload.website || null,
          notes: companyNotes,
        })
        .eq('id', companyId)

      if (companyUpdateError) {
        console.error(`[${timestamp}] Failed to update company:`, companyUpdateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update company' },
          { status: 500 }
        )
      }

      // Update contact
      const { error: contactUpdateError } = await supabase
        .from('contacts')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: payload.phone || null,
          client_type: clientType,
        })
        .eq('id', contactId)

      if (contactUpdateError) {
        console.error(`[${timestamp}] Failed to update contact:`, contactUpdateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update contact' },
          { status: 500 }
        )
      }

      console.log(`[${timestamp}] Updated existing company ${companyId} and contact ${contactId}`)

    } else if (existingContact) {
      // Contact exists but without a company - create company and link
      contactId = existingContact.id

      console.log(`[${timestamp}] Found existing contact ${contactId} without company, creating company`)

      // Create new company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: payload.company_name,
          type: clientType,
          website: payload.website || null,
          notes: companyNotes,
        })
        .select('id')
        .single()

      if (companyError || !newCompany) {
        console.error(`[${timestamp}] Failed to create company:`, companyError)
        return NextResponse.json(
          { success: false, error: 'Failed to create company' },
          { status: 500 }
        )
      }

      companyId = newCompany.id
      isNewCompany = true

      // Update contact with company link and other details
      const { error: contactUpdateError } = await supabase
        .from('contacts')
        .update({
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          phone: payload.phone || null,
          client_type: clientType,
          is_primary: true,
        })
        .eq('id', contactId)

      if (contactUpdateError) {
        console.error(`[${timestamp}] Failed to update contact with company:`, contactUpdateError)
        return NextResponse.json(
          { success: false, error: 'Failed to link contact to company' },
          { status: 500 }
        )
      }

      console.log(`[${timestamp}] Created company ${companyId} and linked to contact ${contactId}`)

    } else {
      // No existing contact - create both company and contact
      console.log(`[${timestamp}] No existing contact found, creating company and contact`)

      // Create new company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: payload.company_name,
          type: clientType,
          website: payload.website || null,
          notes: companyNotes,
        })
        .select('id')
        .single()

      if (companyError || !newCompany) {
        console.error(`[${timestamp}] Failed to create company:`, companyError)
        return NextResponse.json(
          { success: false, error: 'Failed to create company' },
          { status: 500 }
        )
      }

      companyId = newCompany.id
      isNewCompany = true

      // Create new contact linked to company
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          email: payload.email,
          phone: payload.phone || null,
          client_type: clientType,
          is_primary: true,
          lead_source: 'other', // Partner/company submissions
          lifecycle_stage: 'subscriber',
          fb_events_sent: {},
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error(`[${timestamp}] Failed to create contact:`, contactError)
        // Try to clean up the company we just created
        await supabase.from('companies').delete().eq('id', companyId)
        return NextResponse.json(
          { success: false, error: 'Failed to create contact' },
          { status: 500 }
        )
      }

      contactId = newContact.id
      isNewContact = true

      console.log(`[${timestamp}] Created company ${companyId} and contact ${contactId}`)

      // Log contact_created activity
      await supabase.from('activities').insert({
        contact_id: contactId,
        company_id: companyId,
        activity_type: 'contact_created',
        title: `Contact created: ${firstName} ${lastName}`,
        metadata: {
          source: 'company_webhook',
          company_name: payload.company_name,
          email: payload.email,
          phone: payload.phone || null,
        },
      })
    }

    // Also create a note in the notes table if we have metadata
    if (companyNotes && isNewCompany) {
      const { error: noteError } = await supabase.from('notes').insert({
        company_id: companyId,
        content: companyNotes,
      })
      if (noteError) {
        console.error(`[${timestamp}] Failed to create note:`, noteError)
        // Don't fail the webhook, company/contact were created successfully
      }
    }

    // Log form_submit activity
    await supabase.from('activities').insert({
      contact_id: contactId,
      company_id: companyId,
      activity_type: 'form_submit',
      title: `Submitted ${payload.type === 'subcontractor' ? 'partner application' : 'realtor inquiry'}`,
      metadata: {
        source: 'company_webhook',
        company_name: payload.company_name,
        type: payload.type,
        form_data: payload.metadata || null,
      },
    })

    console.log(`[${timestamp}] Company webhook completed successfully:`, {
      company_id: companyId,
      contact_id: contactId,
      is_new_company: isNewCompany,
      is_new_contact: isNewContact,
    })

    return NextResponse.json({
      success: true,
      company_id: companyId,
      contact_id: contactId,
    })

  } catch (error) {
    console.error(`[${timestamp}] Company webhook error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
