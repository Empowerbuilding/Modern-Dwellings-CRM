'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClientType, Company } from '@/lib/types'
import type { CompanyWithStats } from './page'

const CLIENT_TYPES: ClientType[] = [
  'builder',
  'consumer',
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

interface CompanySlideOverProps {
  open: boolean
  onClose: () => void
  company: CompanyWithStats | null
  onSave: (company: CompanyWithStats) => void
  onDelete: (companyId: string) => void
}

interface FormData {
  name: string
  type: ClientType
  phone: string
  website: string
  address: string
  city: string
  state: string
  notes: string
}

export function CompanySlideOver({
  open,
  onClose,
  company,
  onSave,
  onDelete,
}: CompanySlideOverProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'consumer',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        type: company.type,
        phone: company.phone ?? '',
        website: company.website ?? '',
        address: company.address ?? '',
        city: company.city ?? '',
        state: company.state ?? '',
        notes: company.notes ?? '',
      })
    } else {
      setFormData({
        name: '',
        type: 'consumer',
        phone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        notes: '',
      })
    }
    setError(null)
  }, [company, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        phone: formData.phone || null,
        website: formData.website || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        notes: formData.notes || null,
      }

      if (company) {
        // Update existing
        const { error: updateError } = await (supabase.from('companies') as any)
          .update(payload)
          .eq('id', company.id)

        if (updateError) throw updateError

        onSave({
          ...company,
          ...payload,
        } as CompanyWithStats)
      } else {
        // Create new
        const { data, error: insertError } = await (supabase.from('companies') as any)
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError

        onSave({
          ...data,
          primary_contact: null,
          open_deals_count: 0,
          total_revenue: 0,
        } as CompanyWithStats)
      }
    } catch (err) {
      console.error('Failed to save company:', err)
      setError('Failed to save company. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!company) return
    if (!confirm('Are you sure you want to delete this company? This will also unlink any associated contacts and deals.')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await (supabase.from('companies') as any)
        .delete()
        .eq('id', company.id)

      if (deleteError) throw deleteError

      onDelete(company.id)
    } catch (err) {
      console.error('Failed to delete company:', err)
      setError('Failed to delete company. Please try again.')
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
            {company ? 'Edit Company' : 'New Company'}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ClientType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                {CLIENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CLIENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          {company ? (
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
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : company ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
