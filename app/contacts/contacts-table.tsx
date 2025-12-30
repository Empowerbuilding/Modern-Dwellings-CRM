'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { LeadSource, Company, ClientType } from '@/lib/types'
import type { ContactWithCompany } from './page'
import { ContactSlideOver } from './contact-slide-over'

const LEAD_SOURCES: LeadSource[] = [
  'facebook',
  'facebook_ad',
  'google',
  'referral',
  'website',
  'contact_form',
  'cost_calc',
  'cold',
  'repeat',
  'guide_download',
  'empower_website',
  'barnhaus_contact',
  'barnhaus_store_contact',
  'shopify_order',
  'other',
]

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  facebook: 'Facebook',
  facebook_ad: 'Facebook Ad',
  google: 'Google',
  referral: 'Referral',
  website: 'Website',
  contact_form: 'Contact Form',
  cost_calc: 'Cost Calculator',
  cold: 'Cold',
  repeat: 'Repeat',
  guide_download: 'Guide Download',
  empower_website: 'Empower Website',
  barnhaus_contact: 'Barnhaus Contact',
  barnhaus_store_contact: 'Barnhaus Store',
  shopify_order: 'Shopify Order',
  other: 'Other',
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
}

const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  builder: 'bg-blue-100 text-blue-800',
  consumer: 'bg-green-100 text-green-800',
  subcontractor: 'bg-orange-100 text-orange-800',
  engineer: 'bg-purple-100 text-purple-800',
  architect: 'bg-pink-100 text-pink-800',
}

type SortField = 'name' | 'company' | 'email' | 'phone' | 'lead_source' | 'created_at'
type SortDirection = 'asc' | 'desc'

function formatDate(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface ContactsTableProps {
  initialContacts: ContactWithCompany[]
  companies: Pick<Company, 'id' | 'name' | 'type'>[]
}

// Helper to get effective client type (company type takes precedence)
function getEffectiveClientType(contact: ContactWithCompany): ClientType | null {
  return contact.company_type ?? contact.client_type ?? null
}

export function ContactsTable({ initialContacts, companies }: ContactsTableProps) {
  const router = useRouter()
  const [contacts, setContacts] = useState(initialContacts)
  const [search, setSearch] = useState('')
  const [leadSourceFilter, setLeadSourceFilter] = useState<LeadSource | ''>('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactWithCompany | null>(null)

  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((contact) => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase()
        const email = contact.email?.toLowerCase() ?? ''
        const company = contact.company_name?.toLowerCase() ?? ''
        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          company.includes(searchLower)
        )
      })
    }

    // Lead source filter
    if (leadSourceFilter) {
      result = result.filter((contact) => contact.lead_source === leadSourceFilter)
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | null = ''
      let bVal: string | null = ''

      switch (sortField) {
        case 'name':
          aVal = `${a.first_name} ${a.last_name}`
          bVal = `${b.first_name} ${b.last_name}`
          break
        case 'company':
          aVal = a.company_name
          bVal = b.company_name
          break
        case 'email':
          aVal = a.email
          bVal = b.email
          break
        case 'phone':
          aVal = a.phone
          bVal = b.phone
          break
        case 'lead_source':
          aVal = a.lead_source
          bVal = b.lead_source
          break
        case 'created_at':
          aVal = a.created_at ?? ''
          bVal = b.created_at ?? ''
          break
      }

      aVal = aVal ?? ''
      bVal = bVal ?? ''

      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal)
      }
      return bVal.localeCompare(aVal)
    })

    return result
  }, [contacts, search, leadSourceFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (contact: ContactWithCompany) => {
    router.push(`/contacts/${contact.id}`)
  }

  const handleAddNew = () => {
    setEditingContact(null)
    setSlideOverOpen(true)
  }

  const handleSave = (savedContact: ContactWithCompany) => {
    if (editingContact) {
      setContacts((prev) =>
        prev.map((c) => (c.id === savedContact.id ? savedContact : c))
      )
    } else {
      setContacts((prev) => [savedContact, ...prev])
    }
    setSlideOverOpen(false)
    setEditingContact(null)
  }

  const handleDelete = (contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId))
    setSlideOverOpen(false)
    setEditingContact(null)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">↕</span>
    }
    return (
      <span className="text-gray-600 ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 pt-14 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <select
          value={leadSourceFilter}
          onChange={(e) => setLeadSourceFilter(e.target.value as LeadSource | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="">All Lead Sources</option>
          {LEAD_SOURCES.map((source) => (
            <option key={source} value={source}>
              {LEAD_SOURCE_LABELS[source]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  onClick={() => handleSort('company')}
                  className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Company <SortIcon field="company" />
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Email <SortIcon field="email" />
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Phone <SortIcon field="phone" />
                </th>
                <th
                  onClick={() => handleSort('lead_source')}
                  className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Lead Source <SortIcon field="lead_source" />
                </th>
                <th
                  onClick={() => handleSort('created_at')}
                  className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Created <SortIcon field="created_at" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {contacts.length === 0
                      ? 'No contacts yet. Add your first contact to get started.'
                      : 'No contacts match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => handleRowClick(contact)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 mr-3 flex-shrink-0">
                          {contact.first_name[0]}{contact.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {contact.first_name} {contact.last_name}
                          </p>
                          {contact.role && (
                            <p className="text-xs text-gray-500 truncate">{contact.role}</p>
                          )}
                          {/* Show company on mobile */}
                          <p className="text-xs text-gray-500 truncate sm:hidden">
                            {contact.company_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-600">
                      {contact.company_name ?? '-'}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      {(() => {
                        const clientType = getEffectiveClientType(contact)
                        if (!clientType) return <span className="text-sm text-gray-400">-</span>
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLIENT_TYPE_COLORS[clientType]}`}>
                            {CLIENT_TYPE_LABELS[clientType]}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">
                      {contact.email ?? '-'}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-600">
                      {contact.phone ?? '-'}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      {contact.lead_source ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {LEAD_SOURCE_LABELS[contact.lead_source]}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-600">
                      {formatDate(contact.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        {filteredAndSortedContacts.length} of {contacts.length} contacts
      </p>

      <ContactSlideOver
        open={slideOverOpen}
        onClose={() => {
          setSlideOverOpen(false)
          setEditingContact(null)
        }}
        contact={editingContact}
        companies={companies}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
