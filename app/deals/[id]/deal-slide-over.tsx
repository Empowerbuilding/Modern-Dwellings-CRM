'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Deal, DealType, PipelineStage, Company, Contact, User } from '@/lib/types'
import { PIPELINE_STAGES, STAGE_LABELS } from '@/lib/types'

const DEAL_TYPES: DealType[] = [
  'custom_design',
  'builder_design',
  'engineering',
  'software_fees',
  'referral',
  'budget_builder',
  'marketing',
]

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  custom_design: 'Custom Design',
  builder_design: 'Builder Design',
  engineering: 'Engineering',
  software_fees: 'Software Fees',
  referral: 'Referral',
  budget_builder: 'Budget Builder',
  marketing: 'Marketing',
}

interface DealSlideOverProps {
  open: boolean
  onClose: () => void
  deal: Deal
  companies: Pick<Company, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[]
  users: User[]
}

interface FormData {
  title: string
  company_id: string
  contact_id: string
  owner_id: string
  value: string
  stage: PipelineStage
  deal_type: DealType | ''
  probability: string
  expected_close_date: string
  notes: string
}

export function DealSlideOver({
  open,
  onClose,
  deal,
  companies,
  contacts,
  users,
}: DealSlideOverProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    title: '',
    company_id: '',
    contact_id: '',
    owner_id: '',
    value: '',
    stage: 'new_lead',
    deal_type: '',
    probability: '',
    expected_close_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stages = PIPELINE_STAGES

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        company_id: deal.company_id ?? '',
        contact_id: deal.contact_id ?? '',
        owner_id: deal.owner_id ?? '',
        value: deal.value?.toString() ?? '',
        stage: deal.stage,
        deal_type: deal.deal_type ?? '',
        probability: deal.probability?.toString() ?? '',
        expected_close_date: deal.expected_close_date ?? '',
        notes: deal.notes ?? '',
      })
    }
    setError(null)
  }, [deal, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        title: formData.title,
        company_id: formData.company_id || null,
        contact_id: formData.contact_id || null,
        owner_id: formData.owner_id || null,
        value: formData.value ? parseFloat(formData.value) : null,
        stage: formData.stage,
        deal_type: formData.deal_type || null,
        probability: formData.probability ? parseInt(formData.probability) : null,
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes || null,
      }

      const { error: updateError } = await (supabase.from('deals') as any)
        .update(payload)
        .eq('id', deal.id)

      if (updateError) throw updateError

      router.refresh()
      onClose()
    } catch (err) {
      console.error('Failed to save deal:', err)
      setError('Failed to save deal. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this deal? This action cannot be undone.')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await (supabase.from('deals') as any)
        .delete()
        .eq('id', deal.id)

      if (deleteError) throw deleteError

      router.push('/pipeline')
      router.refresh()
    } catch (err) {
      console.error('Failed to delete deal:', err)
      setError('Failed to delete deal. Please try again.')
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
          <h2 className="text-lg font-semibold text-gray-900">Edit Deal</h2>
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
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stage *
              </label>
              <select
                required
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as PipelineStage })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deal Type
              </label>
              <select
                value={formData.deal_type}
                onChange={(e) => setFormData({ ...formData, deal_type: e.target.value as DealType | '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">Select type</option>
                {DEAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DEAL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact
              </label>
              <select
                value={formData.contact_id}
                onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">No contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <select
                value={formData.owner_id}
                onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Probability %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Close Date
              </label>
              <input
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
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
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
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
              {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
