'use client'

import { useState } from 'react'
import type { Deal, Company, Contact } from '@/lib/types'
import { DealSlideOver } from './deal-slide-over'

interface DealActionsProps {
  deal: Deal
  companies: Pick<Company, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[]
}

export function DealActions({ deal, companies, contacts }: DealActionsProps) {
  const [slideOverOpen, setSlideOverOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setSlideOverOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Edit Deal
      </button>

      <DealSlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        deal={deal}
        companies={companies}
        contacts={contacts}
      />
    </>
  )
}
