// Enum types matching your business domain
export type ClientType = 'builder' | 'consumer' | 'subcontractor' | 'engineer' | 'architect'

export type DealType = 'custom_design' | 'builder_design' | 'engineering' | 'software_fees' | 'referral' | 'budget_builder'

export type PipelineStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export type LeadSource = 'facebook' | 'google' | 'referral' | 'website' | 'cold' | 'repeat' | 'other'

export type ActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note'

// Table row types
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
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface Deal {
  id: string
  company_id: string | null
  contact_id: string | null
  title: string
  value: number | null
  stage: PipelineStage
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
  deal_id: string | null
  contact_id: string | null
  company_id: string | null
  type: ActivityType
  title: string
  description: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_at?: string
  updated_at?: string
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
        Insert: Omit<Activity, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Activity, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'activities_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_contact_id_fkey'
            columns: ['contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
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
