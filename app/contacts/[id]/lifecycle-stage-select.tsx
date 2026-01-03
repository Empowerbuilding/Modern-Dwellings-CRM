'use client'

import { useState } from 'react'
import type { LifecycleStage } from '@/lib/types'
import { LIFECYCLE_STAGE_LABELS, LIFECYCLE_STAGE_COLORS } from '@/lib/types'

const LIFECYCLE_STAGES: LifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'customer']

interface LifecycleStageSelectProps {
  contactId: string
  currentStage: LifecycleStage | null
}

export function LifecycleStageSelect({ contactId, currentStage }: LifecycleStageSelectProps) {
  const [stage, setStage] = useState<LifecycleStage | null>(currentStage)
  const [isUpdating, setIsUpdating] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleChange = async (newStage: LifecycleStage) => {
    if (newStage === stage || isUpdating) return

    setIsUpdating(true)
    setToast(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycle_stage: newStage }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      setStage(newStage)
      setToast({
        type: 'success',
        message: data.message || 'Status updated',
      })

      // Clear toast after 3 seconds
      setTimeout(() => setToast(null), 3000)
    } catch (error) {
      console.error('Failed to update lifecycle stage:', error)
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update status',
      })

      // Clear error toast after 5 seconds
      setTimeout(() => setToast(null), 5000)
    } finally {
      setIsUpdating(false)
    }
  }

  const currentColors = stage ? LIFECYCLE_STAGE_COLORS[stage] : 'bg-gray-100 text-gray-800'

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Lifecycle Stage</label>
        <select
          value={stage || ''}
          onChange={(e) => handleChange(e.target.value as LifecycleStage)}
          disabled={isUpdating}
          className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none ${currentColors} ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
        >
          {LIFECYCLE_STAGES.map((s) => (
            <option key={s} value={s}>
              {LIFECYCLE_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        {isUpdating && (
          <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`absolute top-full left-0 mt-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-10 whitespace-nowrap ${
            toast.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
