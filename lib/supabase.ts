import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database, PipelineStage } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function createSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client for build time - queries will fail gracefully at runtime
    return createClient<Database>('http://localhost', 'placeholder')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()

// Update function with explicit typing
export async function updateDealStage(dealId: string, stage: PipelineStage) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('deals') as any).update({ stage }).eq('id', dealId)
}
