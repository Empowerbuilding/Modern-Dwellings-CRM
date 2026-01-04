import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface InviteRequest {
  email: string
  name: string
  role: 'sales' | 'admin'
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authClient = await createServerClient()
    const { data: { user: authUser } } = await authClient.auth.getUser()

    if (!authUser?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the current user and check if they're an admin
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('email', authUser.email)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can invite users' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: InviteRequest = await request.json()

    if (!body.email?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      )
    }

    if (!['sales', 'admin'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Role must be sales or admin' },
        { status: 400 }
      )
    }

    const email = body.email.toLowerCase().trim()
    const name = body.name.trim()

    // Check if user already exists in our users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Create the user in our users table
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        name,
        role: body.role,
      })

    if (insertError) {
      console.error('Failed to create user:', insertError)
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Send invite email via Supabase Auth
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    })

    if (inviteError) {
      // User was created but invite email failed
      // Log the error but don't fail - they can still sign up or be re-invited
      console.warn('Failed to send invite email:', inviteError)
      return NextResponse.json({
        success: true,
        message: 'User created but invite email could not be sent. They can sign up manually.',
        emailSent: false,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'User invited successfully',
      emailSent: true,
    })
  } catch (error) {
    console.error('Invite user error:', error)
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    )
  }
}
