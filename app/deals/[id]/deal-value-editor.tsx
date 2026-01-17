'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDealValue } from '@/lib/supabase'

interface DealValueEditorProps {
  dealId: string
  currentValue: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function DealValueEditor({ dealId, currentValue }: DealValueEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState(currentValue.toString())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (isNaN(numValue)) {
      setError('Please enter a valid number')
      return
    }

    if (numValue === currentValue && !note) {
      setIsOpen(false)
      return
    }

    const { error: updateError } = await updateDealValue(dealId, numValue, note || undefined)

    if (updateError) {
      setError('Failed to update value. Please try again.')
      return
    }

    setNote('')
    setIsOpen(false)
    startTransition(() => {
      router.refresh()
    })
  }

  const handleCancel = () => {
    setValue(currentValue.toString())
    setNote('')
    setError(null)
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-brand-600 hover:text-brand-700 font-medium"
      >
        Update Value
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 pointer-events-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Update Deal Value
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Value
              </label>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(currentValue)}
              </p>
            </div>

            <div>
              <label
                htmlFor="value"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="text"
                  id="value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="note"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Note (optional)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                placeholder="e.g., Added engineering scope"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  )
}
