import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Contact, Company, Deal, Activity, User } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/types'
import { ContactActivitiesSection } from './contact-activities-section'
import { ContactActions } from './contact-actions'
import { ActivityTimeline } from '@/components/activity-timeline'

export const dynamic = 'force-dynamic'

const LEAD_SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  facebook_ad: 'Facebook Ad',
  google: 'Google',
  referral: 'Referral',
  website: 'Website',
  contact_form: 'Contact Form',
  cost_calc: 'Cost Calculator',
  cold: 'Cold',
  repeat: 'Repeat',
  guide_download: 'Guide Download',
  empower_website: 'Empower Website',
  barnhaus_contact: 'Barnhaus Contact',
  other: 'Other',
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

async function getContact(id: string): Promise<Contact | null> {
  const { data } = await (supabase.from('contacts') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Contact | null
}

async function getCompany(id: string): Promise<Company | null> {
  const { data } = await (supabase.from('companies') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Company | null
}

async function getContactDeals(contactId: string): Promise<Deal[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  return (data as Deal[]) ?? []
}

interface ActivityWithUser extends Activity {
  user?: User | null
}

async function getContactActivities(contactId: string): Promise<ActivityWithUser[]> {
  const { data } = await (supabase.from('activities') as any)
    .select('*, user:user_id(id, name, email)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  return (data as ActivityWithUser[]) ?? []
}

async function getAllCompanies(): Promise<Pick<Company, 'id' | 'name' | 'type'>[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, type')
    .order('name')

  return (data as Pick<Company, 'id' | 'name' | 'type'>[]) ?? []
}

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const contact = await getContact(params.id)

  if (!contact) {
    notFound()
  }

  const [company, deals, activities, allCompanies] = await Promise.all([
    contact.company_id ? getCompany(contact.company_id) : null,
    getContactDeals(contact.id),
    getContactActivities(contact.id),
    getAllCompanies(),
  ])

  const totalDealValue = deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pt-14 md:pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/contacts"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Contacts
            </Link>
            <ContactActions contact={contact} companies={allCompanies} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                {contact.first_name} {contact.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {contact.lead_source && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {LEAD_SOURCE_LABELS[contact.lead_source] || contact.lead_source}
                  </span>
                )}
                {contact.client_type && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {CLIENT_TYPE_LABELS[contact.client_type] || contact.client_type}
                  </span>
                )}
                {contact.is_primary && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    Primary Contact
                  </span>
                )}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl sm:text-3xl font-semibold text-gray-900">
                {deals.length}
              </p>
              <p className="text-sm text-gray-500">
                {deals.length === 1 ? 'Deal' : 'Deals'} · {formatCurrency(totalDealValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Contact Info</h2>
              <dl className="space-y-3 text-sm">
                {contact.email && (
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {company && (
                  <div>
                    <dt className="text-gray-500">Company</dt>
                    <dd>
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {company.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {contact.role && (
                  <div>
                    <dt className="text-gray-500">Role</dt>
                    <dd className="text-gray-900">{contact.role}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">{formatDate(contact.created_at)}</dd>
                </div>
                {contact.notes && (
                  <div>
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="text-gray-900 whitespace-pre-wrap">{contact.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Associated Deals */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Deals</h2>
              {deals.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No deals yet
                </p>
              ) : (
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {deal.title}
                          </p>
                          <span className={`inline-flex mt-1 px-1.5 py-0.5 text-xs font-medium rounded ${STAGE_COLORS[deal.stage]}`}>
                            {STAGE_LABELS[deal.stage]}
                          </span>
                        </div>
                        {deal.value && (
                          <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                            {formatCurrency(deal.value)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Activities */}
          <div className="lg:col-span-2 space-y-6">
            <ContactActivitiesSection
              contactId={contact.id}
              activities={activities}
            />

            {/* Activity History Timeline */}
            <ActivityTimeline
              activities={activities}
              title="Activity History"
              defaultExpanded={false}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
