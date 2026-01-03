import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const timestamp = new Date().toISOString()

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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Delete the Facebook integration
    const { error: deleteError } = await supabaseAdmin
      .from('facebook_integrations')
      .delete()
      .eq('user_id', crmUser.id)

    if (deleteError) {
      console.error(`[${timestamp}] Failed to delete Facebook integration:`, deleteError)
      return NextResponse.json(
        { error: 'Failed to disconnect Facebook' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Facebook disconnected for user ${crmUser.id}`)

    return NextResponse.json({
      success: true,
      message: 'Facebook disconnected successfully',
    })
  } catch (error) {
    console.error(`[${timestamp}] Facebook disconnect error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
