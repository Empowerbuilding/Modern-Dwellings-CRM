import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Clone request headers and add pathname for use in layouts
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const isAuthPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup'

  // Public booking pages (for guests to book meetings)
  const isBookingPage = request.nextUrl.pathname.startsWith('/book/')

  // Public unsubscribe page (for email recipients)
  const isUnsubscribePage = request.nextUrl.pathname === '/unsubscribe'

  // Public API routes that use their own authentication (e.g., API key) or are public
  const isPublicApiRoute =
    request.nextUrl.pathname === '/api/leads/webhook' ||
    request.nextUrl.pathname === '/api/companies/webhook' ||
    request.nextUrl.pathname === '/api/activities/track' ||
    // Calendar booking APIs (public for guests)
    request.nextUrl.pathname === '/api/calendar/availability' ||
    request.nextUrl.pathname === '/api/calendar/available-dates' ||
    request.nextUrl.pathname === '/api/calendar/book' ||
    request.nextUrl.pathname.startsWith('/api/calendar/meetings/') ||
    // Meeting types API (public for booking page to fetch meeting type info)
    request.nextUrl.pathname.startsWith('/api/meeting-types/') ||
    // Unsubscribe API (public for email recipients)
    request.nextUrl.pathname === '/api/unsubscribe' ||
    request.nextUrl.pathname === '/api/unsubscribe/status' ||
    // CRM Summary API (for n8n automation)
    request.nextUrl.pathname === '/api/crm-summary' ||
    request.nextUrl.pathname === '/api/contacts'

  // If user is not logged in and trying to access protected route, redirect to login
  if (!user && !isAuthPage && !isPublicApiRoute && !isBookingPage && !isUnsubscribePage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in and trying to access auth pages, redirect to dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - tracking.js (public tracking script)
     * - booking-widget.js (public booking widget script)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|tracking\\.js|booking-widget\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
