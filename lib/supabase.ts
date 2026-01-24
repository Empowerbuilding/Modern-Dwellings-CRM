import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database, PipelineStage, DealValueHistory, DealRelationshipType, LinkedDealWithDetails, Deal } from './types'
import { getInverseRelationship } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function createSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client for build time - queries will fail gracefully at runtime
    return createClient<Database>('http://localhost', 'placeholder')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Disable auth persistence to avoid multiple GoTrueClient instances
      // Auth is handled by supabase-browser.ts via @supabase/ssr
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      // Disable Next.js fetch caching so data is always fresh
      fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
    },
  })
}

export const supabase = createSupabaseClient()

// Update deal stage (calls API to handle Facebook events on "won" stage)
export async function updateDealStage(
  dealId: string,
  stage: PipelineStage
): Promise<{ error: Error | null }> {
  try {
    const response = await fetch(`/api/deals/${dealId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })

    if (!response.ok) {
      const data = await response.json()
      return { error: new Error(data.error || 'Failed to update deal stage') }
    }

    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to update deal stage') }
  }
}

// Log a value change to the deal_value_history table
export async function logDealValueChange(
  dealId: string,
  value: number,
  note?: string
): Promise<{ error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('deal_value_history') as any).insert({
    deal_id: dealId,
    value,
    note: note || null,
  })
  return { error }
}

// Update deal value and log the change
export async function updateDealValue(
  dealId: string,
  newValue: number,
  note?: string
): Promise<{ error: Error | null }> {
  // Update the deal value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('deals') as any)
    .update({ value: newValue })
    .eq('id', dealId)

  if (updateError) return { error: updateError }

  // Log the value change
  const { error: logError } = await logDealValueChange(dealId, newValue, note)
  return { error: logError }
}

// Get value history for a deal
export async function getDealValueHistory(
  dealId: string
): Promise<DealValueHistory[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('deal_value_history') as any)
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })

  return (data as DealValueHistory[]) ?? []
}

// ============ Linked Deals Functions ============

// Get all linked deals for a deal (both directions)
export async function getLinkedDeals(
  dealId: string
): Promise<LinkedDealWithDetails[]> {
  // Get deals where this deal is the source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outgoing } = await (supabase.from('linked_deals') as any)
    .select(`
      id,
      deal_id,
      linked_deal_id,
      relationship_type,
      created_at,
      linked_deal:deals!linked_deals_linked_deal_id_fkey(
        id, title, value, stage, deal_type, company_id,
        companies(name)
      )
    `)
    .eq('deal_id', dealId)

  // Get deals where this deal is the target (inverse relationship)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: incoming } = await (supabase.from('linked_deals') as any)
    .select(`
      id,
      deal_id,
      linked_deal_id,
      relationship_type,
      created_at,
      linked_deal:deals!linked_deals_deal_id_fkey(
        id, title, value, stage, deal_type, company_id,
        companies(name)
      )
    `)
    .eq('linked_deal_id', dealId)

  const results: LinkedDealWithDetails[] = []

  // Process outgoing links
  if (outgoing) {
    for (const link of outgoing) {
      if (link.linked_deal) {
        results.push({
          id: link.id,
          deal_id: link.deal_id,
          linked_deal_id: link.linked_deal_id,
          relationship_type: link.relationship_type,
          created_at: link.created_at,
          linked_deal: {
            ...link.linked_deal,
            company_name: link.linked_deal.companies?.name ?? null,
          },
        })
      }
    }
  }

  // Process incoming links (flip the relationship)
  if (incoming) {
    for (const link of incoming) {
      if (link.linked_deal) {
        results.push({
          id: link.id,
          deal_id: dealId,
          linked_deal_id: link.deal_id,
          relationship_type: getInverseRelationship(link.relationship_type),
          created_at: link.created_at,
          linked_deal: {
            ...link.linked_deal,
            company_name: link.linked_deal.companies?.name ?? null,
          },
        })
      }
    }
  }

  return results
}

// Link two deals together
export async function linkDeals(
  dealId: string,
  linkedDealId: string,
  relationshipType: DealRelationshipType
): Promise<{ error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('linked_deals') as any).insert({
    deal_id: dealId,
    linked_deal_id: linkedDealId,
    relationship_type: relationshipType,
  })

  return { error }
}

// Unlink two deals
export async function unlinkDeals(
  linkId: string
): Promise<{ error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('linked_deals') as any)
    .delete()
    .eq('id', linkId)

  return { error }
}

// Search deals for linking (excludes already linked and current deal)
export async function searchDealsForLinking(
  currentDealId: string,
  query: string,
  excludeIds: string[]
): Promise<(Deal & { company_name?: string | null })[]> {
  const allExcluded = [currentDealId, ...excludeIds]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('deals') as any)
    .select('*, companies(name)')
    .ilike('title', `%${query}%`)
    .not('id', 'in', `(${allExcluded.join(',')})`)
    .limit(10)

  if (!data) return []

  return data.map((deal: any) => ({
    ...deal,
    company_name: deal.companies?.name ?? null,
  }))
}
