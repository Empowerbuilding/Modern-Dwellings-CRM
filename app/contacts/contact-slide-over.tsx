'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LeadSource, Company, ClientType } from '@/lib/types'
import type { ContactWithCompany } from './page'

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

const CLIENT_TYPES: ClientType[] = [
  'consumer',
  'builder',
  'subcontractor',
  'engineer',
  'architect',
]

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
}

interface ContactSlideOverProps {
  open: boolean
  onClose: () => void
  contact: ContactWithCompany | null
  companies: Pick<Company, 'id' | 'name' | 'type'>[]
  onSave: (contact: ContactWithCompany) => void
  onDelete: (contactId: string) => void
}

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  company_id: string
  lead_source: LeadSource | ''
  client_type: ClientType | ''
  is_primary: boolean
  notes: string
}

export function ContactSlideOver({
  open,
  onClose,
  contact,
  companies,
  onSave,
  onDelete,
}: ContactSlideOverProps) {
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    company_id: '',
    lead_source: '',
    client_type: '',
    is_primary: false,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get the selected company's type (if any)
  const selectedCompany = formData.company_id
    ? companies.find((c) => c.id === formData.company_id)
    : null

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        role: contact.role ?? '',
        company_id: contact.company_id ?? '',
        lead_source: contact.lead_source ?? '',
        client_type: contact.client_type ?? '',
        is_primary: contact.is_primary,
        notes: contact.notes ?? '',
      })
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: '',
        company_id: '',
        lead_source: '',
        client_type: '',
        is_primary: false,
        notes: '',
      })
    }
    setError(null)
  }, [contact, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // If linked to a company, use company's type; otherwise use the selected client_type
      const effectiveClientType = formData.company_id
        ? selectedCompany?.type ?? null
        : formData.client_type || null

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role || null,
        company_id: formData.company_id || null,
        lead_source: formData.lead_source || null,
        client_type: effectiveClientType,
        is_primary: formData.is_primary,
        notes: formData.notes || null,
      }

      if (contact) {
        // Update existing
        const { error: updateError } = await (supabase.from('contacts') as any)
          .update(payload)
          .eq('id', contact.id)

        if (updateError) throw updateError

        onSave({
          ...contact,
          ...payload,
          company_name: selectedCompany?.name ?? null,
          company_type: selectedCompany?.type ?? null,
        } as ContactWithCompany)
      } else {
        // Create new
        const { data, error: insertError } = await (supabase.from('contacts') as any)
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError

        onSave({
          ...data,
          company_name: selectedCompany?.name ?? null,
          company_type: selectedCompany?.type ?? null,
        } as ContactWithCompany)
      }
    } catch (err) {
      console.error('Failed to save contact:', err)
      setError('Failed to save contact. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    if (!confirm('Are you sure you want to delete this contact?')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await (supabase.from('contacts') as any)
        .delete()
        .eq('id', contact.id)

      if (deleteError) throw deleteError

      onDelete(contact.id)
    } catch (err) {
      console.error('Failed to delete contact:', err)
      setError('Failed to delete contact. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Client Type dropdown only for standalone contacts (no company) */}
            {!formData.company_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Type
                </label>
                <select
                  value={formData.client_type}
                  onChange={(e) => setFormData({ ...formData, client_type: e.target.value as ClientType | '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">Select type</option>
                  {CLIENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CLIENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Project Manager, Owner"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Source
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as LeadSource | '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Select source</option>
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {LEAD_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={formData.is_primary}
                onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_primary" className="text-sm text-gray-700">
                Primary contact for company
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          {contact ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : contact ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
