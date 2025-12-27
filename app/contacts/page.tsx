import { supabase } from '@/lib/supabase'
import type { Contact, Company, ClientType } from '@/lib/types'
import { ContactsTable } from './contacts-table'

export const dynamic = 'force-dynamic'

export interface ContactWithCompany extends Contact {
  company_name: string | null
  company_type: ClientType | null
}

async function getContacts(): Promise<ContactWithCompany[]> {
  const { data } = await supabase
    .from('contacts')
    .select('*, companies(name, type)')
    .order('created_at', { ascending: false })
    .returns<(Contact & { companies: { name: string; type: ClientType } | null })[]>()

  if (!data) return []

  return data.map((contact) => ({
    ...contact,
    company_name: contact.companies?.name ?? null,
    company_type: contact.companies?.type ?? null,
  }))
}

async function getCompanies(): Promise<Pick<Company, 'id' | 'name' | 'type'>[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, type')
    .order('name')
    .returns<Pick<Company, 'id' | 'name' | 'type'>[]>()

  return data ?? []
}

export default async function ContactsPage() {
  const [contacts, companies] = await Promise.all([
    getContacts(),
    getCompanies(),
  ])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <ContactsTable initialContacts={contacts} companies={companies} />
      </div>
    </main>
  )
}
