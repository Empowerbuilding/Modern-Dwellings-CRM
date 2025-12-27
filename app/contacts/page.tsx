import { supabase } from '@/lib/supabase'
import type { Contact, Company } from '@/lib/types'
import { ContactsTable } from './contacts-table'

export const dynamic = 'force-dynamic'

export interface ContactWithCompany extends Contact {
  company_name: string | null
}

async function getContacts(): Promise<ContactWithCompany[]> {
  const { data } = await supabase
    .from('contacts')
    .select('*, companies(name)')
    .order('created_at', { ascending: false })
    .returns<(Contact & { companies: { name: string } | null })[]>()

  if (!data) return []

  return data.map((contact) => ({
    ...contact,
    company_name: contact.companies?.name ?? null,
  }))
}

async function getCompanies(): Promise<Pick<Company, 'id' | 'name'>[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name')
    .order('name')
    .returns<Pick<Company, 'id' | 'name'>[]>()

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
