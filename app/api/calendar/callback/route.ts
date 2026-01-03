import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { exchangeCodeForTokens } from '@/lib/google-calendar'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors from Google
  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/settings?tab=calendar&error=${encodeURIComponent(error)}`, BASE_URL)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings?tab=calendar&error=Missing code or state', BASE_URL)
    )
  }

  try {
    // Verify state matches cookie
    const cookieStore = await cookies()
    const storedState = cookieStore.get('calendar_oauth_state')?.value

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL('/settings?tab=calendar&error=Invalid state token', BASE_URL)
      )
    }

    // Clear the state cookie
    cookieStore.delete('calendar_oauth_state')

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(
        new URL('/login', BASE_URL)
      )
    }

    // Look up the CRM user by auth user email
    const { data: crmUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userError || !crmUser) {
      console.error('Failed to find CRM user:', userError)
      return NextResponse.redirect(
        new URL('/settings?tab=calendar&error=User not found in CRM', BASE_URL)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Calculate token expiration time
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert calendar integration
    const { error: upsertError } = await supabaseAdmin
      .from('calendar_integrations')
      .upsert({
        user_id: crmUser.id,
        provider: 'google',
        email_address: tokens.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: tokenExpiresAt,
        is_active: true,
      }, {
        onConflict: 'user_id,provider',
      })

    if (upsertError) {
      console.error('Failed to save calendar integration:', upsertError)
      return NextResponse.redirect(
        new URL('/settings?tab=calendar&error=Failed to save integration', BASE_URL)
      )
    }

    return NextResponse.redirect(
      new URL('/settings?tab=calendar&connected=true', BASE_URL)
    )
  } catch (err) {
    console.error('Calendar callback error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/settings?tab=calendar&error=${encodeURIComponent(message)}`, BASE_URL)
    )
  }
}
