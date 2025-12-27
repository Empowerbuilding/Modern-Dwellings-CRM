import { supabase } from '@/lib/supabase'
import type { Deal, PipelineStage } from '@/lib/types'
import { PipelineBoard } from './pipeline-board'

export const dynamic = 'force-dynamic'

export interface DealWithCompany extends Deal {
  company_name: string | null
}

async function getDeals(): Promise<DealWithCompany[]> {
  const { data } = await supabase
    .from('deals')
    .select('*, companies(name)')
    .order('created_at', { ascending: false })
    .returns<(Deal & { companies: { name: string } | null })[]>()

  if (!data) return []

  return data.map((deal) => ({
    ...deal,
    company_name: deal.companies?.name ?? null,
  }))
}

export default async function PipelinePage() {
  const deals = await getDeals()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Pipeline</h1>
        <PipelineBoard initialDeals={deals} />
      </div>
    </main>
  )
}
