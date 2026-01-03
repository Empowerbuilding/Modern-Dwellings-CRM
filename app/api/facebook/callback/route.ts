import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Service role client for database operations
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface FacebookTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

interface FacebookPage {
  id: string
  name: string
  access_token: string
}

interface FacebookPagesResponse {
  data: FacebookPage[]
}

interface FacebookDebugTokenResponse {
  data: {
    app_id: string
    user_id: string
    scopes: string[]
    expires_at: number
  }
}

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString()
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error(`[${timestamp}] Facebook OAuth error:`, error, errorDescription)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code) {
    console.error(`[${timestamp}] Facebook callback missing code`)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=Missing authorization code`
    )
  }

  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=Please log in to connect Facebook`
      )
    }

    // Look up the CRM user by auth user email
    const { data: crmUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userError || !crmUser) {
      console.error(`[${timestamp}] CRM user not found:`, userError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=User not found`
      )
    }

    const clientId = process.env.FACEBOOK_APP_ID
    const clientSecret = process.env.FACEBOOK_APP_SECRET
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      console.error(`[${timestamp}] Missing Facebook OAuth config`)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=Facebook not configured`
      )
    }

    // Exchange code for access token
    console.log(`[${timestamp}] Exchanging code for access token...`)
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', clientId)
    tokenUrl.searchParams.set('client_secret', clientSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData: FacebookTokenResponse = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error(`[${timestamp}] Failed to get access token:`, tokenData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=Failed to get access token`
      )
    }

    // Exchange for long-lived token
    console.log(`[${timestamp}] Exchanging for long-lived token...`)
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', clientId)
    longLivedUrl.searchParams.set('client_secret', clientSecret)
    longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token)

    const longLivedResponse = await fetch(longLivedUrl.toString())
    const longLivedData: FacebookTokenResponse = await longLivedResponse.json()

    const accessToken = longLivedData.access_token || tokenData.access_token
    const expiresIn = longLivedData.expires_in || tokenData.expires_in

    // Debug token to get permissions
    console.log(`[${timestamp}] Getting token info...`)
    const debugUrl = new URL('https://graph.facebook.com/debug_token')
    debugUrl.searchParams.set('input_token', accessToken)
    debugUrl.searchParams.set('access_token', `${clientId}|${clientSecret}`)

    const debugResponse = await fetch(debugUrl.toString())
    const debugData: FacebookDebugTokenResponse = await debugResponse.json()
    const permissions = debugData.data?.scopes || []

    // Get user's pages
    console.log(`[${timestamp}] Getting user pages...`)
    const pagesUrl = new URL('https://graph.facebook.com/v18.0/me/accounts')
    pagesUrl.searchParams.set('access_token', accessToken)

    const pagesResponse = await fetch(pagesUrl.toString())
    const pagesData: FacebookPagesResponse = await pagesResponse.json()

    // Use the first page if available (could be enhanced to let user select)
    const page = pagesData.data?.[0]

    // Calculate token expiration
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    // Store in database (upsert to handle reconnections)
    const { error: dbError } = await supabaseAdmin
      .from('facebook_integrations')
      .upsert({
        user_id: crmUser.id,
        page_id: page?.id || null,
        page_name: page?.name || null,
        access_token: page?.access_token || accessToken, // Use page token if available
        token_expires_at: tokenExpiresAt,
        permissions,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (dbError) {
      console.error(`[${timestamp}] Failed to save Facebook integration:`, dbError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=Failed to save connection`
      )
    }

    console.log(`[${timestamp}] Facebook connected successfully for user ${crmUser.id}`)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=Facebook connected successfully`
    )
  } catch (error) {
    console.error(`[${timestamp}] Facebook callback error:`, error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=Connection failed`
    )
  }
}
