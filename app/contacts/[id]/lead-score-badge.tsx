'use client'

import { useState } from 'react'

type LeadScore = 'hot' | 'medium' | 'cold'

const SCORE_STYLES: Record<LeadScore, string> = {
  hot: 'bg-red-100 text-red-700 border border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  cold: 'bg-gray-100 text-gray-600 border border-gray-200',
}

const SCORE_LABELS: Record<LeadScore, string> = {
  hot: 'Hot',
  medium: 'Medium',
  cold: 'Cold',
}

interface LeadScoreBadgeProps {
  contactId: string
  initialScore: LeadScore | null
  initialReason: string | null
}

export function LeadScoreBadge({ contactId, initialScore, initialReason }: LeadScoreBadgeProps) {
  const [score, setScore] = useState<LeadScore | null>(initialScore)
  const [reason, setReason] = useState<string | null>(initialReason)
  const [loading, setLoading] = useState(false)

  const handleRescore = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/contacts/${contactId}/score`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setScore(data.score)
        setReason(data.reason)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  if (!score) {
    return (
      <button
        onClick={handleRescore}
        disabled={loading}
        className="px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {loading ? 'Scoring...' : 'Score Lead'}
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`px-2 py-1 rounded text-xs font-medium ${SCORE_STYLES[score]}`}>
        {SCORE_LABELS[score]}
      </span>
      <button
        onClick={handleRescore}
        disabled={loading}
        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Rescore"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </button>
      {reason && (
        <span className="text-xs text-gray-500 hidden sm:inline" title={reason}>
          {reason}
        </span>
      )}
    </div>
  )
}
