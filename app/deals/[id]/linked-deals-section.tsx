'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  linkDeals,
  unlinkDeals,
  searchDealsForLinking,
} from '@/lib/supabase'
import type {
  LinkedDealWithDetails,
  DealRelationshipType,
  Deal,
} from '@/lib/types'
import {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_DESCRIPTIONS,
  STAGE_LABELS,
  STAGE_COLORS,
} from '@/lib/types'

interface LinkedDealsSectionProps {
  dealId: string
  linkedDeals: LinkedDealWithDetails[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function LinkedDealsSection({ dealId, linkedDeals: initialLinkedDeals }: LinkedDealsSectionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [linkedDeals, setLinkedDeals] = useState(initialLinkedDeals)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(Deal & { company_name?: string | null })[]>([])
  const [selectedDeal, setSelectedDeal] = useState<(Deal & { company_name?: string | null }) | null>(null)
  const [relationshipType, setRelationshipType] = useState<DealRelationshipType>('referral_source')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get already linked deal IDs to exclude from search
  const linkedDealIds = linkedDeals.map(ld => ld.linked_deal_id)

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const results = await searchDealsForLinking(dealId, searchQuery, linkedDealIds)
      setSearchResults(results)
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, dealId, linkedDealIds])

  const handleLink = async () => {
    if (!selectedDeal) return

    setError(null)
    const { error: linkError } = await linkDeals(dealId, selectedDeal.id, relationshipType)

    if (linkError) {
      setError('Failed to link deals. Please try again.')
      return
    }

    // Reset and close modal
    setSelectedDeal(null)
    setSearchQuery('')
    setSearchResults([])
    setIsModalOpen(false)

    startTransition(() => {
      router.refresh()
    })
  }

  const handleUnlink = async (linkId: string) => {
    const { error: unlinkError } = await unlinkDeals(linkId)

    if (unlinkError) {
      console.error('Failed to unlink deals:', unlinkError)
      return
    }

    // Optimistically remove from local state
    setLinkedDeals(prev => prev.filter(ld => ld.id !== linkId))

    startTransition(() => {
      router.refresh()
    })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedDeal(null)
    setSearchQuery('')
    setSearchResults([])
    setError(null)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-gray-900">Linked Deals</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          + Link Deal
        </button>
      </div>

      {linkedDeals.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No linked deals yet. Link related deals to track referrals and connections.
        </p>
      ) : (
        <div className="space-y-3">
          {linkedDeals.map((link) => (
            <div
              key={link.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg group"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                {link.relationship_type === 'referral_source' && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                )}
                {link.relationship_type === 'referral_generated' && (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                )}
                {link.relationship_type === 'same_client' && (
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/deals/${link.linked_deal.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {link.linked_deal.title}
                    </Link>
                    {link.linked_deal.company_name && (
                      <p className="text-xs text-gray-500">{link.linked_deal.company_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${STAGE_COLORS[link.linked_deal.stage]}`}>
                        {STAGE_LABELS[link.linked_deal.stage]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {RELATIONSHIP_LABELS[link.relationship_type]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.linked_deal.value && (
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(link.linked_deal.value)}
                      </span>
                    )}
                    <button
                      onClick={() => handleUnlink(link.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                      title="Unlink deal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Deal Modal */}
      {isModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 pointer-events-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Link a Related Deal
            </h3>

            {/* Search input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search for a deal
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search deals..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Search results */}
            {searchQuery && (
              <div className="mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {isSearching ? (
                  <p className="p-3 text-sm text-gray-500">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">No deals found</p>
                ) : (
                  searchResults.map((deal) => (
                    <button
                      key={deal.id}
                      onClick={() => {
                        setSelectedDeal(deal)
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                      className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {deal.company_name && (
                          <span className="text-xs text-gray-500">{deal.company_name}</span>
                        )}
                        <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${STAGE_COLORS[deal.stage]}`}>
                          {STAGE_LABELS[deal.stage]}
                        </span>
                        {deal.value && (
                          <span className="text-xs text-gray-600">{formatCurrency(deal.value)}</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected deal */}
            {selectedDeal && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedDeal.title}</p>
                    {selectedDeal.company_name && (
                      <p className="text-xs text-gray-500">{selectedDeal.company_name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedDeal(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Relationship type selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relationship Type
              </label>
              <div className="space-y-2">
                {(Object.entries(RELATIONSHIP_LABELS) as [DealRelationshipType, string][]).map(([type, label]) => (
                  <label
                    key={type}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      relationshipType === type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="relationship"
                      value={type}
                      checked={relationshipType === type}
                      onChange={() => setRelationshipType(type)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{RELATIONSHIP_DESCRIPTIONS[type]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleLink}
                disabled={!selectedDeal || isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Linking...' : 'Link Deal'}
              </button>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
