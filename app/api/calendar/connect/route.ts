import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { getGoogleAuthUrl } from '@/lib/google-calendar'

export async function GET() {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
    }

    // Generate random state token
    const state = crypto.randomUUID()

    // Store state in cookie (expires in 10 minutes)
    const cookieStore = await cookies()
    cookieStore.set('calendar_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    // Redirect to Google OAuth
    const authUrl = getGoogleAuthUrl(state)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Calendar connect error:', error)
    return NextResponse.redirect(
      new URL('/settings?tab=calendar&error=Failed to initiate connection', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    )
  }
}
