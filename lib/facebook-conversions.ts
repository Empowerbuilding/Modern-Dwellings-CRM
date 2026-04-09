import crypto from 'crypto'

// Facebook Conversions API event names
export type FacebookEventName = 'PageView' | 'initial_lead' | 'Lead' | 'lead' | 'marketingqualifiedlead' | 'salesqualifiedlead' | 'customer'

export interface FacebookUserData {
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  fbclid?: string | null  // Raw fbclid or full fbc cookie value
  fbp?: string | null  // Facebook browser pixel ID (_fbp cookie)
  leadId?: string | null  // Facebook Lead Ads lead ID (leadgen_id)
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  externalId?: string | null  // Contact ID from CRM
}

export interface FacebookCustomData {
  value?: number
  currency?: string
  leadEventSource?: string
}

export interface SendFacebookEventParams {
  eventName: FacebookEventName
  eventTime?: Date
  eventId?: string  // For deduplication - use contact ID + event name
  userData: FacebookUserData
  customData?: FacebookCustomData
  eventSourceUrl?: string
}

export interface FacebookEventResponse {
  success: boolean
  eventId: string
  error?: string
}

interface FacebookAPIResponse {
  events_received?: number
  messages?: string[]
  fbtrace_id?: string
  error?: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

/**
 * Hash user data using SHA256 (required by Facebook Conversions API)
 * Facebook requires all PII to be hashed before sending
 */
export function hashUserData(value: string | null | undefined): string | null {
  if (!value) return null

  // Lowercase and trim before hashing (Facebook requirement)
  const normalized = value.toLowerCase().trim()

  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Mask email for logging (privacy)
 */
function maskEmail(email: string | null | undefined): string {
  if (!email) return '[none]'
  const [local, domain] = email.split('@')
  if (!domain) return '[invalid]'
  return `${local.slice(0, 2)}***@${domain}`
}

/**
 * Format fbclid as proper fbc cookie format
 * If already in fbc format (fb.1.{timestamp}.{fbclid}), return as is
 * Otherwise, format as fb.1.{timestamp}.{fbclid}
 */
function formatFbc(fbclid: string | null | undefined): string | null {
  if (!fbclid) return null

  // Already in fbc format
  if (fbclid.startsWith('fb.')) {
    return fbclid
  }

  // Raw fbclid - format it
  return `fb.1.${Date.now()}.${fbclid}`
}

/**
 * Send an event to Facebook Conversions API
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api
 */
export async function sendFacebookEvent(params: SendFacebookEventParams): Promise<FacebookEventResponse> {
  const {
    eventName,
    eventTime = new Date(),
    eventId,
    userData,
    customData,
    eventSourceUrl,
  } = params

  const pixelId = process.env.FACEBOOK_PIXEL_ID
  const accessToken = process.env.FACEBOOK_CONVERSIONS_API_TOKEN

  // Generate event ID if not provided (for deduplication)
  const finalEventId = eventId || `${userData.externalId || 'unknown'}_${eventName}_${Date.now()}`

  if (!pixelId || !accessToken) {
    console.error('[Facebook CAPI] Missing FACEBOOK_PIXEL_ID or FACEBOOK_CONVERSIONS_API_TOKEN')
    return {
      success: false,
      eventId: finalEventId,
      error: 'Facebook Conversions API not configured',
    }
  }

  console.log(`[Facebook CAPI] Sending ${eventName} event for ${maskEmail(userData.email)}`)

  // Build user_data object - only include fields that have values
  const userDataPayload: Record<string, unknown> = {}

  if (userData.email) {
    userDataPayload.em = [hashUserData(userData.email)]
  }
  if (userData.phone) {
    // Remove non-numeric characters from phone before hashing
    const cleanPhone = userData.phone.replace(/\D/g, '')
    userDataPayload.ph = [hashUserData(cleanPhone)]
  }
  if (userData.firstName) {
    userDataPayload.fn = [hashUserData(userData.firstName)]
  }
  if (userData.lastName) {
    userDataPayload.ln = [hashUserData(userData.lastName)]
  }
  if (userData.fbclid) {
    // Format fbclid as proper fbc cookie format if needed
    const fbc = formatFbc(userData.fbclid)
    if (fbc) {
      userDataPayload.fbc = fbc
    }
  }
  if (userData.fbp) {
    // fbp is the Facebook browser pixel ID - NOT hashed
    userDataPayload.fbp = userData.fbp
  }
  if (userData.leadId) {
    // lead_id is NOT hashed - it's the Facebook Lead Ads lead ID
    userDataPayload.lead_id = userData.leadId
  }
  if (userData.externalId) {
    userDataPayload.external_id = [hashUserData(userData.externalId)]
  }
  if (userData.clientIpAddress) {
    userDataPayload.client_ip_address = userData.clientIpAddress
  }
  if (userData.clientUserAgent) {
    userDataPayload.client_user_agent = userData.clientUserAgent
  }

  // Build the event payload
  // Using 'website' for CAPI action_source
  const eventPayload: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: finalEventId,
    action_source: 'website',
    user_data: userDataPayload,
  }

  if (eventSourceUrl) {
    eventPayload.event_source_url = eventSourceUrl
  }

  if (customData && Object.keys(customData).length > 0) {
    const customDataPayload: Record<string, unknown> = {}
    if (customData.value !== undefined) {
      customDataPayload.value = customData.value
    }
    if (customData.currency) {
      customDataPayload.currency = customData.currency
    }
    if (customData.leadEventSource) {
      customDataPayload.lead_event_source = customData.leadEventSource
    }
    if (Object.keys(customDataPayload).length > 0) {
      eventPayload.custom_data = customDataPayload
    }
  }

  const requestBody = {
    data: [eventPayload],
    test_event_code: 'TEST68592',
  }

  console.log('[Facebook CAPI] Request payload:', JSON.stringify(requestBody, null, 2))

  try {
    const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseData: FacebookAPIResponse = await response.json()

    console.log('[Facebook CAPI] Response:', JSON.stringify(responseData, null, 2))

    if (!response.ok || responseData.error) {
      const errorMessage = responseData.error?.message || `HTTP ${response.status}`
      console.error(`[Facebook CAPI] Error: ${errorMessage}`)
      return {
        success: false,
        eventId: finalEventId,
        error: errorMessage,
      }
    }

    console.log(`[Facebook CAPI] Successfully sent ${eventName} event (events_received: ${responseData.events_received})`)

    return {
      success: true,
      eventId: finalEventId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Facebook CAPI] Exception: ${errorMessage}`)
    return {
      success: false,
      eventId: finalEventId,
      error: errorMessage,
    }
  }
}
