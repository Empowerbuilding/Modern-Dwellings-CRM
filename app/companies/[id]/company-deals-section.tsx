'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, logDealValueChange } from '@/lib/supabase'
import type { Deal, DealType, PipelineStage, Contact } from '@/lib/types'
import { STAGE_COLORS, STAGE_LABELS } from '@/lib/types'
import { useAuth } from '@/components/auth-provider'

type DealWithContact = Deal & { contacts: { first_name: string; last_name: string } | null }

interface CompanyDealsSectionProps {
  companyId: string
  companyName: string
  deals: DealWithContact[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[]
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  custom_design: 'Custom Design',
  builder_design: 'Builder Design',
  engineering: 'Engineering',
  software_fees: 'Software Fees',
  referral: 'Referral',
  budget_builder: 'Budget Builder',
  marketing: 'Marketing',
}

const DEAL_TYPES: DealType[] = [
  'custom_design',
  'builder_design',
  'engineering',
  'software_fees',
  'referral',
  'budget_builder',
  'marketing',
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function AddDealModal({
  open,
  onClose,
  companyId,
  companyName,
  contacts,
  onSave,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  companyName: string
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[]
  onSave: (deal: DealWithContact) => void
}) {
  const { crmUser } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    deal_type: '' as DealType | '',
    expected_close_date: '',
    contact_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const dealValue = formData.value ? parseFloat(formData.value) : null

      const { data, error: insertError } = await (supabase.from('deals') as any)
        .insert({
          title: formData.title.trim(),
          value: dealValue,
          deal_type: formData.deal_type || null,
          expected_close_date: formData.expected_close_date || null,
          stage: 'qualified' as PipelineStage,
          company_id: companyId,
          contact_id: formData.contact_id || null,
          owner_id: crmUser?.id || null,
        })
        .select('*, contacts(first_name, last_name)')
        .single()

      if (insertError) throw insertError

      // Log initial value to history if value was set
      if (dealValue !== null && data?.id) {
        await logDealValueChange(data.id, dealValue, 'Initial value')
      }

      onSave(data)
      onClose()

      // Reset form
      setFormData({
        title: '',
        value: '',
        deal_type: '',
        expected_close_date: '',
        contact_id: '',
      })
    } catch (err) {
      console.error('Failed to create deal:', err)
      setError('Failed to create deal')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Add Deal</h3>
          <p className="text-sm text-gray-500 mb-4">for {companyName}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Deal title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact (Optional)
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
                Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>
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
                <option value="">Select type...</option>
                {DEAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DEAL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
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

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating...' : 'Create Deal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function CompanyDealsSection({
  companyId,
  companyName,
  deals: initialDeals,
  contacts,
}: CompanyDealsSectionProps) {
  const router = useRouter()
  const [deals, setDeals] = useState(initialDeals)
  const [modalOpen, setModalOpen] = useState(false)

  const handleDealSave = (newDeal: DealWithContact) => {
    setDeals((prev) => [newDeal, ...prev])
    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-gray-900">
          Deals ({deals.length})
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium"
        >
          + Add Deal
        </button>
      </div>

      {deals.length === 0 ? (
        <p className="text-sm text-gray-500">No deals yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Deal
                </th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Contact
                </th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Stage
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Value
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Close Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td className="py-2">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-600"
                    >
                      {deal.title}
                    </Link>
                    {deal.deal_type && (
                      <p className="text-xs text-gray-500">
                        {DEAL_TYPE_LABELS[deal.deal_type]}
                      </p>
                    )}
                  </td>
                  <td className="py-2 text-sm text-gray-600">
                    {deal.contacts
                      ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
                      : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[deal.stage]}`}
                    >
                      {STAGE_LABELS[deal.stage]}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-gray-900 text-right">
                    {deal.value ? formatCurrency(deal.value) : '-'}
                  </td>
                  <td className="py-2 text-sm text-gray-600 text-right">
                    {deal.stage === 'complete' || deal.stage === 'lost'
                      ? formatDate(deal.actual_close_date)
                      : formatDate(deal.expected_close_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddDealModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        companyName={companyName}
        contacts={contacts}
        onSave={handleDealSave}
      />
    </div>
  )
}
