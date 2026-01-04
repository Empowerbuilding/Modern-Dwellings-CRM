import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate styled HTML response
function generateHtmlResponse(
  success: boolean,
  message: string,
  email?: string
): string {
  const statusIcon = success
    ? `<svg class="icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`
    : `<svg class="icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`

  const resubscribeSection = success && email
    ? `<p class="resubscribe-text">Changed your mind? <a href="/unsubscribe?email=${encodeURIComponent(email)}&action=resubscribe">Click here to re-subscribe</a></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Unsubscribed' : 'Error'} - Barnhaus Steel Builders</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 480px;
      width: 100%;
      padding: 48px 40px;
      text-align: center;
    }

    .logo {
      margin-bottom: 32px;
    }

    .logo-text {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: -0.5px;
    }

    .logo-subtitle {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 4px;
    }

    .icon {
      width: 64px;
      height: 64px;
      margin-bottom: 24px;
    }

    .icon.success {
      color: #22c55e;
    }

    .icon.error {
      color: #ef4444;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
    }

    .message {
      font-size: 16px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .email-display {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
      word-break: break-all;
    }

    .resubscribe-text {
      font-size: 14px;
      color: #94a3b8;
    }

    .resubscribe-text a {
      color: #3b82f6;
      text-decoration: none;
    }

    .resubscribe-text a:hover {
      text-decoration: underline;
    }

    .footer {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }

    .home-link {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 24px;
      background: #1a1a2e;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .home-link:hover {
      background: #2d2d4a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-text">Barnhaus Steel Builders</div>
      <div class="logo-subtitle">Building Excellence</div>
    </div>

    ${statusIcon}

    <h1>${success ? 'Successfully Unsubscribed' : 'Something Went Wrong'}</h1>

    <p class="message">${message}</p>

    ${email && success ? `<div class="email-display">${email}</div>` : ''}

    ${resubscribeSection}

    <a href="https://barnhaussteelbuilders.com" class="home-link">Visit Our Website</a>

    <div class="footer">
      &copy; ${new Date().getFullYear()} Barnhaus Steel Builders. All rights reserved.
    </div>
  </div>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')
  const id = searchParams.get('id')
  const action = searchParams.get('action')

  // Handle resubscribe action
  if (action === 'resubscribe') {
    return handleResubscribe(email, id)
  }

  // Validate that we have either email or id
  if (!email && !id) {
    return new NextResponse(
      generateHtmlResponse(
        false,
        'Invalid request. Please use the unsubscribe link from your email.'
      ),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }

  try {
    // Build query based on provided identifier
    let query = supabase.from('contacts').select('id, email, unsubscribed')

    if (email) {
      query = query.eq('email', email.toLowerCase().trim())
    } else if (id) {
      query = query.eq('id', id)
    }

    const { data: contact, error: fetchError } = await query.single()

    if (fetchError || !contact) {
      return new NextResponse(
        generateHtmlResponse(
          false,
          'We couldn\'t find your email address in our system. You may have already been removed or the email address is incorrect.'
        ),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Check if already unsubscribed
    if (contact.unsubscribed) {
      return new NextResponse(
        generateHtmlResponse(
          true,
          'You\'ve already been unsubscribed from our mailing list. You won\'t receive any more marketing emails from us.',
          contact.email
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Update the contact to unsubscribed
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        unsubscribed: true,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('Failed to unsubscribe contact:', updateError)
      return new NextResponse(
        generateHtmlResponse(
          false,
          'We encountered an error while processing your request. Please try again later or contact us directly.'
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Log activity for audit trail
    await supabase.from('activities').insert({
      contact_id: contact.id,
      activity_type: 'note',
      title: 'Contact unsubscribed from emails',
      metadata: {
        action: 'unsubscribe',
        method: email ? 'email_link' : 'id_link',
      },
    })

    return new NextResponse(
      generateHtmlResponse(
        true,
        'You\'ve been successfully unsubscribed from Barnhaus Steel Builders emails. You won\'t receive any more marketing communications from us.',
        contact.email
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return new NextResponse(
      generateHtmlResponse(
        false,
        'An unexpected error occurred. Please try again later or contact us directly.'
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }
}

async function handleResubscribe(email: string | null, id: string | null) {
  if (!email && !id) {
    return new NextResponse(
      generateHtmlResponse(
        false,
        'Invalid request. Please contact us to re-subscribe.'
      ),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }

  try {
    let query = supabase.from('contacts').select('id, email, unsubscribed')

    if (email) {
      query = query.eq('email', email.toLowerCase().trim())
    } else if (id) {
      query = query.eq('id', id)
    }

    const { data: contact, error: fetchError } = await query.single()

    if (fetchError || !contact) {
      return new NextResponse(
        generateHtmlResponse(
          false,
          'We couldn\'t find your email address in our system.'
        ),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    if (!contact.unsubscribed) {
      return new NextResponse(
        generateResubscribeHtml(true, 'You\'re already subscribed to our mailing list!', contact.email),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Re-subscribe the contact
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        unsubscribed: false,
        unsubscribed_at: null,
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('Failed to resubscribe contact:', updateError)
      return new NextResponse(
        generateHtmlResponse(
          false,
          'We encountered an error while processing your request. Please try again later.'
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Log activity
    await supabase.from('activities').insert({
      contact_id: contact.id,
      activity_type: 'note',
      title: 'Contact re-subscribed to emails',
      metadata: {
        action: 'resubscribe',
      },
    })

    return new NextResponse(
      generateResubscribeHtml(true, 'You\'ve been successfully re-subscribed to Barnhaus Steel Builders emails. We\'re glad to have you back!', contact.email),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  } catch (error) {
    console.error('Resubscribe error:', error)
    return new NextResponse(
      generateHtmlResponse(
        false,
        'An unexpected error occurred. Please try again later.'
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }
}

function generateResubscribeHtml(success: boolean, message: string, email?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Re-subscribed - Barnhaus Steel Builders</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 480px;
      width: 100%;
      padding: 48px 40px;
      text-align: center;
    }

    .logo {
      margin-bottom: 32px;
    }

    .logo-text {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: -0.5px;
    }

    .logo-subtitle {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 4px;
    }

    .icon {
      width: 64px;
      height: 64px;
      margin-bottom: 24px;
      color: #22c55e;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
    }

    .message {
      font-size: 16px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .email-display {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
      word-break: break-all;
    }

    .footer {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }

    .home-link {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 24px;
      background: #1a1a2e;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .home-link:hover {
      background: #2d2d4a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-text">Barnhaus Steel Builders</div>
      <div class="logo-subtitle">Building Excellence</div>
    </div>

    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>

    <h1>Welcome Back!</h1>

    <p class="message">${message}</p>

    ${email ? `<div class="email-display">${email}</div>` : ''}

    <a href="https://barnhaussteelbuilders.com" class="home-link">Visit Our Website</a>

    <div class="footer">
      &copy; ${new Date().getFullYear()} Barnhaus Steel Builders. All rights reserved.
    </div>
  </div>
</body>
</html>`
}
