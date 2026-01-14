import { supabase } from '@/lib/supabase'
import type { Task, User, Contact, Deal, Company } from '@/lib/types'
import { TaskBoard } from './task-board'

export const dynamic = 'force-dynamic'

export interface TaskWithRelations extends Task {
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  deal_title: string | null
  company_name: string | null
  assigned_user_name: string | null
}

async function getTasks(): Promise<TaskWithRelations[]> {
  const { data } = await (supabase.from('tasks') as any)
    .select(`
      *,
      contacts(first_name, last_name, email, phone),
      deals(title),
      companies(name),
      assigned_user:users!tasks_assigned_to_fkey(name)
    `)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!data) return []

  return data.map((task: any) => ({
    ...task,
    contact_name: task.contacts
      ? `${task.contacts.first_name} ${task.contacts.last_name}`
      : null,
    contact_email: task.contacts?.email ?? null,
    contact_phone: task.contacts?.phone ?? null,
    deal_title: task.deals?.title ?? null,
    company_name: task.companies?.name ?? null,
    assigned_user_name: task.assigned_user?.name ?? null,
  }))
}

async function getUsers(): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .order('name')
    .returns<User[]>()

  return data ?? []
}

async function getContacts(): Promise<Pick<Contact, 'id' | 'first_name' | 'last_name' | 'owner_id'>[]> {
  const { data } = await (supabase.from('contacts') as any)
    .select('id, first_name, last_name, owner_id')
    .order('first_name')

  return data ?? []
}

async function getDeals(): Promise<Pick<Deal, 'id' | 'title'>[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('id, title')
    .order('title')

  return data ?? []
}

async function getCompanies(): Promise<Pick<Company, 'id' | 'name'>[]> {
  const { data } = await (supabase.from('companies') as any)
    .select('id, name')
    .order('name')

  return data ?? []
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>
}) {
  const params = await searchParams
  const [tasks, users, contacts, deals, companies] = await Promise.all([
    getTasks(),
    getUsers(),
    getContacts(),
    getDeals(),
    getCompanies(),
  ])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <TaskBoard
          initialTasks={tasks}
          users={users}
          contacts={contacts}
          deals={deals}
          companies={companies}
          initialTaskId={params.taskId}
        />
      </div>
    </main>
  )
}
