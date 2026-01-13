'use client'

import { useState } from 'react'
import type { Deal, Company, Contact, User } from '@/lib/types'
import { DealSlideOver } from './deal-slide-over'
import { CreateTaskModal } from '@/components/create-task-modal'

interface DealActionsProps {
  deal: Deal
  companies: Pick<Company, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[]
  users: User[]
  contactOwnerId?: string | null
}

export function DealActions({ deal, companies, contacts, users, contactOwnerId }: DealActionsProps) {
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setTaskModalOpen(true)}
          className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Create Task
        </button>
        <button
          onClick={() => setSlideOverOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Edit Deal
        </button>
      </div>

      <CreateTaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        deal={deal}
        contactOwnerId={contactOwnerId}
      />

      <DealSlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        deal={deal}
        companies={companies}
        contacts={contacts}
        users={users}
      />
    </>
  )
}
