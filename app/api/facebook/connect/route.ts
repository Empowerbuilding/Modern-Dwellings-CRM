import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

    const clientId = process.env.FACEBOOK_APP_ID
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI

    if (!clientId || !redirectUri) {
      console.error('[Facebook] Missing FACEBOOK_APP_ID or FACEBOOK_REDIRECT_URI')
      return NextResponse.json(
        { error: 'Facebook integration not configured' },
        { status: 500 }
      )
    }

    // Facebook OAuth permissions needed for Lead Ads and Conversions API
    const scopes = [
      'leads_retrieval',
      'pages_read_engagement',
      'pages_show_list',
      'ads_management',
      'pages_manage_ads',
    ].join(',')

    // Build Facebook OAuth URL
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64')

    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_type', 'code')

    console.log('[Facebook] Redirecting to OAuth:', authUrl.toString().replace(/client_id=\d+/, 'client_id=***'))

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('[Facebook] Connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Facebook connection' },
      { status: 500 }
    )
  }
}
