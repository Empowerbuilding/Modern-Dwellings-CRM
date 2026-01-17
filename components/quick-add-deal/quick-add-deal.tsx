'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, logDealValueChange } from '@/lib/supabase'
import type { DealType, SalesType, ClientType } from '@/lib/types'
import { useQuickAddDeal } from './context'
import { useAuth } from '@/components/auth-provider'

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'custom_design', label: 'Custom Design' },
  { value: 'builder_design', label: 'Builder Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'software_fees', label: 'Software Fees' },
  { value: 'referral', label: 'Referral' },
  { value: 'budget_builder', label: 'Budget Builder' },
  { value: 'marketing', label: 'Marketing' },
]

// Map company type to sales type
function getSalesTypeFromCompanyType(companyType: ClientType): SalesType {
  return companyType === 'consumer' ? 'b2c' : 'b2b'
}

interface CompanyOption {
  id: string
  name: string
  type?: ClientType
  isNew?: boolean
}

interface ContactOption {
  id: string
  name: string
  company_id?: string | null
  isNew?: boolean
}

export function QuickAddDeal() {
  const { isOpen, close } = useQuickAddDeal()
  const router = useRouter()
  const titleInputRef = useRef<HTMLInputElement>(null)
  const { crmUser } = useAuth()

  // Form state
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [dealType, setDealType] = useState<DealType | ''>('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [salesType, setSalesType] = useState<SalesType>('b2c')

  // Company autocomplete
  const [companySearch, setCompanySearch] = useState('')
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([])
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null)
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [newCompanyType, setNewCompanyType] = useState<ClientType>('consumer')

  // Contact autocomplete
  const [contactSearch, setContactSearch] = useState('')
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([])
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null)
  const [showContactDropdown, setShowContactDropdown] = useState(false)

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setValue('')
      setDealType('')
      setExpectedCloseDate('')
      setSalesType('b2c')
      setCompanySearch('')
      setSelectedCompany(null)
      setNewCompanyType('consumer')
      setContactSearch('')
      setSelectedContact(null)
      setError(null)
      // Focus title input after a short delay
      setTimeout(() => titleInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Keyboard shortcut to open (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          close()
        } else {
          // We need to use the context's open function
          // This is handled in the provider
        }
      }
      if (e.key === 'Escape' && isOpen) {
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close])

  // Search companies
  const searchCompanies = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCompanyOptions([])
      return
    }

    const { data } = await (supabase.from('companies') as any)
      .select('id, name, type')
      .ilike('name', `%${query}%`)
      .limit(5)

    const options: CompanyOption[] = (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type as ClientType,
    }))

    // Add "create new" option if no exact match
    const hasExactMatch = options.some(
      (c) => c.name.toLowerCase() === query.toLowerCase()
    )
    if (!hasExactMatch && query.trim()) {
      options.push({ id: 'new', name: query.trim(), isNew: true })
    }

    setCompanyOptions(options)
  }, [])

  // Search contacts
  const searchContacts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setContactOptions([])
      return
    }

    let queryBuilder = (supabase.from('contacts') as any)
      .select('id, first_name, last_name, company_id')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(5)

    // If company is selected, filter contacts by company
    if (selectedCompany && !selectedCompany.isNew) {
      queryBuilder = queryBuilder.eq('company_id', selectedCompany.id)
    }

    const { data } = await queryBuilder

    const options: ContactOption[] = (data ?? []).map((c: any) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      company_id: c.company_id,
    }))

    // Add "create new" option
    const nameParts = query.trim().split(' ')
    if (nameParts.length >= 1 && query.trim()) {
      options.push({
        id: 'new',
        name: query.trim(),
        isNew: true,
      })
    }

    setContactOptions(options)
  }, [selectedCompany])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showCompanyDropdown) {
        searchCompanies(companySearch)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [companySearch, showCompanyDropdown, searchCompanies])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showContactDropdown) {
        searchContacts(contactSearch)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [contactSearch, showContactDropdown, searchContacts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setError(null)
    setSaving(true)

    try {
      let companyId: string | null = null
      let contactId: string | null = null

      // Create company if new
      if (selectedCompany?.isNew) {
        const { data: newCompany, error: companyError } = await (supabase.from('companies') as any)
          .insert({
            name: selectedCompany.name,
            type: newCompanyType,
          })
          .select('id')
          .single()

        if (companyError) throw companyError
        companyId = newCompany.id
      } else if (selectedCompany) {
        companyId = selectedCompany.id
      }

      // Create contact if new
      if (selectedContact?.isNew) {
        const nameParts = selectedContact.name.split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        const { data: newContact, error: contactError } = await (supabase.from('contacts') as any)
          .insert({
            first_name: firstName,
            last_name: lastName || firstName, // Use first name as last if not provided
            company_id: companyId,
            is_primary: true,
          })
          .select('id')
          .single()

        if (contactError) throw contactError
        contactId = newContact.id
      } else if (selectedContact) {
        contactId = selectedContact.id
      }

      // Determine sales type based on company type
      let finalSalesType: SalesType = salesType
      if (selectedCompany?.isNew) {
        finalSalesType = getSalesTypeFromCompanyType(newCompanyType)
      } else if (selectedCompany?.type) {
        finalSalesType = getSalesTypeFromCompanyType(selectedCompany.type)
      }

      // Create the deal
      const dealValue = value ? parseFloat(value) : null
      const { data: newDeal, error: dealError } = await (supabase.from('deals') as any)
        .insert({
          title: title.trim(),
          value: dealValue,
          deal_type: dealType || null,
          expected_close_date: expectedCloseDate || null,
          stage: 'qualified',
          sales_type: finalSalesType,
          company_id: companyId,
          contact_id: contactId,
          owner_id: crmUser?.id || null,
        })
        .select('id')
        .single()

      if (dealError) throw dealError

      // Log initial value to history if value was set
      if (dealValue !== null && newDeal?.id) {
        await logDealValueChange(newDeal.id, dealValue, 'Initial value')
      }

      close()
      router.refresh()
    } catch (err) {
      console.error('Failed to create deal:', err)
      setError('Failed to create deal. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={close}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-brand-600">
          <div>
            <h2 className="text-lg font-semibold text-white">Quick Add Deal</h2>
            <p className="text-brand-100 text-sm">Add a new lead in seconds</p>
          </div>
          <button
            onClick={close}
            className="p-2 text-brand-100 hover:text-white transition-colors"
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
            {/* Title - most important, first */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deal Title *
              </label>
              <input
                ref={titleInputRef}
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Smith Residence - Custom Home"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            {/* Company autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              {selectedCompany ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                  <span className="flex-1 text-gray-900">
                    {selectedCompany.name}
                    {selectedCompany.isNew && (
                      <span className="ml-2 text-xs text-brand-600">(new)</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompany(null)
                      setCompanySearch('')
                      setSelectedContact(null)
                      setContactSearch('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  onFocus={() => setShowCompanyDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                  placeholder="Search or create company..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              )}
              {showCompanyDropdown && companyOptions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {companyOptions.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompany(option)
                          setCompanySearch('')
                          setShowCompanyDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                      >
                        {option.isNew ? (
                          <>
                            <span className="text-brand-600">+ Create</span>
                            <span className="font-medium">"{option.name}"</span>
                          </>
                        ) : (
                          <span>{option.name}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {/* Company type selector for new companies */}
              {selectedCompany?.isNew && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCompanyType('consumer')}
                    className={`px-3 py-1 text-xs rounded-full ${
                      newCompanyType === 'consumer'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Consumer
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCompanyType('builder')}
                    className={`px-3 py-1 text-xs rounded-full ${
                      newCompanyType === 'builder'
                        ? 'bg-brand-100 text-brand-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Builder
                  </button>
                </div>
              )}
            </div>

            {/* Contact autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact
              </label>
              {selectedContact ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                  <span className="flex-1 text-gray-900">
                    {selectedContact.name}
                    {selectedContact.isNew && (
                      <span className="ml-2 text-xs text-brand-600">(new)</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContact(null)
                      setContactSearch('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  onFocus={() => setShowContactDropdown(true)}
                  onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                  placeholder="Search or create contact..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              )}
              {showContactDropdown && contactOptions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {contactOptions.map((option, idx) => (
                    <li key={option.isNew ? `new-${idx}` : option.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedContact(option)
                          setContactSearch('')
                          setShowContactDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                      >
                        {option.isNew ? (
                          <>
                            <span className="text-brand-600">+ Create</span>
                            <span className="font-medium">"{option.name}"</span>
                          </>
                        ) : (
                          <span>{option.name}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
            </div>

            {/* Deal Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deal Type
              </label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as DealType | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">Select type...</option>
                {DEAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Expected Close Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Close Date
              </label>
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
          </div>

          {/* Sales Type selector (only shown when no company selected) */}
          {!selectedCompany && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sales Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSalesType('b2c')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    salesType === 'b2c'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">B2C</span>
                  <span className="block text-xs opacity-75">Consumer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSalesType('b2b')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    salesType === 'b2b'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">B2B</span>
                  <span className="block text-xs opacity-75">Builder</span>
                </button>
              </div>
            </div>
          )}

          {/* Stage indicator */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              This deal will be added to the <span className="font-medium text-gray-900">Lead</span> stage
              {' '}in the{' '}
              <span className="font-medium text-gray-900">
                {selectedCompany?.isNew
                  ? (newCompanyType === 'consumer' ? 'B2C' : 'B2B')
                  : selectedCompany?.type
                    ? (selectedCompany.type === 'consumer' ? 'B2C' : 'B2B')
                    : (salesType === 'b2c' ? 'B2C' : 'B2B')
                }
              </span>
              {' '}pipeline
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <p className="text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">⌘K</kbd> to toggle
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding...' : 'Add Deal'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
