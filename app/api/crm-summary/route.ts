import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STAGE_LABELS, LIFECYCLE_STAGE_LABELS } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface NoteSummary {
  id: string
  content: string
  created_at: string
  contact_name: string
  contact_id: string
  author_name: string | null
}

interface ContactCreated {
  id: string
  name: string
  email: string | null
  phone: string | null
  company_name: string | null
  lead_source: string | null
  created_at: string
}

interface ContactUpdated {
  id: string
  name: string
  updated_at: string
  changes: string[]
}

interface ActivitySummary {
  id: string
  activity_type: string
  title: string
  contact_name: string | null
  created_at: string
  user_name: string | null
}

interface DealCreated {
  id: string
  title: string
  value: number | null
  stage: string
  stage_label: string
  sales_type: string
  contact_name: string | null
  company_name: string | null
  created_at: string
}

interface DealMoved {
  id: string
  title: string
  value: number | null
  from_stage: string
  from_stage_label: string
  to_stage: string
  to_stage_label: string
  sales_type: string
  contact_name: string | null
  moved_at: string
}

interface LifecycleChange {
  contact_id: string
  contact_name: string
  from_stage: string
  from_stage_label: string
  to_stage: string
  to_stage_label: string
  changed_at: string
}

interface CRMSummaryResponse {
  period: {
    start: string
    end: string
    hours: number
  }
  notes: NoteSummary[]
  contacts_created: ContactCreated[]
  contacts_updated: ContactUpdated[]
  lifecycle_changes: LifecycleChange[]
  deals_created: DealCreated[]
  deals_moved: DealMoved[]
  activities: ActivitySummary[]
  stats: {
    total_notes: number
    total_contacts_created: number
    total_contacts_updated: number
    total_lifecycle_changes: number
    total_deals_created: number
    total_deals_created_value: number
    total_deals_moved: number
    total_activities: number
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const hoursBack = parseInt(searchParams.get('hours') || '24', 10)

  // Calculate the time window
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - hoursBack * 60 * 60 * 1000)

  try {
    // Fetch notes created in the period
    const { data: notes } = await supabase
      .from('notes')
      .select(`
        id,
        content,
        created_at,
        contact_id,
        contacts(first_name, last_name),
        author:created_by(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    const noteSummaries: NoteSummary[] = (notes || []).map((note: any) => ({
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      contact_id: note.contact_id,
      contact_name: note.contacts
        ? `${note.contacts.first_name} ${note.contacts.last_name}`
        : 'Unknown',
      author_name: note.author?.name || null,
    }))

    // Fetch contacts created in the period
    const { data: newContacts } = await supabase
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        lead_source,
        created_at,
        companies(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    const contactsCreated: ContactCreated[] = (newContacts || []).map((contact: any) => ({
      id: contact.id,
      name: `${contact.first_name} ${contact.last_name}`,
      email: contact.email,
      phone: contact.phone,
      company_name: contact.companies?.name || null,
      lead_source: contact.lead_source,
      created_at: contact.created_at,
    }))

    // Fetch contacts updated in the period (but not created in the period)
    const { data: updatedContacts } = await supabase
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        updated_at,
        created_at
      `)
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString())
      .lt('created_at', startDate.toISOString()) // Exclude newly created contacts
      .order('updated_at', { ascending: false })

    // For updated contacts, check activities to see what changed
    const contactsUpdated: ContactUpdated[] = []

    if (updatedContacts && updatedContacts.length > 0) {
      const contactIds = updatedContacts.map((c: any) => c.id)

      // Get activities for these contacts to understand what changed
      const { data: updateActivities } = await supabase
        .from('activities')
        .select('contact_id, activity_type, title, metadata')
        .in('contact_id', contactIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('activity_type', ['lifecycle_stage_changed', 'contact_updated', 'deal_created', 'deal_stage_changed'])

      const activityByContact = new Map<string, string[]>()
      for (const activity of updateActivities || []) {
        const changes = activityByContact.get(activity.contact_id) || []
        changes.push(activity.title)
        activityByContact.set(activity.contact_id, changes)
      }

      for (const contact of updatedContacts) {
        const changes = activityByContact.get(contact.id) || ['Contact information updated']
        contactsUpdated.push({
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          updated_at: contact.updated_at,
          changes,
        })
      }
    }

    // Fetch lifecycle stage changes
    const { data: lifecycleActivities } = await supabase
      .from('activities')
      .select(`
        id,
        title,
        metadata,
        created_at,
        contact_id,
        contacts(first_name, last_name)
      `)
      .eq('activity_type', 'lifecycle_stage_changed')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    const lifecycleChanges: LifecycleChange[] = (lifecycleActivities || []).map((activity: any) => {
      const metadata = activity.metadata as any
      const fromStage = metadata?.from_stage || metadata?.previous_stage || 'unknown'
      const toStage = metadata?.to_stage || metadata?.new_stage || 'unknown'

      return {
        contact_id: activity.contact_id,
        contact_name: activity.contacts
          ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
          : 'Unknown',
        from_stage: fromStage,
        from_stage_label: LIFECYCLE_STAGE_LABELS[fromStage as keyof typeof LIFECYCLE_STAGE_LABELS] || fromStage,
        to_stage: toStage,
        to_stage_label: LIFECYCLE_STAGE_LABELS[toStage as keyof typeof LIFECYCLE_STAGE_LABELS] || toStage,
        changed_at: activity.created_at,
      }
    })

    // Fetch deals created in the period
    const { data: newDeals } = await supabase
      .from('deals')
      .select(`
        id,
        title,
        value,
        stage,
        sales_type,
        created_at,
        contacts(first_name, last_name),
        companies(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    const dealsCreated: DealCreated[] = (newDeals || []).map((deal: any) => ({
      id: deal.id,
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      stage_label: STAGE_LABELS[deal.stage as keyof typeof STAGE_LABELS] || deal.stage,
      sales_type: deal.sales_type,
      contact_name: deal.contacts
        ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
        : null,
      company_name: deal.companies?.name || null,
      created_at: deal.created_at,
    }))

    // Fetch deal stage changes from activities (support both old and new activity types)
    const { data: stageChangeActivities } = await supabase
      .from('activities')
      .select(`
        id,
        title,
        metadata,
        created_at,
        deal_id,
        contacts(first_name, last_name)
      `)
      .in('activity_type', ['deal_stage_changed', 'stage_change'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    const dealsMoved: DealMoved[] = []

    if (stageChangeActivities && stageChangeActivities.length > 0) {
      // Get deal details for each stage change (handle both old and new formats)
      const dealIds = stageChangeActivities
        .map((a: any) => a.deal_id || a.metadata?.deal_id)
        .filter(Boolean)

      const { data: dealDetails } = await supabase
        .from('deals')
        .select('id, title, value, sales_type')
        .in('id', dealIds)

      const dealMap = new Map((dealDetails || []).map((d: any) => [d.id, d]))

      for (const activity of stageChangeActivities) {
        const metadata = activity.metadata as any
        const dealId = activity.deal_id || metadata?.deal_id
        const deal = dealMap.get(dealId)

        // Support both old format (previous_stage/new_stage) and new format (from_stage/to_stage)
        const fromStage = metadata?.from_stage || metadata?.previous_stage
        const toStage = metadata?.to_stage || metadata?.new_stage

        if (deal && fromStage && toStage) {
          dealsMoved.push({
            id: deal.id,
            title: deal.title,
            value: deal.value,
            from_stage: fromStage,
            from_stage_label: STAGE_LABELS[fromStage as keyof typeof STAGE_LABELS] || fromStage,
            to_stage: toStage,
            to_stage_label: STAGE_LABELS[toStage as keyof typeof STAGE_LABELS] || toStage,
            sales_type: deal.sales_type,
            contact_name: activity.contacts
              ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
              : null,
            moved_at: activity.created_at,
          })
        }
      }
    }

    // Fetch all relevant activities in the period
    const { data: activities } = await supabase
      .from('activities')
      .select(`
        id,
        activity_type,
        title,
        created_at,
        contacts(first_name, last_name),
        user:user_id(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    const activitySummaries: ActivitySummary[] = (activities || []).map((activity: any) => ({
      id: activity.id,
      activity_type: activity.activity_type,
      title: activity.title,
      contact_name: activity.contacts
        ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
        : null,
      created_at: activity.created_at,
      user_name: activity.user?.name || null,
    }))

    const response: CRMSummaryResponse = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        hours: hoursBack,
      },
      notes: noteSummaries,
      contacts_created: contactsCreated,
      contacts_updated: contactsUpdated,
      lifecycle_changes: lifecycleChanges,
      deals_created: dealsCreated,
      deals_moved: dealsMoved,
      activities: activitySummaries,
      stats: {
        total_notes: noteSummaries.length,
        total_contacts_created: contactsCreated.length,
        total_contacts_updated: contactsUpdated.length,
        total_lifecycle_changes: lifecycleChanges.length,
        total_deals_created: dealsCreated.length,
        total_deals_created_value: dealsCreated.reduce((sum, d) => sum + (d.value || 0), 0),
        total_deals_moved: dealsMoved.length,
        total_activities: activitySummaries.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('CRM Summary error:', error)
    return NextResponse.json(
      { error: 'Failed to generate CRM summary' },
      { status: 500 }
    )
  }
}
