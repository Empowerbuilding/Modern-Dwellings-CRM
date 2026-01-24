'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientType } from '@/lib/types'
import type { CompanyWithStats } from './page'
import { CompanySlideOver } from './company-slide-over'

const CLIENT_TYPES: ClientType[] = [
  'builder',
  'consumer',
  'subcontractor',
  'engineer',
  'architect',
  'realtor',
]

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
  realtor: 'Realtor',
}

const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  builder: 'bg-brand-100 text-brand-800',
  consumer: 'bg-green-100 text-green-800',
  subcontractor: 'bg-orange-100 text-orange-800',
  engineer: 'bg-purple-100 text-purple-800',
  architect: 'bg-pink-100 text-pink-800',
  realtor: 'bg-teal-100 text-teal-800',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface CompaniesTableProps {
  initialCompanies: CompanyWithStats[]
}

export function CompaniesTable({ initialCompanies }: CompaniesTableProps) {
  const router = useRouter()
  const [companies, setCompanies] = useState(initialCompanies)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | ''>('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyWithStats | null>(null)

  const handleAddNew = () => {
    setEditingCompany(null)
    setSlideOverOpen(true)
  }

  const handleSave = (savedCompany: CompanyWithStats) => {
    if (editingCompany) {
      setCompanies((prev) =>
        prev.map((c) => (c.id === savedCompany.id ? savedCompany : c))
      )
    } else {
      setCompanies((prev) => [savedCompany, ...prev])
    }
    setSlideOverOpen(false)
    setEditingCompany(null)
  }

  const handleDelete = (companyId: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== companyId))
    setSlideOverOpen(false)
    setEditingCompany(null)
  }

  const filteredCompanies = useMemo(() => {
    let result = [...companies]

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((company) => {
        return (
          company.name.toLowerCase().includes(searchLower) ||
          company.city?.toLowerCase().includes(searchLower) ||
          company.primary_contact?.toLowerCase().includes(searchLower)
        )
      })
    }

    if (typeFilter) {
      result = result.filter((company) => company.type === typeFilter)
    }

    return result
  }, [companies, search, typeFilter])

  const handleRowClick = (companyId: string) => {
    router.push(`/companies/${companyId}`)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 pt-14 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900">Companies</h1>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          New Company
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, city, or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ClientType | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
        >
          <option value="">All Types</option>
          {CLIENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {CLIENT_TYPE_LABELS[type]}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Primary Contact
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open Deals
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {companies.length === 0
                      ? 'No companies yet.'
                      : 'No companies match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    onClick={() => handleRowClick(company.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{company.name}</p>
                      {/* Show type badge on mobile */}
                      <span
                        className={`inline-flex sm:hidden items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${CLIENT_TYPE_COLORS[company.type]}`}
                      >
                        {CLIENT_TYPE_LABELS[company.type]}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLIENT_TYPE_COLORS[company.type]}`}
                      >
                        {CLIENT_TYPE_LABELS[company.type]}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">
                      {company.primary_contact ?? '-'}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-600">
                      {company.city ?? '-'}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-900 text-right">
                      {company.open_deals_count > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-brand-100 text-brand-800 rounded-full text-xs font-medium">
                          {company.open_deals_count}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {company.total_revenue > 0
                        ? formatCurrency(company.total_revenue)
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        {filteredCompanies.length} of {companies.length} companies
      </p>

      <CompanySlideOver
        open={slideOverOpen}
        onClose={() => {
          setSlideOverOpen(false)
          setEditingCompany(null)
        }}
        company={editingCompany}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
