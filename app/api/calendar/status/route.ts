import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Look up the CRM user by auth user email
    const { data: crmUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userError || !crmUser) {
      return NextResponse.json({
        connected: false,
      })
    }

    // Get calendar integration
    const { data: integration } = await supabaseAdmin
      .from('calendar_integrations')
      .select('email_address, token_expires_at, provider, is_active')
      .eq('user_id', crmUser.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single()

    if (!integration) {
      return NextResponse.json({
        connected: false,
      })
    }

    return NextResponse.json({
      connected: true,
      email: integration.email_address,
      expiresAt: integration.token_expires_at,
      provider: integration.provider,
    })
  } catch (error) {
    console.error('Calendar status error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
