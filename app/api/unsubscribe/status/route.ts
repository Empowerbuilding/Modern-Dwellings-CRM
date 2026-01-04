import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')
  const id = searchParams.get('id')

  if (!email && !id) {
    return NextResponse.json(
      { error: 'Email or ID required' },
      { status: 400 }
    )
  }

  try {
    let query = supabase.from('contacts').select('id, email, unsubscribed')

    if (email) {
      query = query.eq('email', email.toLowerCase().trim())
    } else if (id) {
      query = query.eq('id', id)
    }

    const { data: contact, error } = await query.single()

    if (error || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      email: contact.email,
      unsubscribed: contact.unsubscribed ?? false,
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
