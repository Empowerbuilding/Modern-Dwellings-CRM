'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

interface FacebookStatus {
  connected: boolean
  pageId?: string
  pageName?: string
  expiresAt?: string
  permissions?: string[]
  isExpired?: boolean
}

interface CalendarStatus {
  connected: boolean
  email?: string
  expiresAt?: string
  provider?: string
}

export default function IntegrationsSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { crmUser } = useAuth()
  const isAdmin = crmUser?.role === 'admin'

  // Facebook state
  const [facebookStatus, setFacebookStatus] = useState<FacebookStatus | null>(null)
  const [loadingFacebook, setLoadingFacebook] = useState(true)
  const [disconnectingFacebook, setDisconnectingFacebook] = useState(false)

  // Calendar state
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null)
  const [loadingCalendar, setLoadingCalendar] = useState(true)
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Check for URL params (connection result)
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success) {
      setToast({ message: success, type: 'success' })
      window.history.replaceState({}, '', '/settings/integrations')
    } else if (error) {
      setToast({ message: error, type: 'error' })
      window.history.replaceState({}, '', '/settings/integrations')
    }
  }, [searchParams])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Load Facebook status
  useEffect(() => {
    async function loadFacebookStatus() {
      try {
        const res = await fetch('/api/facebook/status')
        const data = await res.json()
        setFacebookStatus(data)
      } catch (err) {
        console.error('Failed to load Facebook status:', err)
        setFacebookStatus({ connected: false })
      } finally {
        setLoadingFacebook(false)
      }
    }
    loadFacebookStatus()
  }, [])

  // Load Calendar status
  useEffect(() => {
    async function loadCalendarStatus() {
      try {
        const res = await fetch('/api/calendar/status')
        const data = await res.json()
        setCalendarStatus(data)
      } catch (err) {
        console.error('Failed to load calendar status:', err)
        setCalendarStatus({ connected: false })
      } finally {
        setLoadingCalendar(false)
      }
    }
    loadCalendarStatus()
  }, [])

  async function handleDisconnectFacebook() {
    if (!confirm('Are you sure you want to disconnect Facebook?')) return

    setDisconnectingFacebook(true)
    try {
      const res = await fetch('/api/facebook/disconnect', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setFacebookStatus({ connected: false })
        setToast({ message: 'Facebook disconnected', type: 'success' })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Failed to disconnect Facebook:', err)
      setToast({ message: 'Failed to disconnect Facebook', type: 'error' })
    } finally {
      setDisconnectingFacebook(false)
    }
  }

  async function handleDisconnectCalendar() {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return

    setDisconnectingCalendar(true)
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setCalendarStatus({ connected: false })
        setToast({ message: 'Google Calendar disconnected', type: 'success' })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Failed to disconnect calendar:', err)
      setToast({ message: 'Failed to disconnect calendar', type: 'error' })
    } finally {
      setDisconnectingCalendar(false)
    }
  }

  if (!crmUser) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pt-14 md:pt-6">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {toast.message}
          </div>
        )}

        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => router.push('/settings')}
              className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
            >
              Profile
            </button>
            <button
              onClick={() => router.push('/settings/calendar')}
              className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
            >
              Calendar
            </button>
            <button
              className="pb-3 text-sm font-medium border-b-2 border-brand-600 text-brand-600 transition-colors"
            >
              Integrations
            </button>
            {isAdmin && (
              <button
                onClick={() => router.push('/settings?tab=team')}
                className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
              >
                Team
              </button>
            )}
          </nav>
        </div>

        {/* Facebook Integration Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#1877F2] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Facebook</h2>
              <p className="text-sm text-gray-500">Lead Ads & Conversions API</p>
            </div>
          </div>

          {loadingFacebook ? (
            <p className="text-sm text-gray-500">Checking connection status...</p>
          ) : facebookStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Connected</p>
                    {facebookStatus.pageName && (
                      <p className="text-sm text-gray-500">{facebookStatus.pageName}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDisconnectFacebook}
                  disabled={disconnectingFacebook}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {disconnectingFacebook ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>

              {facebookStatus.isExpired && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Your Facebook token has expired. Please reconnect to continue receiving leads.
                  </p>
                </div>
              )}

              {facebookStatus.permissions && facebookStatus.permissions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {facebookStatus.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Facebook account to receive leads from Facebook Lead Ads and send
                conversion events for better ad optimization.
              </p>
              <div className="mb-4 p-3 bg-brand-50 border border-brand-200 rounded-lg">
                <p className="text-sm text-brand-800">
                  <strong>Permissions requested:</strong> leads_retrieval, pages_read_engagement,
                  pages_show_list, ads_management
                </p>
              </div>
              <a
                href="/api/facebook/connect"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white text-sm font-medium rounded-lg hover:bg-[#166FE5] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Connect to Facebook
              </a>
            </div>
          )}
        </div>

        {/* Google Calendar Integration Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Google Calendar</h2>
              <p className="text-sm text-gray-500">Meeting scheduling & availability</p>
            </div>
          </div>

          {loadingCalendar ? (
            <p className="text-sm text-gray-500">Checking connection status...</p>
          ) : calendarStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Connected</p>
                  <p className="text-sm text-gray-500">{calendarStatus.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/settings/calendar')}
                  className="px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                >
                  Manage
                </button>
                <button
                  onClick={handleDisconnectCalendar}
                  disabled={disconnectingCalendar}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {disconnectingCalendar ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Google Calendar to enable meeting scheduling. This allows guests to book
                meetings based on your availability.
              </p>
              <a
                href="/api/calendar/connect"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Calendar
              </a>
            </div>
          )}
        </div>

        {/* Conversions API Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Facebook Conversions API</h2>
              <p className="text-sm text-gray-500">Server-side event tracking</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              The Conversions API automatically sends events to Facebook when contacts progress through your funnel:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Lead Event</p>
                <p className="text-xs text-gray-500">Sent when a contact books a meeting</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">MQL Event</p>
                <p className="text-xs text-gray-500">Sent when marked as Marketing Qualified</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">SQL Event</p>
                <p className="text-xs text-gray-500">Sent when marked as Sales Qualified</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Customer Event</p>
                <p className="text-xs text-gray-500">Sent when a deal is won</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Events include hashed user data for matching and are deduplicated to prevent duplicates.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
