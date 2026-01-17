'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type SubscriptionStatus = 'loading' | 'subscribed' | 'unsubscribed' | 'not_found' | 'error'

export default function UnsubscribePage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const id = searchParams.get('id')

  const [status, setStatus] = useState<SubscriptionStatus>('loading')
  const [contactEmail, setContactEmail] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!email && !id) {
      setStatus('not_found')
      return
    }

    checkSubscriptionStatus()
  }, [email, id])

  async function checkSubscriptionStatus() {
    try {
      const params = new URLSearchParams()
      if (email) params.set('email', email)
      if (id) params.set('id', id)
      params.set('check', 'true')

      const response = await fetch(`/api/unsubscribe/status?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          setStatus('not_found')
        } else {
          setStatus('error')
        }
        return
      }

      setContactEmail(data.email)
      setStatus(data.unsubscribed ? 'unsubscribed' : 'subscribed')
    } catch (error) {
      console.error('Failed to check subscription status:', error)
      setStatus('error')
    }
  }

  async function handleUnsubscribe() {
    setProcessing(true)
    setMessage(null)

    try {
      const params = new URLSearchParams()
      if (email) params.set('email', email)
      if (id) params.set('id', id)

      const response = await fetch(`/api/unsubscribe?${params.toString()}`)

      if (response.ok) {
        setStatus('unsubscribed')
        setMessage('You have been successfully unsubscribed.')
      } else {
        setMessage('Something went wrong. Please try again.')
      }
    } catch (error) {
      console.error('Unsubscribe error:', error)
      setMessage('Something went wrong. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleResubscribe() {
    setProcessing(true)
    setMessage(null)

    try {
      const params = new URLSearchParams()
      if (email) params.set('email', email)
      if (id) params.set('id', id)
      params.set('action', 'resubscribe')

      const response = await fetch(`/api/unsubscribe?${params.toString()}`)

      if (response.ok) {
        setStatus('subscribed')
        setMessage('You have been successfully re-subscribed!')
      } else {
        setMessage('Something went wrong. Please try again.')
      }
    } catch (error) {
      console.error('Resubscribe error:', error)
      setMessage('Something went wrong. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 sm:p-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Barnhaus Steel Builders
          </h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
            Building Excellence
          </p>
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mb-4" />
            <p className="text-slate-500">Checking subscription status...</p>
          </div>
        )}

        {/* Not Found State */}
        {status === 'not_found' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Email Not Found
            </h1>
            <p className="text-slate-500 text-sm">
              We couldn&apos;t find your email address in our system. Please use the unsubscribe link from your email.
            </p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Something Went Wrong
            </h1>
            <p className="text-slate-500 text-sm">
              We encountered an error. Please try again later or contact us directly.
            </p>
          </div>
        )}

        {/* Subscribed State */}
        {status === 'subscribed' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Email Preferences
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              You are currently subscribed to emails from Barnhaus Steel Builders.
            </p>

            {contactEmail && (
              <div className="bg-slate-100 rounded-lg px-4 py-3 mb-6 font-mono text-sm text-slate-600 break-all">
                {contactEmail}
              </div>
            )}

            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {message}
              </div>
            )}

            <button
              onClick={handleUnsubscribe}
              disabled={processing}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors"
            >
              {processing ? 'Processing...' : 'Unsubscribe from Emails'}
            </button>
          </div>
        )}

        {/* Unsubscribed State */}
        {status === 'unsubscribed' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              You&apos;re Unsubscribed
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              You won&apos;t receive any more marketing emails from Barnhaus Steel Builders.
            </p>

            {contactEmail && (
              <div className="bg-slate-100 rounded-lg px-4 py-3 mb-6 font-mono text-sm text-slate-600 break-all">
                {contactEmail}
              </div>
            )}

            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {message}
              </div>
            )}

            <p className="text-slate-400 text-sm mb-4">Changed your mind?</p>

            <button
              onClick={handleResubscribe}
              disabled={processing}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
            >
              {processing ? 'Processing...' : 'Re-subscribe to Emails'}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <a
            href="https://barnhaussteelbuilders.com"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Visit barnhaussteelbuilders.com
          </a>
          <p className="text-xs text-slate-400 mt-2">
            &copy; {new Date().getFullYear()} Barnhaus Steel Builders
          </p>
        </div>
      </div>
    </main>
  )
}
