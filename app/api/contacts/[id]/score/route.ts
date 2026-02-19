import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { scoreContact } from '@/lib/lead-scoring'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const contactId = params.id

    // Fetch contact
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('id, lead_source, notes')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Find the most recent system-generated note with source info
    const { data: notes } = await supabaseAdmin
      .from('notes')
      .select('content')
      .eq('contact_id', contactId)
      .is('created_by', null)
      .order('created_at', { ascending: true })
      .limit(1)

    const noteText = notes?.[0]?.content || contact.notes || null

    // Score the contact
    const { score, reason } = scoreContact(contact.lead_source, noteText)

    // Update contact with score
    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update({
        lead_score: score,
        lead_score_reason: reason,
        lead_score_updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (updateError) {
      console.error('Failed to update lead score:', updateError)
      return NextResponse.json(
        { error: 'Failed to update lead score' },
        { status: 500 }
      )
    }

    return NextResponse.json({ score, reason })
  } catch (error) {
    console.error('Score contact error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
