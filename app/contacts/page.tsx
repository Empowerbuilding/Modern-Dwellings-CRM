import { supabase } from '@/lib/supabase'
import type { Contact, Company, ClientType, User } from '@/lib/types'
import { ContactsTable } from './contacts-table'

export const dynamic = 'force-dynamic'

export interface ContactWithCompany extends Contact {
  company_name: string | null
  company_type: ClientType | null
  owner_name: string | null
}

async function getContacts(): Promise<ContactWithCompany[]> {
  const { data } = await supabase
    .from('contacts')
    .select('*, companies(name, type), owner:owner_id(name)')
    .order('created_at', { ascending: false })
    .returns<(Contact & { companies: { name: string; type: ClientType } | null; owner: { name: string } | null })[]>()

  if (!data) return []

  return data.map((contact) => ({
    ...contact,
    company_name: contact.companies?.name ?? null,
    company_type: contact.companies?.type ?? null,
    owner_name: contact.owner?.name ?? null,
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

async function getUsers(): Promise<User[]> {
  const { data } = await (supabase.from('users') as any)
    .select('id, email, name, avatar_url, role')
    .order('name')

  return (data as User[]) ?? []
}

export default async function ContactsPage() {
  const [contacts, companies, users] = await Promise.all([
    getContacts(),
    getCompanies(),
    getUsers(),
  ])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <ContactsTable initialContacts={contacts} companies={companies} users={users} />
      </div>
    </main>
  )
}
