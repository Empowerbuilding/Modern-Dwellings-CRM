import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase, getDealValueHistory, getLinkedDeals } from '@/lib/supabase'
import type { Deal, Company, Contact, DealValueHistory, DealType, User, Activity } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS, getStagesForSalesType } from '@/lib/types'
import { DealValueEditor } from './deal-value-editor'
import { LinkedDealsSection } from './linked-deals-section'
import { DealActions } from './deal-actions'
import { ActivitiesSection } from './activities-section'
import { ActivityTimeline } from '@/components/activity-timeline'

export const dynamic = 'force-dynamic'

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  custom_design: 'Custom Design',
  builder_design: 'Builder Design',
  engineering: 'Engineering',
  software_fees: 'Software Fees',
  referral: 'Referral',
  budget_builder: 'Budget Builder',
}

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function getDeal(id: string): Promise<Deal | null> {
  const { data } = await (supabase.from('deals') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Deal | null
}

async function getCompany(id: string): Promise<Company | null> {
  const { data } = await (supabase.from('companies') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Company | null
}

async function getContact(id: string): Promise<Contact | null> {
  const { data } = await (supabase.from('contacts') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Contact | null
}

async function getAllCompanies(): Promise<Pick<Company, 'id' | 'name'>[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name')
    .order('name')
    .returns<Pick<Company, 'id' | 'name'>[]>()

  return data ?? []
}

async function getAllContacts(): Promise<Pick<Contact, 'id' | 'first_name' | 'last_name'>[]> {
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .order('first_name')
    .returns<Pick<Contact, 'id' | 'first_name' | 'last_name'>[]>()

  return data ?? []
}

async function getAllUsers(): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .order('name')
    .returns<User[]>()

  return data ?? []
}

interface ActivityWithUser extends Activity {
  user?: User | null
}

async function getDealActivities(dealId: string): Promise<Activity[]> {
  const { data, error } = await (supabase.from('activities') as any)
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching deal activities:', error)
    return []
  }

  console.log(`Fetched ${data?.length ?? 0} activities for deal ${dealId}`)
  return (data as Activity[]) ?? []
}

export default async function DealDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const deal = await getDeal(params.id)

  if (!deal) {
    notFound()
  }

  const [company, contact, valueHistory, linkedDeals, allCompanies, allContacts, allUsers, activities] = await Promise.all([
    deal.company_id ? getCompany(deal.company_id) : null,
    deal.contact_id ? getContact(deal.contact_id) : null,
    getDealValueHistory(deal.id),
    getLinkedDeals(deal.id),
    getAllCompanies(),
    getAllContacts(),
    getAllUsers(),
    getDealActivities(deal.id),
  ])

  const stages = getStagesForSalesType(deal.sales_type)
  const currentStageIndex = stages.indexOf(deal.stage)

  // Calculate value changes
  const valueChanges = valueHistory.map((entry, index) => {
    const prevValue = index > 0 ? valueHistory[index - 1].value : 0
    const change = entry.value - prevValue
    return { ...entry, change }
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pt-14 md:pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
<Link
              href="/pipeline"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Pipeline
            </Link>
            <DealActions deal={deal} companies={allCompanies} contacts={allContacts} users={allUsers} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{deal.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${STAGE_COLORS[deal.stage]}`}>
                  {STAGE_LABELS[deal.stage]}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  deal.sales_type === 'b2c'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {deal.sales_type === 'b2c' ? 'B2C' : 'B2B'}
                </span>
                {deal.deal_type && (
                  <span className="text-xs sm:text-sm text-gray-500">
                    {DEAL_TYPE_LABELS[deal.deal_type]}
                  </span>
                )}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl sm:text-3xl font-semibold text-gray-900">
                {deal.value ? formatCurrency(deal.value) : '$0'}
              </p>
              <p className="text-sm text-gray-500">Current Value</p>
            </div>
          </div>
        </div>

        {/* Stage Progress */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Progress</h2>
          <div className="flex items-center gap-1">
            {stages.map((stage, index) => {
              const isCompleted = index < currentStageIndex
              const isCurrent = index === currentStageIndex
              const isLost = deal.stage === 'lost'

              return (
                <div key={stage} className="flex-1 flex items-center">
                  <div
                    className={`flex-1 h-2 rounded-full ${
                      isLost && isCurrent
                        ? 'bg-red-500'
                        : isCompleted || isCurrent
                          ? 'bg-blue-500'
                          : 'bg-gray-200'
                    }`}
                  />
                  {index < stages.length - 1 && <div className="w-1" />}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            {stages.map((stage, index) => (
              <span
                key={stage}
                className={`text-xs ${
                  index <= currentStageIndex ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Deal Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Deal Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Deal Details</h2>
              <dl className="space-y-3 text-sm">
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
                {contact && (
                  <div>
                    <dt className="text-gray-500">Contact</dt>
                    <dd>
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contact.first_name} {contact.last_name}
                      </Link>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Expected Close</dt>
                  <dd className="text-gray-900">{formatDate(deal.expected_close_date)}</dd>
                </div>
                {deal.probability !== null && (
                  <div>
                    <dt className="text-gray-500">Probability</dt>
                    <dd className="text-gray-900">{deal.probability}%</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">{formatDate(deal.created_at)}</dd>
                </div>
                {deal.notes && (
                  <div>
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="text-gray-900 whitespace-pre-wrap">{deal.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Contact Info */}
            {contact && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-medium text-gray-900">Contact Info</h2>
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View Contact
                  </Link>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Name</dt>
                    <dd className="text-gray-900 font-medium">
                      {contact.first_name} {contact.last_name}
                    </dd>
                  </div>
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
                  {(contact.lead_source || contact.client_type) && (
                    <div className="flex flex-wrap gap-2 pt-1">
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
                    </div>
                  )}
                  {contact.notes && (
                    <div>
                      <dt className="text-gray-500">Notes</dt>
                      <dd className="text-gray-900 whitespace-pre-wrap">{contact.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Linked Deals */}
            <LinkedDealsSection dealId={deal.id} linkedDeals={linkedDeals} />
          </div>

          {/* Right Column - Value History & Activities */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activities */}
            <ActivitiesSection dealId={deal.id} activities={activities} />

            {/* Activity History Timeline */}
            <ActivityTimeline
              activities={activities}
              title="Activity History"
              defaultExpanded={true}
            />

            {/* Value History */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">Value History</h2>
                <DealValueEditor dealId={deal.id} currentValue={deal.value ?? 0} />
              </div>

              {valueChanges.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  No value history yet. Update the deal value to start tracking.
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                  {/* Timeline entries */}
                  <div className="space-y-4">
                    {valueChanges.map((entry, index) => (
                      <div key={entry.id} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div
                          className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            index === valueChanges.length - 1
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          <span className="text-xs font-medium">
                            {index + 1}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-gray-50 rounded-lg p-3 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(entry.value)}
                              </p>
                              {entry.change !== 0 && index > 0 && (
                                <p className={`text-sm ${
                                  entry.change > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {entry.change > 0 ? '+' : ''}{formatCurrency(entry.change)}
                                </p>
                              )}
                              {entry.note && (
                                <p className="text-sm text-gray-600 mt-1">{entry.note}</p>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 flex-shrink-0">
                              {formatDateTime(entry.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  {valueChanges.length > 1 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total Change</span>
                        <span className={`font-medium ${
                          (deal.value ?? 0) - valueChanges[0].value > 0
                            ? 'text-green-600'
                            : (deal.value ?? 0) - valueChanges[0].value < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                        }`}>
                          {(deal.value ?? 0) - valueChanges[0].value > 0 ? '+' : ''}
                          {formatCurrency((deal.value ?? 0) - valueChanges[0].value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-600">Starting Value</span>
                        <span className="text-gray-900">{formatCurrency(valueChanges[0].value)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
