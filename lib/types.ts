// Enum types matching your business domain
export type ClientType = 'builder' | 'consumer' | 'subcontractor' | 'engineer' | 'architect'

export type DealType = 'custom_design' | 'builder_design' | 'engineering' | 'software_fees' | 'referral' | 'budget_builder'

export type SalesType = 'b2c' | 'b2b'

// Combined stages from both workflows
// B2C: lead → qualified → concept → design → engineering → complete → lost
// B2B: lead → qualified → proposal → active → complete → lost
export type PipelineStage =
  | 'lead'
  | 'qualified'
  | 'concept'      // B2C only
  | 'design'       // B2C only
  | 'engineering'  // B2C only
  | 'proposal'     // B2B only
  | 'active'       // B2B only
  | 'complete'
  | 'lost'

// Stage configurations by sales type
export const B2C_STAGES: PipelineStage[] = ['lead', 'qualified', 'concept', 'design', 'engineering', 'complete', 'lost']
export const B2B_STAGES: PipelineStage[] = ['lead', 'qualified', 'proposal', 'active', 'complete', 'lost']

export const STAGE_LABELS: Record<PipelineStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  concept: 'Concept',
  design: 'Design',
  engineering: 'Engineering',
  proposal: 'Proposal',
  active: 'Active',
  complete: 'Complete',
  lost: 'Lost',
}

export const STAGE_COLORS: Record<PipelineStage, string> = {
  lead: 'bg-gray-100 text-gray-800',
  qualified: 'bg-blue-100 text-blue-800',
  concept: 'bg-cyan-100 text-cyan-800',
  design: 'bg-indigo-100 text-indigo-800',
  engineering: 'bg-violet-100 text-violet-800',
  proposal: 'bg-yellow-100 text-yellow-800',
  active: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
}

export function getStagesForSalesType(salesType: SalesType): PipelineStage[] {
  return salesType === 'b2c' ? B2C_STAGES : B2B_STAGES
}

export type LeadSource = 'facebook' | 'facebook_ad' | 'google' | 'referral' | 'website' | 'contact_form' | 'cost_calc' | 'cold' | 'repeat' | 'guide_download' | 'empower_website' | 'barnhaus_contact' | 'other'

export type ActivityType =
  | 'page_view'
  | 'form_submit'
  | 'email_sent'
  | 'sms_sent'
  | 'call'
  | 'note'
  | 'stage_change'
  | 'deal_created'
  | 'contact_created'

export type UserRole = 'admin' | 'sales'

// Table row types
export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: UserRole
  created_at?: string
}

export interface Company {
  id: string
  name: string
  type: ClientType
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface Contact {
  id: string
  company_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean
  lead_source: LeadSource | null
  client_type: ClientType | null
  fbclid: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface Deal {
  id: string
  company_id: string | null
  contact_id: string | null
  owner_id: string | null
  title: string
  value: number | null
  stage: PipelineStage
  sales_type: SalesType
  deal_type: DealType | null
  probability: number | null
  expected_close_date: string | null
  actual_close_date: string | null
  lost_reason: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface Activity {
  id: string
  contact_id: string | null
  deal_id: string | null
  company_id: string | null
  user_id: string | null
  activity_type: ActivityType
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  anonymous_id: string | null
  created_at: string
}

export interface DealValueHistory {
  id: string
  deal_id: string
  value: number
  note: string | null
  created_at: string
}

// Linked deals types
export type DealRelationshipType = 'referral_source' | 'referral_generated' | 'same_client'

export const RELATIONSHIP_LABELS: Record<DealRelationshipType, string> = {
  referral_source: 'Referral Source',
  referral_generated: 'Generated Referral',
  same_client: 'Same Client',
}

export const RELATIONSHIP_DESCRIPTIONS: Record<DealRelationshipType, string> = {
  referral_source: 'This deal led to the linked deal',
  referral_generated: 'This deal was generated from the linked deal',
  same_client: 'Both deals are for the same client',
}

// Get the inverse relationship type (for bidirectional linking)
export function getInverseRelationship(type: DealRelationshipType): DealRelationshipType {
  switch (type) {
    case 'referral_source':
      return 'referral_generated'
    case 'referral_generated':
      return 'referral_source'
    case 'same_client':
      return 'same_client'
  }
}

export interface LinkedDeal {
  id: string
  deal_id: string
  linked_deal_id: string
  relationship_type: DealRelationshipType
  created_at: string
}

export interface LinkedDealWithDetails extends LinkedDeal {
  linked_deal: Deal & {
    company_name?: string | null
  }
}

// Joined types for queries
export interface DealWithRelations extends Deal {
  company?: Company | null
  contact?: Contact | null
}

export interface ActivityWithRelations extends Activity {
  deal?: Deal | null
  contact?: Contact | null
  company?: Company | null
  user?: User | null
}

// Supabase Database type for client
export interface Database {
  public: {
    Tables: {
      companies: {
        Row: Company
        Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Company, 'id'>>
        Relationships: []
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Contact, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'contacts_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      deals: {
        Row: Deal
        Insert: Omit<Deal, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Deal, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'deals_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deals_contact_id_fkey'
            columns: ['contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          }
        ]
      }
      activities: {
        Row: Activity
        Insert: Omit<Activity, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Activity, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'activities_contact_id_fkey'
            columns: ['contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Pipeline summary type for dashboard
export interface PipelineSummary {
  stage: PipelineStage
  count: number
  total_value: number
}
