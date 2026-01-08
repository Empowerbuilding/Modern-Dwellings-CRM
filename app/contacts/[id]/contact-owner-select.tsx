'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'

interface ContactOwnerSelectProps {
  contactId: string
  currentOwnerId: string | null
  users: User[]
}

export function ContactOwnerSelect({
  contactId,
  currentOwnerId,
  users,
}: ContactOwnerSelectProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [ownerId, setOwnerId] = useState(currentOwnerId)

  const currentOwner = users.find((u) => u.id === ownerId)

  const handleChange = async (newOwnerId: string) => {
    const newValue = newOwnerId || null
    setOwnerId(newValue)
    setSaving(true)

    try {
      const { error } = await (supabase.from('contacts') as any)
        .update({ owner_id: newValue })
        .eq('id', contactId)

      if (error) throw error
      router.refresh()
    } catch (err) {
      console.error('Failed to update owner:', err)
      setOwnerId(currentOwnerId) // Revert on error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <dt className="text-gray-500">Owner</dt>
      <dd className="mt-1">
        <div className="relative">
          <select
            value={ownerId || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            {saving ? (
              <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
        {currentOwner && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
              {currentOwner.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-sm text-gray-700">{currentOwner.name}</span>
          </div>
        )}
      </dd>
    </div>
  )
}
