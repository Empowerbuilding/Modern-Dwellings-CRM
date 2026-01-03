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
        { error: 'Unauthorized' },
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

    // Get Facebook integration
    const { data: integration } = await supabaseAdmin
      .from('facebook_integrations')
      .select('page_id, page_name, token_expires_at, permissions, is_active')
      .eq('user_id', crmUser.id)
      .eq('is_active', true)
      .single()

    if (!integration) {
      return NextResponse.json({
        connected: false,
      })
    }

    // Check if token is expired
    const isExpired = integration.token_expires_at
      ? new Date(integration.token_expires_at) < new Date()
      : false

    return NextResponse.json({
      connected: true,
      pageId: integration.page_id,
      pageName: integration.page_name,
      expiresAt: integration.token_expires_at,
      permissions: integration.permissions,
      isExpired,
    })
  } catch (error) {
    console.error('Facebook status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
