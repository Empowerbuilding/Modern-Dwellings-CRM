'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/auth-provider'
import type { User } from '@/lib/types'

interface UserWithStats extends User {
  deal_count: number
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { crmUser, supabaseUser } = useAuth()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'profile' | 'calendar' | 'team'>(() => {
    if (tabFromUrl === 'team') return 'team'
    if (tabFromUrl === 'calendar') return 'calendar'
    return 'profile'
  })
  const supabase = createClient()

  // Profile state
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Team state
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'sales' | 'admin'>('sales')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const isAdmin = crmUser?.role === 'admin'

  // Sync tab with URL param
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'team' && isAdmin) {
      setActiveTab('team')
    } else if (tab === 'calendar') {
      setActiveTab('calendar')
    } else if (tab === 'profile' || !tab) {
      setActiveTab('profile')
    }
  }, [searchParams, isAdmin])

  useEffect(() => {
    if (crmUser) {
      setName(crmUser.name)
    }
  }, [crmUser])

  useEffect(() => {
    if (activeTab === 'team' && isAdmin) {
      loadUsers()
    }
  }, [activeTab, isAdmin])

  async function loadUsers() {
    setLoadingUsers(true)
    try {
      // Get all users
      const { data: usersData } = await (supabase.from('users') as any)
        .select('*')
        .order('name')

      if (!usersData) {
        setUsers([])
        return
      }

      // Get deal counts for each user
      const { data: deals } = await (supabase.from('deals') as any)
        .select('owner_id')

      const dealCounts: Record<string, number> = {}
      if (deals) {
        deals.forEach((deal: any) => {
          if (deal.owner_id) {
            dealCounts[deal.owner_id] = (dealCounts[deal.owner_id] || 0) + 1
          }
        })
      }

      const usersWithStats = usersData.map((user: any) => ({
        ...user,
        deal_count: dealCounts[user.id] || 0,
      }))

      setUsers(usersWithStats)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!crmUser) return

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const { error } = await (supabase.from('users') as any)
        .update({ name })
        .eq('id', crmUser.id)

      if (error) throw error

      setSaveSuccess(true)
      router.refresh()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaveError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteName.trim()) return

    setInviting(true)
    setInviteError(null)
    setInviteSuccess(false)

    try {
      // First create the user in our users table
      const { error: userError } = await (supabase.from('users') as any)
        .insert({
          email: inviteEmail.toLowerCase().trim(),
          name: inviteName.trim(),
          role: inviteRole,
        })

      if (userError) {
        if (userError.code === '23505') {
          throw new Error('A user with this email already exists')
        }
        throw userError
      }

      // Send invite via Supabase Auth
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(inviteEmail.toLowerCase().trim())

      if (inviteError) {
        // If invite fails, we still have the user in our table
        // They can be invited again later or sign up themselves
        console.warn('Failed to send invite email:', inviteError)
      }

      setInviteSuccess(true)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('sales')
      loadUsers()
      setTimeout(() => setInviteSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to invite user:', err)
      setInviteError(err.message || 'Failed to invite user. Please try again.')
    } finally {
      setInviting(false)
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
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => router.push('/settings/calendar')}
              className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
            >
              Calendar
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('team')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'team'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Team
              </button>
            )}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Settings</h2>

            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                  Profile saved successfully!
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={supabaseUser?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={crmUser.role}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 capitalize"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Calendar Settings Link */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Calendar & Meeting Scheduler</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Connect your Google Calendar and create booking links
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/settings/calendar')}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Manage →
              </button>
            </div>
          </div>
          </>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && isAdmin && (
          <div className="space-y-6">
            {/* Invite User Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Invite Team Member</h2>

              <form onSubmit={handleInviteUser} className="space-y-4">
                {inviteError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {inviteError}
                  </div>
                )}

                {inviteSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                    User invited successfully!
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      required
                      placeholder="John Doe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="john@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'sales' | 'admin')}
                    className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="sales">Sales</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </form>
            </div>

            {/* Team Members List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Team Members</h2>

              {loadingUsers ? (
                <p className="text-sm text-gray-500">Loading team members...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-gray-500">No team members found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="pb-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                        <th className="pb-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Role
                        </th>
                        <th className="pb-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Deals
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {user.name}
                                {user.id === crmUser.id && (
                                  <span className="ml-2 text-xs text-gray-400">(you)</span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-gray-600">
                            {user.email}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {user.deal_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
