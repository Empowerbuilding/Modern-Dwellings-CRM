'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const supabase = createClient()

    try {
      // Check if this is the first user (will be admin)
      const { count } = await (supabase.from('users') as any)
        .select('*', { count: 'exact', head: true })

      const isFirstUser = count === 0
      const role = isFirstUser ? 'admin' : 'sales'

      // Create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        throw signUpError
      }

      if (!authData.user) {
        throw new Error('Failed to create user')
      }

      // Create the user record in our users table
      const { error: userError } = await (supabase.from('users') as any)
        .insert({
          email: email.toLowerCase().trim(),
          name: name.trim(),
          role,
        })

      if (userError) {
        // If user creation fails, we should ideally clean up the auth user
        // but Supabase doesn't allow deleting users from client-side
        console.error('Failed to create user record:', userError)
        throw new Error('Failed to create user profile. Please contact support.')
      }

      // Show success message instead of redirecting
      setSuccess(true)
    } catch (err: any) {
      console.error('Sign up error:', err)
      setError(err.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show success screen after signup
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Check your email</h1>
            <p className="text-gray-600 mb-6">
              We've sent a confirmation link to <span className="font-medium">{email}</span>.
              Please click the link in the email to verify your account.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Didn't receive the email? Check your spam folder or try signing up again.
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Create Account</h1>
            <p className="text-sm text-gray-500 mt-2">Sign up to get started</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
