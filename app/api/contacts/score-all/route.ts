import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { scoreContact } from '@/lib/lead-scoring'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Fetch all unscored contacts
    const { data: contacts, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, lead_source, notes')
      .is('lead_score', null)

    if (fetchError) {
      console.error('Failed to fetch unscored contacts:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ scored: 0, results: [] })
    }

    // Get all system-generated notes for these contacts in one query
    const contactIds = contacts.map(c => c.id)
    const { data: allNotes } = await supabaseAdmin
      .from('notes')
      .select('contact_id, content')
      .in('contact_id', contactIds)
      .is('created_by', null)
      .order('created_at', { ascending: true })

    // Build a map of contact_id → earliest system note
    const notesByContact = new Map<string, string>()
    if (allNotes) {
      for (const note of allNotes) {
        if (!notesByContact.has(note.contact_id)) {
          notesByContact.set(note.contact_id, note.content)
        }
      }
    }

    // Score each contact
    const results: { id: string; name: string; score: string }[] = []

    for (const contact of contacts) {
      const noteText = notesByContact.get(contact.id) || contact.notes || null
      const { score, reason } = scoreContact(contact.lead_source, noteText)

      const { error: updateError } = await supabaseAdmin
        .from('contacts')
        .update({
          lead_score: score,
          lead_score_reason: reason,
          lead_score_updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id)

      if (!updateError) {
        results.push({
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          score,
        })
      }
    }

    return NextResponse.json({
      scored: results.length,
      results,
    })
  } catch (error) {
    console.error('Score all contacts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
