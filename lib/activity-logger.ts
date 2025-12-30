import { supabase } from './supabase'
import type { Activity, ActivityType } from './types'

export interface LogActivityParams {
  contactId?: string | null
  dealId?: string | null
  companyId?: string | null
  userId?: string | null
  activityType: ActivityType
  title: string
  description?: string | null
  metadata?: Record<string, unknown> | null
  anonymousId?: string | null
}

/**
 * Creates an activity record in the database
 */
export async function logActivity(params: LogActivityParams): Promise<{ data: Activity | null; error: Error | null }> {
  const {
    contactId,
    dealId,
    companyId,
    userId,
    activityType,
    title,
    description,
    metadata,
    anonymousId,
  } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('activities') as any).insert({
    contact_id: contactId ?? null,
    deal_id: dealId ?? null,
    company_id: companyId ?? null,
    user_id: userId ?? null,
    activity_type: activityType,
    title,
    description: description ?? null,
    metadata: metadata ?? null,
    anonymous_id: anonymousId ?? null,
  }).select().single()

  return { data: data as Activity | null, error }
}

/**
 * Returns all activities for a contact, ordered by most recent first
 */
export async function getContactActivities(
  contactId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ data: Activity[]; error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('activities') as any)
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  return { data: (data as Activity[]) ?? [], error }
}

/**
 * Returns all activities for a deal, ordered by most recent first
 */
export async function getDealActivities(
  dealId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ data: Activity[]; error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('activities') as any)
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  return { data: (data as Activity[]) ?? [], error }
}

/**
 * Links anonymous activities to a contact after form submission.
 * This updates all activities with the given anonymousId to also have the contactId.
 */
export async function linkAnonymousActivities(
  anonymousId: string,
  contactId: string
): Promise<{ count: number; error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('activities') as any)
    .update({ contact_id: contactId })
    .eq('anonymous_id', anonymousId)
    .is('contact_id', null)
    .select('id')

  return { count: data?.length ?? 0, error }
}

/**
 * Get activities by anonymous ID (for tracking anonymous visitors)
 */
export async function getAnonymousActivities(
  anonymousId: string,
  options?: { limit?: number }
): Promise<{ data: Activity[]; error: Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('activities') as any)
    .select('*')
    .eq('anonymous_id', anonymousId)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  return { data: (data as Activity[]) ?? [], error }
}

/**
 * Helper to log a page view activity
 */
export async function logPageView(params: {
  contactId?: string | null
  anonymousId?: string | null
  pageUrl: string
  pageTitle: string
  referrer?: string | null
}): Promise<{ data: Activity | null; error: Error | null }> {
  return logActivity({
    contactId: params.contactId,
    anonymousId: params.anonymousId,
    activityType: 'page_view',
    title: `Visited ${params.pageTitle}`,
    metadata: {
      page_url: params.pageUrl,
      page_title: params.pageTitle,
      referrer: params.referrer ?? null,
    },
  })
}

/**
 * Helper to log a form submission activity
 */
export async function logFormSubmit(params: {
  contactId?: string | null
  anonymousId?: string | null
  formName: string
  formData?: Record<string, unknown>
}): Promise<{ data: Activity | null; error: Error | null }> {
  return logActivity({
    contactId: params.contactId,
    anonymousId: params.anonymousId,
    activityType: 'form_submit',
    title: `Submitted ${params.formName}`,
    metadata: {
      form_name: params.formName,
      form_data: params.formData ?? null,
    },
  })
}

/**
 * Helper to log a stage change activity
 */
export async function logStageChange(params: {
  dealId: string
  contactId?: string | null
  userId?: string | null
  oldStage: string
  newStage: string
  dealTitle: string
}): Promise<{ data: Activity | null; error: Error | null }> {
  return logActivity({
    dealId: params.dealId,
    contactId: params.contactId,
    userId: params.userId,
    activityType: 'stage_change',
    title: `Stage changed: ${params.oldStage} → ${params.newStage}`,
    description: `Deal "${params.dealTitle}" moved from ${params.oldStage} to ${params.newStage}`,
    metadata: {
      old_stage: params.oldStage,
      new_stage: params.newStage,
      deal_title: params.dealTitle,
    },
  })
}

/**
 * Helper to log an email sent activity
 */
export async function logEmailSent(params: {
  contactId: string
  dealId?: string | null
  userId?: string | null
  subject: string
  emailType?: string
}): Promise<{ data: Activity | null; error: Error | null }> {
  return logActivity({
    contactId: params.contactId,
    dealId: params.dealId,
    userId: params.userId,
    activityType: 'email_sent',
    title: `Email: ${params.subject}`,
    metadata: {
      subject: params.subject,
      email_type: params.emailType ?? null,
    },
  })
}

/**
 * Helper to log a note activity
 */
export async function logNote(params: {
  contactId?: string | null
  dealId?: string | null
  companyId?: string | null
  userId?: string | null
  title: string
  content: string
}): Promise<{ data: Activity | null; error: Error | null }> {
  return logActivity({
    contactId: params.contactId,
    dealId: params.dealId,
    companyId: params.companyId,
    userId: params.userId,
    activityType: 'note',
    title: params.title,
    description: params.content,
  })
}
