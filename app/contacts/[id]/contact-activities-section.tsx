'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Activity, ActivityType, User } from '@/lib/types'

const ACTIVITY_TYPES: ActivityType[] = ['note', 'call', 'email', 'meeting', 'task']

const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { label: string; icon: JSX.Element; color: string }> = {
  note: {
    label: 'Note',
    color: 'bg-gray-100 text-gray-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  call: {
    label: 'Call',
    color: 'bg-green-100 text-green-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  email: {
    label: 'Email',
    color: 'bg-blue-100 text-blue-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  meeting: {
    label: 'Meeting',
    color: 'bg-purple-100 text-purple-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  task: {
    label: 'Task',
    color: 'bg-yellow-100 text-yellow-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
}

interface ActivityWithUser extends Activity {
  created_by?: User | null
}

interface ContactActivitiesSectionProps {
  contactId: string
  activities: ActivityWithUser[]
  currentUserId?: string
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function ContactActivitiesSection({ contactId, activities, currentUserId }: ContactActivitiesSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all')
  const [formData, setFormData] = useState({
    type: 'note' as ActivityType,
    title: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const filteredActivities = filterType === 'all'
    ? activities
    : activities.filter(a => a.type === filterType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setSaving(true)
    try {
      const { error } = await (supabase.from('activities') as any).insert({
        contact_id: contactId,
        type: formData.type,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        created_by_id: currentUserId || null,
        completed: formData.type === 'note',
      })

      if (error) throw error

      setFormData({ type: 'note', title: '', description: '' })
      setShowForm(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to create activity:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleComplete = async (activity: Activity) => {
    try {
      const { error } = await (supabase.from('activities') as any)
        .update({
          completed: !activity.completed,
          completed_at: !activity.completed ? new Date().toISOString() : null,
        })
        .eq('id', activity.id)

      if (error) throw error
      router.refresh()
    } catch (err) {
      console.error('Failed to update activity:', err)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-gray-900">Activity</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Activity Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            {/* Type selector */}
            <div className="flex gap-1">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.type === type
                      ? ACTIVITY_TYPE_CONFIG[type].color
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {ACTIVITY_TYPE_CONFIG[type].icon}
                  <span className="hidden sm:inline">{ACTIVITY_TYPE_CONFIG[type].label}</span>
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              type="text"
              placeholder={`${ACTIVITY_TYPE_CONFIG[formData.type].label} title...`}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              autoFocus
            />

            {/* Description */}
            <textarea
              placeholder="Add details (optional)..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
            />

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !formData.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Add Activity'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter */}
      {activities.length > 0 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({activities.length})
          </button>
          {ACTIVITY_TYPES.map((type) => {
            const count = activities.filter(a => a.type === type).length
            if (count === 0) return null
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {ACTIVITY_TYPE_CONFIG[type].label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Activity List */}
      {filteredActivities.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {activities.length === 0
            ? 'No activity yet. Add a note, log a call, or track tasks.'
            : 'No activities match this filter.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => {
            const config = ACTIVITY_TYPE_CONFIG[activity.type]
            const isTask = activity.type === 'task'

            return (
              <div
                key={activity.id}
                className={`flex gap-3 p-3 rounded-lg border ${
                  activity.completed && isTask
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* Icon / Checkbox */}
                <div className="flex-shrink-0">
                  {isTask ? (
                    <button
                      onClick={() => handleToggleComplete(activity)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        activity.completed
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {activity.completed ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
                      {config.icon}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${
                        activity.completed && isTask ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {activity.title}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">
                          {activity.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {activity.created_by?.name || 'System'}
                        {' · '}
                        {formatDateTime(activity.created_at!)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
