'use client'

import { useState } from 'react'
import type { Activity, ActivityType } from '@/lib/types'

interface ActivityTimelineProps {
  activities: Activity[]
  title?: string
  defaultExpanded?: boolean
  maxItems?: number
}

// Icons for each activity type
const ACTIVITY_ICONS: Record<ActivityType, JSX.Element> = {
  page_view: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  form_submit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  email_sent: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  sms_sent: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  call: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  note: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  stage_change: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
  deal_created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  contact_created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  meeting_scheduled: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  meeting_cancelled: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
}

// Color styles for each activity type
const ACTIVITY_COLORS: Record<ActivityType, string> = {
  page_view: 'bg-indigo-100 text-indigo-600',
  form_submit: 'bg-cyan-100 text-cyan-600',
  email_sent: 'bg-brand-100 text-brand-600',
  sms_sent: 'bg-purple-100 text-purple-600',
  call: 'bg-green-100 text-green-600',
  note: 'bg-gray-100 text-gray-600',
  stage_change: 'bg-yellow-100 text-yellow-600',
  deal_created: 'bg-emerald-100 text-emerald-600',
  contact_created: 'bg-teal-100 text-teal-600',
  meeting_scheduled: 'bg-violet-100 text-violet-600',
  meeting_cancelled: 'bg-red-100 text-red-600',
}

// Labels for each activity type
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  page_view: 'Page View',
  form_submit: 'Form Submitted',
  email_sent: 'Email Sent',
  sms_sent: 'SMS Sent',
  call: 'Call',
  note: 'Note',
  stage_change: 'Stage Change',
  deal_created: 'Deal Created',
  contact_created: 'Contact Created',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_cancelled: 'Meeting Cancelled',
}

function formatRelativeTime(dateString: string): string {
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

function formatFullDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface ActivityItemProps {
  activity: Activity
  isLast: boolean
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const [expanded, setExpanded] = useState(false)

  const icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.note
  const colorClass = ACTIVITY_COLORS[activity.activity_type] || ACTIVITY_COLORS.note
  const label = ACTIVITY_LABELS[activity.activity_type] || activity.activity_type

  const hasDetails = activity.description || (activity.metadata && Object.keys(activity.metadata).length > 0)

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Icon */}
      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {activity.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                {label}
              </span>
              <span className="text-xs text-gray-500" title={formatFullDateTime(activity.created_at)}>
                {formatRelativeTime(activity.created_at)}
              </span>
            </div>
          </div>

          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Expanded details */}
        {expanded && hasDetails && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
            {activity.description && (
              <p className="text-gray-700 whitespace-pre-wrap">{activity.description}</p>
            )}
            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
              <div className={activity.description ? 'mt-2 pt-2 border-t border-gray-200' : ''}>
                <p className="text-xs font-medium text-gray-500 mb-1">Details</p>
                <dl className="space-y-1">
                  {Object.entries(activity.metadata).map(([key, value]) => {
                    // Skip internal fields
                    if (['ip_address', 'user_agent'].includes(key)) return null
                    if (value === null || value === undefined) return null

                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)

                    return (
                      <div key={key} className="flex gap-2">
                        <dt className="text-gray-500">{formattedKey}:</dt>
                        <dd className="text-gray-700 truncate">{formattedValue}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ActivityTimeline({
  activities,
  title = 'Activity History',
  defaultExpanded = true,
  maxItems = 50,
}: ActivityTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  const displayedActivities = showAll ? activities : activities.slice(0, maxItems)
  const hasMore = activities.length > maxItems

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-gray-900">{title}</h2>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            {activities.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No activity history yet
            </p>
          ) : (
            <>
              <div className="space-y-0">
                {displayedActivities.map((activity, index) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isLast={index === displayedActivities.length - 1}
                  />
                ))}
              </div>

              {hasMore && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-2 w-full py-2 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
                >
                  Show {activities.length - maxItems} more activities
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
